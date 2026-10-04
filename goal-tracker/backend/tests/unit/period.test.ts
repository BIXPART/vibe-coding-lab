/**
 * Testes das regras de cálculo de período — o núcleo do projeto.
 *
 * Aqui não há banco, nem HTTP, nem relógio real: `now` é sempre um instante
 * fixo. Isso é proposital. Se o cálculo de "qual é o período atual" está
 * errado, o streak e o histórico também estão, e o usuário vê a meta do dia
 * errado.
 *
 * Cobre AI_NOTES.md §8: regras 4, 5, 6 e 7.
 */
import { describe, expect, it } from 'vitest';

import {
  addDays,
  civilToEpochMs,
  daysInMonth,
  formatCivilDate,
  isoWeekday,
  parseCivilDate,
  toCivilDate,
  type CivilDate,
} from '../../src/utils/civil-date.js';
import {
  enumeratePeriods,
  isPeriodFinished,
  nextPeriod,
  periodKey,
  previousPeriod,
  resolvePeriod,
  resolvePeriodForInstant,
} from '../../src/utils/period.js';

const SAO_PAULO = 'America/Sao_Paulo';
const TOKYO = 'Asia/Tokyo';
const LONDON = 'Europe/London';

const d = (year: number, month: number, day: number): CivilDate => ({ year, month, day });

describe('civilDate', () => {
  it('formata e faz parse no formato YYYY-MM-DD', () => {
    expect(formatCivilDate(d(2026, 10, 4))).toBe('2026-10-04');
    expect(parseCivilDate('2026-10-04')).toEqual(d(2026, 10, 4));
  });

  it('rejeita datas que não existem (2026-02-31)', () => {
    expect(() => parseCivilDate('2026-02-31')).toThrow();
    expect(() => parseCivilDate('2026-13-01')).toThrow();
    expect(() => parseCivilDate('04/10/2026')).toThrow();
  });

  it('conhece a quantidade de dias de cada mês', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29); // ano bissexto
    expect(daysInMonth(2026, 1)).toBe(31);
    expect(daysInMonth(2026, 4)).toBe(30);
  });

  it('calcula o dia da semana no padrão ISO (segunda=1, domingo=7)', () => {
    expect(isoWeekday(d(2026, 10, 5))).toBe(1); // segunda
    expect(isoWeekday(d(2026, 10, 4))).toBe(7); // domingo
  });

  it('avança e retrocede dias atravessando meses e anos', () => {
    expect(addDays(d(2026, 10, 31), 1)).toEqual(d(2026, 11, 1));
    expect(addDays(d(2026, 1, 1), -1)).toEqual(d(2025, 12, 31));
    // 2028-02-29 existe (bissexto).
    expect(addDays(d(2028, 2, 28), 1)).toEqual(d(2028, 2, 29));
  });
});

describe('conversão com fuso horário (regra 7)', () => {
  it('usa a data local do usuário, não a UTC', () => {
    // 2026-10-05T02:30Z ainda é 04/10 em São Paulo (UTC-3).
    const instant = new Date('2026-10-05T02:30:00Z');

    expect(formatCivilDate(toCivilDate(instant, SAO_PAULO))).toBe('2026-10-04');
    // Em UTC é dia 5; em Tóquio (UTC+9) também é dia 5, mas mais tarde.
    expect(formatCivilDate(toCivilDate(instant, 'UTC'))).toBe('2026-10-05');
    expect(formatCivilDate(toCivilDate(instant, TOKYO))).toBe('2026-10-05');
  });

  it('diferentes fusos podem discordar sobre qual é o dia atual', () => {
    // 23:30 em São Paulo = 02:30 do dia seguinte em Tóquio.
    const instant = new Date('2026-10-04T23:30:00-03:00');

    expect(formatCivilDate(toCivilDate(instant, SAO_PAULO))).toBe('2026-10-04');
    expect(formatCivilDate(toCivilDate(instant, TOKYO))).toBe('2026-10-05');
  });

  it('funciona em horário de verão sem quebrar o calendário', () => {
    // Reino Unido muda para BST em 29/03/2026 (UTC+1).
    const instant = new Date('2026-03-29T00:30:00Z');

    expect(formatCivilDate(toCivilDate(instant, LONDON))).toBe('2026-03-29');
  });

  it('rejeita fuso inválido', () => {
    expect(() => toCivilDate(new Date(), 'Mars/Phobos')).toThrow();
  });
});

