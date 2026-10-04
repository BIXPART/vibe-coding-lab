/**
 * Regras de negócio de recorrência.
 *
 * Este é o arquivo mais importante do backend. Todas as regras do AI_NOTES.md
 * §8 que envolvem ocorrências são aplicadas aqui, e não nos controllers.
 *
 * Princípio (AI_NOTES.md §5): a recorrência NUNCA é implementada resetando ou
 * apagando o estado anterior. Cada período tem sua própria linha em
 * `goal_occurrences`; um novo dia cria uma nova linha e as anteriores ficam
 * intactas.
 */
import { Op, Transaction, UniqueConstraintError, WhereOptions } from 'sequelize';

import { GoalOccurrence, type OccurrenceStatus } from '../models/index.js';
import {
  compareCivilDates,
  formatCivilDate,
  parseCivilDate,
  toCivilDate,
  type CivilDate,
} from '../utils/civil-date.js';
import { BusinessRuleError, ConflictError } from '../utils/errors.js';
import {
  enumeratePeriods,
  periodKey,
  resolvePeriodForInstant,
  type Frequency,
  type Period,
} from '../utils/period.js';

export interface OccurrenceContext {
  goalId: number;
  frequency: Period['frequency'];
  timeZone: string;
  /** Injetável para tornar os testes determinísticos. */
  now?: Date;
}

/**
 * Get-or-create da ocorrência do período atual.
 *
 * `getOrCreate` do Sequelize sozinho NÃO serve aqui: duas requisições
 * simultâneas podem tentar criar a mesma linha. Por isso tratamos a violação
 * da constraint única e relemos o registro vencedor. together com o try/catch,
 * é isso que garante a regra 1 mesmo sob concorrência.
 */
export async function findOrCreateCurrentOccurrence(
  context: OccurrenceContext,
  transaction?: Transaction,
): Promise<{ occurrence: GoalOccurrence; period: Period }> {
  const now = context.now ?? new Date();
  const period = resolvePeriodForInstant(context.frequency, now, context.timeZone);
  const start = periodKey(period);

  const existing = await GoalOccurrence.findOne({
    where: { goalId: context.goalId, periodStart: start },
    transaction,
  });

  if (existing) {
    return { occurrence: existing, period };
  }

  try {
    const created = await GoalOccurrence.create(
      {
        goalId: context.goalId,
        periodStart: start,
        periodEnd: formatCivilDate(period.end),
        status: 'PENDING',
      },
      { transaction },
    );

    return { occurrence: created, period };
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      // Corrida de concorrência: alguém criou antes de nós.
      const winner = await GoalOccurrence.findOne({
        where: { goalId: context.goalId, periodStart: start },
        transaction,
      });

      if (winner) {
        return { occurrence: winner, period };
      }
    }

    throw error;
  }
}

/**
 * Marca como MISSED os períodos anteriores que ficaram PENDING.
 *
 * Não usamos cron/agendador: a finalização é "lazy", feita no momento em que
 * o histórico é lido ou em que uma nova ocorrência é criada. Isso evita
 * perder dados se o servidor ficar desligado no fim de semana, e evita
 * criar uma linha para todo dia desde 1970. (AI_NOTES.md §6)
 */
export async function finalizePastOccurrences(
  context: OccurrenceContext,
  transaction?: Transaction,
): Promise<number> {
  const now = context.now ?? new Date();
  const today = toCivilDate(now, context.timeZone);

  // periodEnd < hoje  =>  o período já terminou.
  const where: WhereOptions = {
    goalId: context.goalId,
    status: 'PENDING',
    periodEnd: { [Op.lt]: formatCivilDate(today) } as WhereOptions,
  };

  const [affected] = await GoalOccurrence.update(
    { status: 'MISSED' },
    { where, transaction },
  );

  return affected;
}

/**
 * REGRA 1 + REGRA 3: conclui a ocorrência do período atual.
 *
 * - Só o período atual pode ser concluído (histórico é imutável).
 * - Uma ocorrência não pode ser concluída duas vezes.
 * - Períodos anteriores não são alterados.
 */
