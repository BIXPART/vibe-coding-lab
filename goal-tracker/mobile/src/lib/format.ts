/**
 * Formatação para exibição.
 *
 * ## Regra 7 em perigo: nunca `new Date('2026-10-04')`
 *
 * O backend devolve `periodStart`/`periodEnd` como **`YYYY-MM-DD`**, que é uma
 * data CIVIL — não um instante. `new Date('2026-10-04')` no JavaScript
 * interpreta isso como meia-noite **UTC**, que no Brasil é 21:00 do dia
 * ANTERIOR. O usuário veria "3 de out" numa meta de "4 de out".
 *
 * Por isso estas funções nunca passam a string para `new Date()`. Elas leem as
 * partes e montam a data local explicitamente. Mesma razão pela qual o backend
 * tem `utils/civil-date.ts`: é o tipo de bug que só aparece perto da meia-noite.
 */
import type { Frequency, OccurrenceStatus } from '@/types/api';

/** Quebra `YYYY-MM-DD` em números, sem criar `Date`. */
function parseCivil(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.split('-').map(Number);

  if (!year || !month || !day) {
    // dado inesperado da API: melhor falhar alto do que exibir "Invalid Date".
    throw new Error(`Data civil fora do formato esperado: "${date}"`);
  }

  return { year, month, day };
}

/** `2026-10-04` -> `04/10/2026`. Sem `Date`, sem fuso, sem surpresa. */
export function formatCivilShort(date: string): string {
  const { day, month, year } = parseCivil(date);
  return `${pad(day)}/${pad(month)}/${year}`;
}

/** `2026-10-04` -> `4 de out`. Curto o bastante para lista de histórico. */
export function formatCivilDayMonth(date: string): string {
  const { day, month } = parseCivil(date);
  return `${day} de ${MONTHS_SHORT[month - 1]}`;
}

const MONTHS_SHORT = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
] as const;

/**
 * Rótulo do período, para a tela de detalhe.
 *
 * Quando `start === end`, é um dia só (DAILY). Caso contrário, mostra o
 * intervalo (semana/mês) — quem decide o que é "semana" é o backend; aqui só
 * formatamos as duas pontas que ele mandou.
 */
export function formatPeriod(start: string, end: string): string {
  if (start === end) return formatCivilDayMonth(start);

  const from = parseCivil(start);
  const to = parseCivil(end);

  // Mesmo ano e mesmo mês: "6 - 12 de out".
  //
  // O dia inicial é o de `start`, NUNCA `1`. Só o MENU começa no dia 1; uma meta
  // SEMANAL de 6 a 12 de outubro existe, e hardcodar `1` faria a tela mentir
  // sobre o período inteiro (era o que acontecia).
  if (from.year === to.year && from.month === to.month) {
    return `${from.day} - ${to.day} de ${MONTHS_SHORT[from.month - 1]}`;
  }

  return `${formatCivilDayMonth(start)} - ${formatCivilDayMonth(end)}`;
}

const FREQUENCY_LABELS: Record<Frequency, string> = {
  DAILY: 'Diária',
  WEEKLY: 'Semanal',
  MONTHLY: 'Mensal',
};

export function frequencyLabel(frequency: Frequency): string {
  return FREQUENCY_LABELS[frequency];
}

const STATUS_LABELS: Record<OccurrenceStatus, string> = {
  PENDING: 'Pendente',
  COMPLETED: 'Concluída',
  MISSED: 'Perdida',
};

export function statusLabel(status: OccurrenceStatus): string {
  return STATUS_LABELS[status];
}

/**
 * `true` quando o registro de ocorrência não existia no banco e foi gerado
 * pelo backend para preencher a lacuna (o app não abriu naquele dia).
 *
 * A UI usa isso para diferenciar "você perdeu esse dia" de "esse dia nunca
 * existiu porque a meta começou depois".
 */
export function isFilledGap(persisted: boolean): boolean {
  return !persisted;
}

/**
 * Taxa de conclusão.
 *
 * `hasData === false` NÃO vira "0%" — a API §6 proíbe inventar número quando
 * não há períodos definidos. O chamador deve tratar `null`.
 */
export function formatRate(hasData: boolean, rate: number): string {
  if (!hasData) return '—';
  return `${Math.round(rate * 100)}%`;
}

/** Instante ISO -> texto local. Aqui `Date` é apropriado: é mesmo um instante. */
export function formatInstant(iso: string | null): string {
  if (!iso) return '—';

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}