describe('período DAILY (regra 4)', () => {
  it('uma ocorrência por dia', () => {
    const period = resolvePeriod('DAILY', d(2026, 10, 4));

    expect(period.start).toEqual(d(2026, 10, 4));
    expect(period.end).toEqual(d(2026, 10, 4));
    expect(periodKey(period)).toBe('2026-10-04');
  });

  it('períodos consecutivos não se sobrepõem', () => {
    const first = resolvePeriod('DAILY', d(2026, 10, 4));
    const second = nextPeriod(first);

    expect(periodKey(second)).toBe('2026-10-05');
    expect(civilToEpochMs(second.start) - civilToEpochMs(first.end)).toBe(86_400_000);
  });
});

describe('período WEEKLY (regra 5)', () => {
  it('semana vai de segunda a domingo (ISO 8601)', () => {
    // 04/10/2026 é domingo: a semana começou em 28/09.
    const period = resolvePeriod('WEEKLY', d(2026, 10, 4));

    expect(period.start).toEqual(d(2026, 9, 28));
    expect(period.end).toEqual(d(2026, 10, 4));
    expect(periodKey(period)).toBe('2026-09-28');
  });

  it('segunda e domingo da mesma semana caem no mesmo período', () => {
    const monday = resolvePeriod('WEEKLY', d(2026, 9, 28));
    const sunday = resolvePeriod('WEEKLY', d(2026, 10, 4));

    expect(periodKey(monday)).toBe(periodKey(sunday));
  });

  it('a segunda-feira seguinte já é outro período', () => {
    const thisWeek = resolvePeriod('WEEKLY', d(2026, 10, 4));
    const nextWeek = nextPeriod(thisWeek);

    expect(periodKey(nextWeek)).toBe('2026-10-05');
    expect(nextWeek.end).toEqual(d(2026, 10, 11));
  });

  it('atravessa a virada de ano', () => {
    // 31/12/2026 é quinta; a semana vai de 28/12 a 03/01/2027.
    const period = resolvePeriod('WEEKLY', d(2026, 12, 31));

    expect(period.start).toEqual(d(2026, 12, 28));
    expect(period.end).toEqual(d(2027, 1, 3));
  });
});

describe('período MONTHLY (regra 6)', () => {
  it('vai do primeiro ao último dia do mês', () => {
    const period = resolvePeriod('MONTHLY', d(2026, 10, 15));

    expect(period.start).toEqual(d(2026, 10, 1));
    expect(period.end).toEqual(d(2026, 10, 31));
  });

  it('fevereiro em ano bissexto tem 29 dias', () => {
    const period = resolvePeriod('MONTHLY', d(2028, 2, 10));

    expect(period.end).toEqual(d(2028, 2, 29));
  });

  it('todos os dias do mesmo mês caem no mesmo período', () => {
    const first = resolvePeriod('MONTHLY', d(2026, 10, 1));
    const last = resolvePeriod('MONTHLY', d(2026, 10, 31));

    expect(periodKey(first)).toBe(periodKey(last));
  });

  it('passa de dezembro para janeiro do ano seguinte', () => {
    const december = resolvePeriod('MONTHLY', d(2026, 12, 20));
    const january = nextPeriod(december);

    expect(periodKey(january)).toBe('2027-01-01');
  });
});