export async function completeCurrentOccurrence(
  context: OccurrenceContext,
  transaction: Transaction,
): Promise<{ occurrence: GoalOccurrence; period: Period }> {
  const now = context.now ?? new Date();

  await finalizePastOccurrences(context, transaction);

  const { occurrence, period } = await findOrCreateCurrentOccurrence(context, transaction);

  if (occurrence.status === 'COMPLETED') {
    throw new ConflictError(
      'Esta meta já foi concluída no período atual.',
      'OCCURRENCE_ALREADY_COMPLETED',
    );
  }

  // Defesa extra: se o período atual não casar com a ocorrência, algo está
  // inconsistente e preferimos falhar a explicar o usuário.
  if (occurrence.periodStart !== periodKey(period)) {
    throw new BusinessRuleError(
      'A ocorrência encontrado não corresponde ao período atual.',
      'PERIOD_MISMATCH',
    );
  }

  occurrence.status = 'COMPLETED';
  occurrence.completedAt = now;
  await occurrence.save({ transaction });

  return { occurrence, period };
}

export interface HistoryEntry {
  periodStart: string;
  periodEnd: string;
  status: OccurrenceStatus;
  completedAt: Date | null;
  /** A linha existe no banco ou foi gerada para preencher lacuna? */
  persisted: boolean;
}

/**
 * Data civil do período em que a meta foi criada.
 *
 * Existe por um motivo importante: uma meta criada hoje NÃO pode ter
 * "perdida" os 30 dias anteriores. Sem esta âncora, o histórico seria gerado
 * até antes de a meta existir e o dashboard mostraria estatísticas falsas
 * (AI_NOTES.md §6).
 *
 * O período de criação é o que contém `createdAt` no fuso do usuário — não o
 * dia exato — porque a primeira oportunidade já é o período inteiro em que a
 * meta nasceu.
 */
export function creationPeriodStart(
  frequency: Frequency,
  createdAt: Date,
  timeZone: string,
): string {
  return periodKey(resolvePeriodForInstant(frequency, createdAt, timeZone));
}

/**
 * Histórico contínuo entre dois instantes.
 *
 * Combina duas fontes:
 * 1. períodos gerados por `enumeratePeriods` (série contínua, sem buracos);
 * 2. linhas reais do banco (status e completedAt reais).
 *
 * Períodos passados sem registro viram MISSED, e o período atual vira PENDING.
 * É isso que permite mostrar "01 ✅, 02 ✅, 03 ❌, 04 ⏳" sem depender de o
 * usuário ter aberto o app todo dia.
 */
export async function buildHistory(
  context: OccurrenceContext & {
    from: CivilDate;
    to: CivilDate;
    /** `createdAt` da meta. Ancora o início da série. */
    createdAt: Date;
  },
): Promise<HistoryEntry[]> {
  const now = context.now ?? new Date();
  const today = toCivilDate(now, context.timeZone);

  // Nunca gerar períodos anteriores à criação da meta.
  const creationStart = parseCivilDate(
    creationPeriodStart(context.frequency, context.createdAt, context.timeZone),
  );
  const from = compareCivilDates(context.from, creationStart) < 0 ? creationStart : context.from;

  const periods = enumeratePeriods(context.frequency, from, context.to);

  const firstPeriod = periods[0];
  const lastPeriod = periods[periods.length - 1];

  const stored =
    firstPeriod && lastPeriod
      ? await GoalOccurrence.findAll({
          where: {
            goalId: context.goalId,
            periodStart: {
              [Op.between]: [formatCivilDate(firstPeriod.start), formatCivilDate(lastPeriod.end)],
            },
          },
          order: [['periodStart', 'ASC']],
        })
      : [];

  const byPeriod = new Map(stored.map((row) => [row.periodStart, row]));
  const currentPeriod = resolvePeriodForInstant(context.frequency, now, context.timeZone);

  return periods.map((period) => {
    const key = periodKey(period);
    const row = byPeriod.get(key);

    if (row) {
      // Uma linha antiga que ficou PENDING mas já passou => MISSED.
      const isPast = compareCivilDates(period.end, today) < 0;
      const status: OccurrenceStatus =
        row.status === 'PENDING' && isPast ? 'MISSED' : row.status;

      return {
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        status,
        completedAt: row.completedAt,
        persisted: true,
      };
    }

    const isCurrent = key === periodKey(currentPeriod);

    return {
      periodStart: key,
      periodEnd: formatCivilDate(period.end),
      status: isCurrent ? 'PENDING' : ('MISSED' as const),
      completedAt: null,
      persisted: false,
    };
  });
}

/** Converte string do banco em data civil, tolerando formato inesperado. */
export function occurrenceToCivilDate(value: string): CivilDate {
  return parseCivilDate(value.slice(0, 10));
}