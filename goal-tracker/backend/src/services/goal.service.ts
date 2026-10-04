/**
 * Regras de negócio das metas.
 *
 * REGRA 11 e 12 (AI_NOTES.md §8): toda leitura/escrita é filtrada por
 * `userId` vindo do token, NUNCA do body ou de um parâmetro do cliente.
 * Uma meta de outro usuário simplesmente não é encontrada — não devolvemos
 * "acesso negado", porque isso confirmaria a existência do recurso.
 */
import { Transaction, UniqueConstraintError, WhereOptions } from 'sequelize';

import { sequelize } from '../config/database.js';
import { Goal, GoalOccurrence } from '../models/index.js';
import { BusinessRuleError, ConflictError, NotFoundError } from '../utils/errors.js';
import type { Frequency, Period } from '../utils/period.js';
import type { CreateGoalInput, UpdateGoalInput } from '../validators/index.js';

import { completeCurrentOccurrence, finalizePastOccurrences } from './occurrence.service.js';

export interface ListGoalsOptions {
  includeInactive: boolean;
  page: number;
  limit: number;
}

export interface PaginatedGoals {
  goals: Goal[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function listGoals(
  userId: number,
  options: ListGoalsOptions,
): Promise<PaginatedGoals> {
  // `paranoid: true` já exclui metas com deletedAt preenchido.
  const where: WhereOptions = { userId };

  if (!options.includeInactive) {
    where['isActive'] = true;
  }

  const { rows, count } = await Goal.findAndCountAll({
    where,
    order: [
      ['isActive', 'DESC'],
      ['createdAt', 'DESC'],
    ],
    limit: options.limit,
    offset: (options.page - 1) * options.limit,
  });

  return {
    goals: rows,
    total: count,
    page: options.page,
    limit: options.limit,
    totalPages: Math.ceil(count / options.limit),
  };
}

/**
 * Busca uma meta pertencente ao usuário.
 * Filtro por `userId` no próprio WHERE = autorização no banco, não no cliente.
 */
export async function findGoalForUser(
  userId: number,
  goalId: number,
  transaction?: Transaction,
): Promise<Goal> {
  const goal = await Goal.findOne({
    where: { id: goalId, userId },
    transaction,
  });

  if (!goal) {
    throw new NotFoundError('Meta não encontrada.', 'GOAL_NOT_FOUND');
  }

  return goal;
}

export async function createGoal(userId: number, input: CreateGoalInput): Promise<Goal> {
  try {
    return await Goal.create({
      userId,
      name: input.name,
      description: input.description ?? null,
      frequency: input.frequency,
      isActive: input.isActive ?? true,
    });
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      throw new ConflictError('Já existe uma meta com esse identificador.', 'GOAL_CONFLICT');
    }
    throw error;
  }
}

export async function updateGoal(
  userId: number,
  goalId: number,
  input: UpdateGoalInput,
): Promise<Goal> {
  const goal = await findGoalForUser(userId, goalId);

  if (input.name !== undefined) goal.name = input.name;
  if (input.description !== undefined) goal.description = input.description;
  if (input.isActive !== undefined) goal.isActive = input.isActive;

  if (input.frequency !== undefined && input.frequency !== goal.frequency) {
    // DECISÃO DE PRODUTO (a revisar): permitir trocar a frequência.
    //
    // O histórico NÃO é apagado nem reescrito (regra 8). Cada ocorrência já
    // gravada mantém as fronteiras do período que existia quando foi criada.
    // A partir da próxima leitura, o "período atual" passa a seguir a nova
    // frequência.
    //
    // Consequência aceita: a série pode ter Resolution alternada entre
    // granularidades (ex.: um registro DAILY de ontem e um WEEKLY de hoje).
    // Isso aparece no histórico, mas nunca é silenciosamente "corrigido".
    goal.frequency = input.frequency;
  }

  await goal.save();

  return goal;
}

/**
 * REGRA (AI_NOTES §8, regra 10): "meta inativa não pode ser concluída" é regra
 * de negócio e mora AQUI, não no controller.
 *
 * O controller orquestra; a decisão é do service. É exatamente a separação que
 * o §10 pede e que o README promete.
 */
export function assertGoalIsCompletable(goal: Goal): void {
  if (!goal.isActive) {
    throw new BusinessRuleError(
      'Metas inativas não podem ser concluídas. Reative a meta para continuar.',
      'GOAL_INACTIVE',
    );
  }
}

export interface CompleteOccurrenceResult {
  occurrence: GoalOccurrence;
  period: Period;
}

/**
 * REGRA 1 + REGRA 3: conclui a ocorrência do período atual da meta do usuário.
 *
 * A transação é aberta aqui (não no controller) porque "finalizar períodos
 * pendentes + criar/ler a ocorrência atual + gravar a conclusão" precisa ser
 * atômico (regra 9).
 *
 * `now` é injetável para tornar os testes determinísticos.
 */
export async function completeOccurrenceForUser(
  userId: number,
  goalId: number,
  timeZone: string,
  now?: Date,
): Promise<CompleteOccurrenceResult> {
  const goal = await findGoalForUser(userId, goalId);

  assertGoalIsCompletable(goal);

  return sequelize.transaction(async (transaction) =>
    completeCurrentOccurrence({ goalId: goal.id, frequency: goal.frequency, timeZone, now }, transaction),
  );
}

/**
 * REGRA 8: exclusão é SOFT DELETE.
 *
 * A linha continua no banco e as ocorrências continuam lá, então o histórico
 * permanece disponível. `paranoid` no modelo cuida do preenchimento de
 * `deletedAt` e do filtro automático nas queries.
 *
 * A transação garante que "finalizar períodos pendentes" e "excluir a meta"
 * aconteçam juntos, ou nenhum dos dois.
 *
 * `timeZone` é obrigatório: a finalização usa a data civil do USUÁRIO (regra 7),
 * não a do servidor. Uma versão anterior desta função usava
 * `new Date().toISOString().slice(0, 10)`, que é UTC — para `America/Sao_Paulo`
 * isso marca o período errado entre 21:00 e 24:00.
 */
export async function deleteGoal(
  userId: number,
  goalId: number,
  timeZone: string,
  now?: Date,
): Promise<void> {
  await sequelize.transaction(async (transaction) => {
    const goal = await findGoalForUser(userId, goalId, transaction);

    // Registra os períodos em aberto antes de arquivar a meta.
    await finalizePastOccurrences(
      { goalId: goal.id, frequency: goal.frequency, timeZone, now },
      transaction,
    );

    await goal.destroy({ transaction });
  });
}

/** Frequências usadas pelo usuário — útil para agrupar na tela. */
export async function countGoalsByFrequency(
  userId: number,
): Promise<Record<Frequency, number>> {
  const grouped = (await Goal.findAll({
    where: { userId },
    attributes: [
      'frequency',
      [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
    ],
    group: ['frequency'],
    raw: true,
  })) as unknown as Array<{ frequency: Frequency; total: string }>;

  const result: Record<Frequency, number> = { DAILY: 0, WEEKLY: 0, MONTHLY: 0 };

  for (const row of grouped) {
    result[row.frequency] = Number(row.total);
  }

  return result;
}