describe('período atual com instante e fuso', () => {
  it('uma meta diária muda de período à meia-noite local', () => {
    const antes = resolvePeriodForInstant('DAILY', new Date('2026-10-04T23:59:59-03:00'), SAO_PAULO);
    const depois = resolvePeriodForInstant('DAILY', new Date('2026-10-05T00:00:00-03:00'), SAO_PAULO);

    expect(periodKey(antes)).toBe('2026-10-04');
    expect(periodKey(depois)).toBe('2026-10-05');
    expect(periodKey(antes)).not.toBe(periodKey(depois));
  });

  it('o mesmo instante gera períodos diferentes em fusos diferentes', () => {
    const instant = new Date('2026-10-04T23:30:00-03:00');

    const emSaoPaulo = resolvePeriodForInstant('DAILY', instant, SAO_PAULO);
    const emToquio = resolvePeriodForInstant('DAILY', instant, TOKYO);

    expect(periodKey(emSaoPaulo)).toBe('2026-10-04');
    expect(periodKey(emToquio)).toBe('2026-10-05');
  });

  it('mensal ainda é o mesmo período no dia 1 antes da meia-noite', () => {
    // 31/10 23:00 em São Paulo; a meta mensal de outubro ainda vale.
    const instant = new Date('2026-10-31T23:00:00-03:00');
    const period = resolvePeriodForInstant('MONTHLY', instant, SAO_PAULO);

    expect(periodKey(period)).toBe('2026-10-01');
    expect(period.end).toEqual(d(2026, 10, 31));
  });
});

describe('isPeriodFinished', () => {
  const today = d(2026, 10, 4);

  it('período passado terminou', () => {
    expect(isPeriodFinished(resolvePeriod('DAILY', d(2026, 10, 3)), today)).toBe(true);
  });

  it('período atual ainda não terminou', () => {
    expect(isPeriodFinished(resolvePeriod('DAILY', today), today)).toBe(false);
  });

  it('período futuro não terminou', () => {
    expect(isPeriodFinished(resolvePeriod('DAILY', d(2026, 10, 5)), today)).toBe(false);
  });
});

describe('previousPeriod', () => {
  it('volta um dia, uma semana e um mês corretamente', () => {
    expect(periodKey(previousPeriod(resolvePeriod('DAILY', d(2026, 10, 4))))).toBe('2026-10-03');
    expect(periodKey(previousPeriod(resolvePeriod('WEEKLY', d(2026, 10, 4))))).toBe('2026-09-21');
    expect(periodKey(previousPeriod(resolvePeriod('MONTHLY', d(2026, 10, 4))))).toBe('2026-09-01');
  });

  it('volta de janeiro para dezembro do ano anterior', () => {
    expect(periodKey(previousPeriod(resolvePeriod('MONTHLY', d(2026, 1, 15))))).toBe('2025-12-01');
  });
});

describe('enumeratePeriods', () => {
  it('gera uma série contínua sem buracos (histórico completo)', () => {
    const periods = enumeratePeriods('DAILY', d(2026, 10, 1), d(2026, 10, 5));
    const keys = periods.map(periodKey);

    expect(keys).toEqual(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05']);
  });

  it('gera semanas completas ao atravessar meses', () => {
    const periods = enumeratePeriods('WEEKLY', d(2026, 9, 28), d(2026, 10, 11));

    expect(periods.map(periodKey)).toEqual(['2026-09-28', '2026-10-05']);
  });

  it('inclui o período parcial quando o intervalo começa no meio dele', () => {
    // 04/10 é domingo: a semana de 28/09 a 04/10 entra inteira.
    const periods = enumeratePeriods('WEEKLY', d(2026, 10, 4), d(2026, 10, 12));

    expect(periods.map(periodKey)).toEqual([
      '2026-09-28', // começou em 28/09 (antes do from) e contém o from
      '2026-10-05',
      '2026-10-12', // começa exatamente no `to`, então entra
    ]);
  });

  it('exclui um período que só começa depois do fim do intervalo', () => {
    // A semana de 12/10 não aparece: `to` é 11/10, um dia antes do início.
    const periods = enumeratePeriods('WEEKLY', d(2026, 10, 4), d(2026, 10, 11));

    expect(periods.map(periodKey)).toEqual(['2026-09-28', '2026-10-05']);
  });

  it('respeita o limite de períodos para não travar a API', () => {
    expect(() => enumeratePeriods('DAILY', d(2000, 1, 1), d(2026, 10, 4), 10)).toThrow(
      /limite/i,
    );
  });

  it('devolve lista vazia se "from" for posterior a "to"', () => {
    expect(enumeratePeriods('DAILY', d(2026, 10, 5), d(2026, 10, 1))).toEqual([]);
  });
});