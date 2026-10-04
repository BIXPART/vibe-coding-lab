/**
 * Datas civis (calendários) independentes de fuso horário.
 *
 * ## Por que existe este arquivo
 *
 * Uma "data civil" é o ano/mês/dia que o usuário VEVE no calendário dele.
 * `new Date()` não serve para isso: `new Date('2026-10-04')` é interpretado
 * como UTC e pode virar dia 03/10 dependendo do fuso da máquina.
 *
 * A regra de negócio 7 do AI_NOTES.md exige que o período considere o fuso do
 * usuário. A estratégia aqui é:
 *
 *   1.Converter um instante (Date) em data civil no fuso desejado, via `Intl`.
 *   2. Fazer toda a aritmética de período sobre datas civis, em UTC "falso".
 *
 * O passo 2 nunca sofre com horário de verão, porque não existe conversão
 * entre fusos: só aritmética de calendário.
 *
 * Não usamos date-fns/date-fns-tz de propósito. `Intl` já faz parte da
 * plataforma e a lógica fica explícita e testável.
 */

/** Ano/mês/dia, sem hora e sem fuso. `month` vai de 1 a 12. */
export interface CivilDate {
  year: number;
  month: number;
  day: number;
}

const WEEKDAY_TO_ISO: Record<string, number> = {
  Sun: 7,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });

  formatterCache.set(timeZone, formatter);
  return formatter;
}

/**
 * Verifica se o identificador é um fuso IANA válido.
 * `Intl.DateTimeFormat` lança RangeError para fusos inexistentes.
 */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Converte um instante em data civil no fuso informado.
 * Ex.: 2026-10-05T02:30Z em `America/Sao_Paulo` => 2026-10-04.
 */
export function toCivilDate(instant: Date, timeZone: string): CivilDate {
  const parts = getFormatter(timeZone).formatToParts(instant);

  let year = 0;
  let month = 0;
  let day = 0;
  let weekday = 0;

  for (const part of parts) {
    switch (part.type) {
      case 'year':
        year = Number(part.value);
        break;
      case 'month':
        month = Number(part.value);
        break;
      case 'day':
        day = Number(part.value);
        break;
      case 'weekday':
        weekday = WEEKDAY_TO_ISO[part.value] ?? 0;
        break;
      default:
        break;
    }
  }

  return { year, month, day };
}

/** Dia da semana no padrão ISO 8601: segunda=1 ... domingo=7. */
export function isoWeekday(date: CivilDate): number {
  return isoWeekdayFromEpochMs(civilToEpochMs(date));
}

function isoWeekdayFromEpochMs(epochMs: number): number {
  // 1970-01-01 foi uma quinta-feira (ISO 4).
  const daysSinceEpoch = Math.floor(epochMs / 86_400_000);
  return ((daysSinceEpoch + 3) % 7) + 1;
}

/**
 * Converte data civil para um instante-usado-como-relógio.
 * Usamos UTC apenas como forma de aritmética: o valor NUNCA representa um
 * momento real na linha do tempo.
 */
export function civilToEpochMs(date: CivilDate): number {
  return Date.UTC(date.year, date.month - 1, date.day);
}

/** Inverso de `civilToEpochMs`. */
export function epochMsToCivil(epochMs: number): CivilDate {
  const d = new Date(epochMs);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** `2026-10-04`. É a forma canônica de guardar e comparar períodos. */
export function formatCivilDate(date: CivilDate): string {
  const mm = String(date.month).padStart(2, '0');
  const dd = String(date.day).padStart(2, '0');
  return `${String(date.year).padStart(4, '0')}-${mm}-${dd}`;
}

/**
 * Lê `YYYY-MM-DD` de forma estrita.
 * Evita `new Date(string)`, que interpretaria a string como UTC.
 */
export function parseCivilDate(value: string): CivilDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`Data civil inválida: "${value}". Use o formato YYYY-MM-DD.`);
  }

  const parsed: CivilDate = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };

  // Rejeita overflow: 2026-02-31 não existe (fevereiro tem 28/29).
  // Comparar apenas o formato não bastaria, pois "2026-02-31" tem o formato certo.
  if (!isValidCivilDate(parsed)) {
    throw new Error(`Data civil inexistente: "${value}".`);
  }

  return parsed;
}

export function addDays(date: CivilDate, amount: number): CivilDate {
  return epochMsToCivil(civilToEpochMs(date) + amount * 86_400_000);
}

export function addMonths(date: CivilDate, amount: number): CivilDate {
  const totalMonths = (date.year * 12 + (date.month - 1)) + amount;
  const year = Math.floor(totalMonths / 12);
  const month = (totalMonths % 12) + 1;
  // Dia é preservado; o chamador ajusta se o mês for mais curto.
  return { year, month, day: date.day };
}

/** Retorna -1, 0 ou 1. */
export function compareCivilDates(a: CivilDate, b: CivilDate): number {
  if (a.year !== b.year) return a.year < b.year ? -1 : 1;
  if (a.month !== b.month) return a.month < b.month ? -1 : 1;
  if (a.day !== b.day) return a.day < b.day ? -1 : 1;
  return 0;
}

export function isValidCivilDate(date: CivilDate): boolean {
  if (date.month < 1 || date.month > 12) return false;
  if (date.day < 1) return false;
  return date.day <= daysInMonth(date.year, date.month);
}

/** Quantos dias o mês tem. Também cobre ano bissexto. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isValidCivilDateString(value: string): boolean {
  try {
    parseCivilDate(value);
    return true;
  } catch {
    return false;
  }
}