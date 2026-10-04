/**
 * Regra fundamental de recorrência (AI_NOTES.md §5).
 *
 * O estado "concluída" pertence a uma OCORRÊNCIA (meta + período), nunca à meta.
 * Este arquivo é a única fonte de verdade sobre "qual é o período atual" e é
 * propositalmente uma função pura: sem banco, sem rede, sem Date implícito.
 * Isso permite testar as regras mais críticas do projeto de forma rápida.
 *
 * Convenções:
 * - DAILY  : período = um dia civil
 * - WEEKLY : período = semana ISO 8601 (segunda a domingo)
 * - MONTHLY: período = mês civil
 *
 * A chave única de um período é sempre `formatCivilDate(period.start)`,
 * combinada com `goal_id` em uma restrição UNIQUE no banco (regra 1).
 */
import {
  addDays,
  addMonths,
  compareCivilDates,
  daysInMonth,
  formatCivilDate,
  isoWeekday,
  toCivilDate,
  type CivilDate,
} from './civil-date.js';

export const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY'] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export interface Period {
  frequency: Frequency;
  /** Primeiro dia do período (inclusivo). */
  start: CivilDate;
  /** Último dia do período (inclusivo). */
  end: CivilDate;
}

export function isFrequency(value: unknown): value is Frequency {
  return typeof value === 'string' && (FREQUENCIES as readonly string[]).includes(value);
}

/**
 * Resolve o período que contém a data civil informada.
 * A data pode estar em qualquer dia dentro do período.
 */
export function resolvePeriod(frequency: Frequency, date: CivilDate): Period {
  switch (frequency) {
    case 'DAILY':
      return { frequency, start: date, end: date };

    case 'WEEKLY': {
      // ISO 8601: semana começa na segunda (1) e termina no domingo (7).
      const weekday = isoWeekday(date);
      const start = addDays(date, -(weekday - 1));
      return { frequency, start, end: addDays(start, 6) };
    }

    case 'MONTHLY': {
      const start: CivilDate = { year: date.year, month: date.month, day: 1 };
      const end: CivilDate = {
        year: date.year,
        month: date.month,
        day: daysInMonth(date.year, date.month),
      };
      return { frequency, start, end };
    }

    default: {
      const exhaustive: never = frequency;
      throw new Error(`Frequência não suportada: ${String(exhaustive)}`);
    }
  }
}

/**
 * Período atual de uma meta, no fuso do usuário.
 * Regra 7: o cálculo respeita o fuso horário do usuário.
 */
export function resolvePeriodForInstant(
  frequency: Frequency,
  instant: Date,
  timeZone: string,
): Period {
  return resolvePeriod(frequency, toCivilDate(instant, timeZone));
}

/** Chave canônica do período (`YYYY-MM-DD` do início). */
export function periodKey(period: Period): string {
  return formatCivilDate(period.start);
}

/** O período termina antes do início de `reference`? */
export function isPeriodFinished(period: Period, reference: CivilDate): boolean {
  return compareCivilDates(period.end, reference) < 0;
}

/** O período começou depois do fim de `reference`? */
export function isPeriodFuture(period: Period, reference: CivilDate): boolean {
  return compareCivilDates(period.start, reference) > 0;
}

/** O período contém a data civil informada? */
export function containsCivilDate(period: Period, date: CivilDate): boolean {
  return (
    compareCivilDates(period.start, date) <= 0 && compareCivilDates(period.end, date) >= 0
  );
}

/**
 * Avança um período. Weekly ignora meses, então um "próximo mês" semanal pode
 * ser calculado com addDays(7) — mais simples e sempre correto.
 */
export function nextPeriod(period: Period): Period {
  switch (period.frequency) {
    case 'DAILY':
      return resolvePeriod('DAILY', addDays(period.end, 1));
    case 'WEEKLY':
      return resolvePeriod('WEEKLY', addDays(period.end, 1));
    case 'MONTHLY':
      return resolvePeriod('MONTHLY', addMonths(period.end, 1));
    default: {
      const exhaustive: never = period.frequency;
      throw new Error(`Frequência não suportada: ${String(exhaustive)}`);
    }
  }
}

export function previousPeriod(period: Period): Period {
  switch (period.frequency) {
    case 'DAILY':
      return resolvePeriod('DAILY', addDays(period.start, -1));
    case 'WEEKLY':
      return resolvePeriod('WEEKLY', addDays(period.start, -7));
    case 'MONTHLY':
      return resolvePeriod('MONTHLY', addMonths(period.start, -1));
    default: {
      const exhaustive: never = period.frequency;
      throw new Error(`Frequência não suportada: ${String(exhaustive)}`);
    }
  }
}

/**
 * Gera todos os períodos entre `from` e `to`, inclusive.
 *
 * Serve para dois casos reais:
 * - preencher lacunas do histórico (o usuário não abriu o app em 3 dias);
 * - gerar uma série contínua para o dashboard sem "estatísticas falsas"
 *   (AI_NOTES.md §6).
 *
 * O limite de segurança evita travar a API com um intervalo gigante.
 */
export function enumeratePeriods(
  frequency: Frequency,
  from: CivilDate,
  to: CivilDate,
  maxPeriods = 2000,
): Period[] {
  if (compareCivilDates(from, to) > 0) return [];

  const periods: Period[] = [];
  let cursor = resolvePeriod(frequency, from);

  while (compareCivilDates(cursor.start, to) <= 0) {
    periods.push(cursor);

    if (periods.length >= maxPeriods) {
      throw new Error(
        `Intervalo excedeu o limite de ${maxPeriods} períodos. Reduza o intervalo.`,
      );
    }

    cursor = nextPeriod(cursor);
  }

  return periods;
}

/**
 * Encontra o período que contém a data, dentro de uma lista já ordenada.
 */
export function findPeriodForDate(periods: Period[], date: CivilDate): Period | undefined {
  return periods.find((period) => containsCivilDate(period, date));
}