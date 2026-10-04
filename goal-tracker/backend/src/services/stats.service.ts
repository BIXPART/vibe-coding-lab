/**
 * Estatísticas e dashboard.
 *
 * Regra aplicada aqui: "Não criar estatísticas falsas quando ainda não houver
 * dados suficientes" (AI_NOTES.md §6). Por isso todo bloco de estatística vem
 * acompanhado de `hasData`, e taxa/streak valem zero quando não há histórico —
 * nunca um número plausível inventado.
 *
 * As séries contínuas vêm de `buildHistory`, que preenche as lacunas; sem isso
 * um usuário que não abre o app teria streaks inflados.
 */
import { Transaction } from 'sequelize';

import type { Goal } from '../models/index.js';
import { formatCivilDate, parseCivilDate } from '../utils/civil-date.js';
import {
  periodKey,
  previousPeriod,
  resolvePeriodForInstant,
  type Frequency,
} from '../utils/period.js';
import { calculateStreaks, type StreakResult } from '../utils/streak.js';

import { findGoalForUser, listGoals } from './goal.service.js';
import {
  buildHistory,
  findOrCreateCurrentOccurrence,
  type HistoryEntry,
} from './occurrence.service.js';

export interface PeriodWindow {
  from: string;
  to: string;
}

/**
 * Janela do histórico: `previousPeriods` períodos anteriores + o período atual.
 *
 * `to` é o ÚLTIMO dia do período atual, não "hoje". Assim a série tem sempre
 * o mesmo tamanho e o período corrente aparece uma única vez, mesmo em 1º de
 * janeiro ou em 31 de dezembro.
 */
export function defaultHistoryWindow(
  frequency: Frequency,
  timeZone: string,
  now: Date = new Date(),
  previousPeriods = 30,
): PeriodWindow {
  const current = resolvePeriodForInstant(frequency, now, timeZone);

  let cursor = current;
  for (let step = 0; step < previousPeriods; step += 1) {
    cursor = previousPeriod(cursor);
  }

  return {
    from: formatCivilDate(cursor.start),
    to: formatCivilDate(current.end),
  };
}

function currentPeriodEntry(
  entries: HistoryEntry[],
  frequency: Frequency,
  timeZone: string,
  now: Date,
): HistoryEntry | undefined {
  const key = periodKey(resolvePeriodForInstant(frequency, now, timeZone));
  return entries.find((entry) => entry.periodStart === key);
}

export interface GoalStats extends StreakResult {
  goalId: number;
  goalName: string;
  frequency: Frequency;
  currentPeriod: {
    periodStart: string;
    periodEnd: string;
    status: 'PENDING' | 'COMPLETED' | 'MISSED';
    completedAt: Date | null;
  };
  window: {
    from: string;
    to: string;
    periodsCounted: number;
  };
}

/** Estatísticas de uma meta dentro da janela padrão. */
export async function goalStats(
  userId: number,
  goalId: number,
  timeZone: string,
  now: Date = new Date(),
): Promise<GoalStats> {
  const goal = await findGoalForUser(userId, goalId);
  const window = defaultHistoryWindow(goal.frequency, timeZone, now);

  const history = await buildHistory({
    goalId: goal.id,
    frequency: goal.frequency,
    timeZone,
    now,
    createdAt: goal.createdAt,
    from: parseCivilDate(window.from),
    to: parseCivilDate(window.to),
  });

  const streaks = calculateStreaks(history);
  const current =
    currentPeriodEntry(history, goal.frequency, timeZone, now) ?? history[history.length - 1];

  return {
    ...streaks,
    goalId: goal.id,
    goalName: goal.name,
    frequency: goal.frequency,
    currentPeriod: {
      periodStart: current?.periodStart ?? window.from,
      periodEnd: current?.periodEnd ?? window.to,
      status: current?.status ?? 'PENDING',
      completedAt: current?.completedAt ?? null,
    },
    window: {
      from: window.from,
      to: window.to,
      periodsCounted: history.length,
    },
  };
}

export interface DashboardGoal {
  goalId: number;
  name: string;
  frequency: Frequency;
  description: string | null;
  isActive: boolean;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  status: 'PENDING' | 'COMPLETED' | 'MISSED';
  completedAt: Date | null;
  currentStreak: number;
  bestStreak: number;
  /**
   * Contagem dentro da JANELA de medição, não do período atual.
   *
   * São estes dois campos que alimentam `totals.completionRate`. Eles já vinham
   * calculados em `streaks` e estavam sendo descartados — o agregador do
   * dashboard não tinha como somar períodos concluídos e perdidos porque só
   * conhecia o status do período atual.
   */
  completedCount: number;
  missedCount: number;
}

