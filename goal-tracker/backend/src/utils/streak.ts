/**
 * Cálculo de sequências (streaks).
 *
 * Função pura de propósito: as estatísticas mais exibidas no dashboard são
 * testáveis sem banco, sem HTTP e sem relógio real.
 *
 * Premissa importante: `items` deve ser uma série CONTÍNUA de períodos.
 * Quem garante isso é `occurrence.service`, que combina as linhas do banco com
 * os períodos gerados por `enumeratePeriods` (para preencher dias em que o
 * usuário não abriu o app). Sem isso, uma lacuna faria parecer que houve
 * sequência onde houve ausência.
 *
 * "Não criar estatísticas falsas quando ainda não houver dados suficientes"
 * (AI_NOTES.md §6): com zero períodos concluídos ou perdidos, retornamos
 * `hasData: false` e streak 0 — nunca um número inventado.
 */
import type { OccurrenceStatus } from '../models/index.js';

export interface StreakEntry {
  /** `YYYY-MM-DD` do início do período. */
  periodStart: string;
  status: OccurrenceStatus;
}

export interface StreakResult {
  /** Sequência atual, encerrando no período mais recente já definido. */
  currentStreak: number;
  /** Maior sequência já alcançada. */
  bestStreak: number;
  completedCount: number;
  missedCount: number;
  /** Períodos em aberto (normalmente só o período atual). */
  pendingCount: number;
  /** 0 a 1. 0 quando não há períodos definidos. */
  completionRate: number;
  /** Existem dados suficientes para afirmar alguma coisa? */
  hasData: boolean;
}

export function calculateStreaks(entries: StreakEntry[]): StreakResult {
  const sorted = [...entries].sort((a, b) =>
    a.periodStart < b.periodStart ? -1 : a.periodStart > b.periodStart ? 1 : 0,
  );

  // PENDING não é sucesso nem falha: um dia ainda em aberto não pode
  // "quebrar" a sequência do usuário.
  const settled = sorted.filter(
    (entry) => entry.status === 'COMPLETED' || entry.status === 'MISSED',
  );

  let bestStreak = 0;
  let run = 0;

  for (const entry of settled) {
    if (entry.status === 'COMPLETED') {
      run += 1;
      if (run > bestStreak) bestStreak = run;
    } else {
      run = 0;
    }
  }

  let currentStreak = 0;
  for (let index = settled.length - 1; index >= 0; index -= 1) {
    const entry = settled[index];
    if (entry?.status === 'COMPLETED') {
      currentStreak += 1;
    } else {
      break;
    }
  }

  const completedCount = settled.filter((entry) => entry.status === 'COMPLETED').length;

  return {
    currentStreak,
    bestStreak,
    completedCount,
    missedCount: settled.length - completedCount,
    pendingCount: sorted.length - settled.length,
    completionRate: settled.length === 0 ? 0 : completedCount / settled.length,
    hasData: settled.length > 0,
  };
}