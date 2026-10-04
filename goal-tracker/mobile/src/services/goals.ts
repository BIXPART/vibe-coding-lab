/**
 * Metas e ocorrências.
 *
 * ## Regra 7 e 10: o período é do backend
 *
 * Nenhuma função aqui calcula "qual é o período atual". O app recebe
 * `periodStart`/`periodEnd` já resolvidos e os exibe. Isso é deliberado:
 * duplicar o cálculo de período no cliente é a forma mais rápida de o app e a
 * API discordarem na virada do dia — e o usuário veria "concluído" numa tela e
 * "pendente" na outra.
 *
 * O que o app faz é **formatar**: `periodStart`/`periodEnd` são strings
 * `YYYY-MM-DD` (datas civis, não instantes) e viram "4 de out" para exibição.
 */
import { ApiError, request } from '@/services/api';
import type { Goal, GoalOccurrences, GoalStats, OccurrenceStatus, PaginatedGoals } from '@/types/api';

/**
 * Códigos de erro do backend — espelham `backend/src/services/*.ts`.
 *
 * Regra 10: o servidor decide. Se ele renomear um código, esta constante precisa
 * mudar junto, senão o `case` que depende dela deixa de executar silenciosamente.
 */

/** `409`: o período atual já foi concluído. É o resultado esperado ao tocar duas vezes. */
export const ALREADY_COMPLETED = 'OCCURRENCE_ALREADY_COMPLETED';
/** `422`: meta inativa não pode ser concluída (regra de negócio do backend). */
export const GOAL_INACTIVE = 'GOAL_INACTIVE';
/**
 * `404`: a meta não existe **ou** não é do usuário. O backend não distingue — e
 * não deve, senão confirmaria a existência do recurso (regra 12).
 */
export const GOAL_NOT_FOUND = 'GOAL_NOT_FOUND';

export interface ListGoalsParams {
  includeInactive?: boolean;
  page?: number;
  limit?: number;
}

/**
 * `signal` é opcional em toda função deste módulo.
 *
 * `useAsync` cria um `AbortController` por busca e aborta o anterior quando as
 * dependências mudam ou a tela desmonta. O sinal só chega na API se for
 * repassado — daí o parâmetro explícito. Sem ele, "sair da tela no meio do
 * fetch" deixa a requisição voando até o timeout de 15 s.
 */

export async function listGoals(
  params: ListGoalsParams = {},
  signal?: AbortSignal,
): Promise<PaginatedGoals> {
  const query = new URLSearchParams();

  if (params.includeInactive) query.set('includeInactive', 'true');
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.limit !== undefined) query.set('limit', String(params.limit));

  const suffix = query.toString();
  const path = suffix ? `/goals?${suffix}` : '/goals';

  return request<PaginatedGoals>(path, { signal });
}

export async function getGoal(id: number, signal?: AbortSignal): Promise<Goal> {
  const result = await request<{ goal: Goal }>(`/goals/${id}`, { signal });
  return result.goal;
}

export interface CreateGoalInput {
  name: string;
  frequency: Goal['frequency'];
  description?: string | null;
}

/** `201` devolve `{ goal }`. Se já existir, `409 CONFLICT` — depend do chamador. */
export async function createGoal(input: CreateGoalInput, signal?: AbortSignal): Promise<Goal> {
  const result = await request<{ goal: Goal }>('/goals', {
    method: 'POST',
    body: input,
    signal,
  });
  return result.goal;
}

export interface UpdateGoalInput {
  name?: string;
  description?: string | null;
  frequency?: Goal['frequency'];
  isActive?: boolean;
}

export async function updateGoal(
  id: number,
  input: UpdateGoalInput,
  signal?: AbortSignal,
): Promise<Goal> {
  const result = await request<{ goal: Goal }>(`/goals/${id}`, {
    method: 'PATCH',
    body: input,
    signal,
  });
  return result.goal;
}

/** Soft delete no backend (regra 8): o histórico sobrevive. */
export async function deleteGoal(id: number, signal?: AbortSignal): Promise<void> {
  await request<null>(`/goals/${id}`, { method: 'DELETE', signal });
}

export interface CompleteResult {
  occurrence: {
    goalId: number;
    periodStart: string;
    periodEnd: string;
    status: OccurrenceStatus;
    completedAt: string | null;
  };
  period: {
    frequency: Goal['frequency'];
    start: string;
    end: string;
  };
}

/**
 * Conclui o período atual.
 *
 * Idempotente **na prática**: se o período já estava concluído, o backend
 * responde `409 ALREADY_COMPLETED` e o app trata como sucesso visual. Tocar
 * duas vezes não pode gerar erro nem duas linhas.
 */
export async function completeCurrentOccurrence(
  goalId: number,
  signal?: AbortSignal,
): Promise<CompleteResult> {
  try {
    return await request<CompleteResult>(`/goals/${goalId}/occurrences/complete`, {
      method: 'POST',
      signal,
    });
  } catch (error) {
    if (error instanceof ApiError && error.code === ALREADY_COMPLETED) {
      // Estado desejado já atingido — reinterpreta como sucesso idempotente.
      return alreadyCompletedAsResult(goalId, error, signal);
    }
    throw error;
  }
}

/**
 * Reconstrói o resultado a partir do 409.
 *
 * Precisamos do período para atualizar a tela, mas o corpo do 409 não o traz.
 * Chamamos `GET /goals/:id/stats`, que devolve o período atual já resolvido —
 * de novo, sem recalcular nada no cliente.
 */
async function alreadyCompletedAsResult(
  goalId: number,
  _error: ApiError,
  signal?: AbortSignal,
): Promise<CompleteResult> {
  const stats = await getGoalStats(goalId, signal);

  return {
    occurrence: {
      goalId,
      periodStart: stats.currentPeriod.periodStart,
      periodEnd: stats.currentPeriod.periodEnd,
      status: stats.currentPeriod.status,
      completedAt: stats.currentPeriod.completedAt,
    },
    period: {
      frequency: stats.frequency,
      start: stats.currentPeriod.periodStart,
      end: stats.currentPeriod.periodEnd,
    },
  };
}

export async function getGoalStats(goalId: number, signal?: AbortSignal): Promise<GoalStats> {
  const result = await request<{ stats: GoalStats }>(`/goals/${goalId}/stats`, { signal });
  return result.stats;
}

export interface HistoryParams {
  from?: string;
  to?: string;
  status?: OccurrenceStatus;
}

/**
 * Histórico de uma meta.
 *
 * Sem `from`/`to`, o backend usa a janela padrão dele (que sabe quantos
 * períodos fazem sentido por frequência). O app não escolhe uma janela
 * arbitrária — deixaria de fora períodos que o usuário acha que deveria ver.
 */
export async function getHistory(
  goalId: number,
  params: HistoryParams = {},
  signal?: AbortSignal,
): Promise<GoalOccurrences> {
  const query = new URLSearchParams();

  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  if (params.status) query.set('status', params.status);

  const suffix = query.toString();
  const path = suffix ? `/goals/${goalId}/occurrences?${suffix}` : `/goals/${goalId}/occurrences`;

  return request<GoalOccurrences>(path, { signal });
}