export interface DashboardSummary {
  timeZone: string;
  generatedAt: string;
  /**
   * Duas medidas diferentes, de propósito — e é preciso saber qual é qual.
   *
   * - `completed` / `pending` contam METAS no **período atual**. É o que a aba
   *   "Hoje" precisa responder: "o que falta agora?".
   * - `completionRate` é a **MESMA** definição de `GoalStats.completionRate`
   *   (`utils/streak.ts`): concluídas / (concluídas + perdidas), sobre a janela
   *   de medição, e nunca sobre o total de metas ativas.
   *
   * A versão anterior dividia por `activeGoals`, o que produzia dois números
   * com o mesmo rótulo "Taxa" e denominadores incompatíveis. E `hasData: true`
   * com zero períodos fechados gerava "0%" — estatística inventada, o que a
   * AI_NOTES.md §6 proíbe.
   */
  totals: {
    activeGoals: number;
    /** Metas concluídas no período atual. */
    completed: number;
    /** Metas pendentes no período atual. */
    pending: number;
    /** 0 a 1, com 4 casas. Denominador = períodos fechados na janela. */
    completionRate: number;
    /** `false` enquanto nenhum período da janela tiver sido fechado. */
    hasData: boolean;
  };
  goals: DashboardGoal[];
}

/**
 * Dashboard do período corrente.
 *
 * `completed`/`pending` contam metas no período atual (é o que a tela "Hoje"
 * mostra). Já a taxa vem do agregado de `streaks.completedCount` /
 * `streaks.missedCount` — o mesmo par que `calculateStreaks` usa em
 * `goalStats`. Isso mantém "Taxa" com um significado único no app inteiro, e
 * mantém `hasData` falso enquanto nenhum período da janela tiver sido fechado.
 *
 * Nenhuma query extra: `readGoalSnapshot` já devolvia o `StreakResult` completo
 * e só 2 dos 7 campos eram usados.
 *
 * ## Observação conhecida (fora do escopo desta correção)
 *
 * A criação da ocorrência corrente acontece por meta, e `describeGoalForDashboard`
 * não abre transação — apesar de o docstring de `readGoalSnapshot` dizer o
 * contrário. `GET` também deveria ser seguro (RFC 9110) e hoje faz `INSERT`.
 * Registrado para a próxima rodada; não afeta a correção da taxa.
 */
export async function buildDashboard(
  userId: number,
  timeZone: string,
  now: Date = new Date(),
): Promise<DashboardSummary> {
  const { goals } = await listGoals(userId, { includeInactive: false, page: 1, limit: 100 });

  const items = await Promise.all(
    goals.map((goal) => describeGoalForDashboard(goal, timeZone, now)),
  );

  const total = items.length;
  const completed = items.filter((item) => item.status === 'COMPLETED').length;

  // Agregado de períodos fechados na janela de medição. `settled` é o mesmo
  // conceito de `calculateStreaks`: concluídas + perdidas, excluindo pendentes
  // (um período em aberto não é sucesso nem fracasso).
  const settled = items.reduce(
    (acc, item) => {
      acc.completed += item.completedCount;
      acc.missed += item.missedCount;
      return acc;
    },
    { completed: 0, missed: 0 },
  );

  const settledTotal = settled.completed + settled.missed;

  return {
    timeZone,
    generatedAt: now.toISOString(),
    totals: {
      activeGoals: total,
      completed,
      pending: total - completed,
      completionRate:
        settledTotal === 0 ? 0 : Number((settled.completed / settledTotal).toFixed(4)),
      hasData: settledTotal > 0,
    },
    goals: items,
  };
}

async function describeGoalForDashboard(
  goal: Goal,
  timeZone: string,
  now: Date,
): Promise<DashboardGoal> {
  const { occurrence, streaks } = await readGoalSnapshot({
    goalId: goal.id,
    frequency: goal.frequency,
    timeZone,
    createdAt: goal.createdAt,
    now,
  });

  return {
    goalId: goal.id,
    name: goal.name,
    frequency: goal.frequency,
    description: goal.description,
    isActive: goal.isActive,
    currentPeriodStart: occurrence.periodStart,
    currentPeriodEnd: occurrence.periodEnd,
    status: occurrence.status,
    completedAt: occurrence.completedAt,
    currentStreak: streaks.currentStreak,
    bestStreak: streaks.bestStreak,
    completedCount: streaks.completedCount,
    missedCount: streaks.missedCount,
  };
}

/**
 * Leitura consistente: materializa a ocorrência atual e devolve também o
 * histórico da janela, tudo na mesma transação.
 *
 * `findOrCreateCurrentOccurrence` precisa de transação porque pode INSERT.
 * Já `buildHistory` só faz SELECT e por isso aceita `undefined`.
 */
export async function readGoalSnapshot(
  context: {
    goalId: number;
    frequency: Frequency;
    timeZone: string;
    createdAt: Date;
    now?: Date;
  },
  transaction?: Transaction,
): Promise<{
  occurrence: { periodStart: string; periodEnd: string; status: 'PENDING' | 'COMPLETED' | 'MISSED'; completedAt: Date | null };
  window: PeriodWindow;
  streaks: StreakResult;
  history: HistoryEntry[];
}> {
  const now = context.now ?? new Date();
  const window = defaultHistoryWindow(context.frequency, context.timeZone, now);

  const { occurrence } = await findOrCreateCurrentOccurrence({ ...context, now }, transaction);

  const history = await buildHistory({
    ...context,
    now,
    from: parseCivilDate(window.from),
    to: parseCivilDate(window.to),
  });

  return { occurrence, window, streaks: calculateStreaks(history), history };
}