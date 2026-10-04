/**
 * Testes do cálculo de streaks e taxas.
 *
 * Cobre a exigência da AI_NOTES.md §6: o histórico deve permitir descobrir
 * sequências e taxa de conclusão, e "não criar estatísticas falsas quando ainda
 * não houver dados suficientes".
 */
import { describe, expect, it } from 'vitest';

import { calculateStreaks, type StreakEntry } from '../../src/utils/streak.js';

const entry = (periodStart: string, status: StreakEntry['status']): StreakEntry => ({
  periodStart,
  status,
});

describe('calculateStreaks', () => {
  it('sinaliza que não há dados suficientes para gerar estatísticas', () => {
    const result = calculateStreaks([]);

    expect(result.hasData).toBe(false);
    expect(result.currentStreak).toBe(0);
    expect(result.bestStreak).toBe(0);
    expect(result.completionRate).toBe(0);
  });

  it('não trata o período em aberto como quebra de sequência', () => {
    // Ontem e anteontem concluídos; hoje ainda está pendente.
    const result = calculateStreaks([
      entry('2026-10-03', 'COMPLETED'),
      entry('2026-10-04', 'COMPLETED'),
      entry('2026-10-05', 'PENDING'),
    ]);

    expect(result.currentStreak).toBe(2);
    expect(result.bestStreak).toBe(2);
    expect(result.pendingCount).toBe(1);
    expect(result.hasData).toBe(true);
  });

  it('conta a sequência atual e a melhor sequência corretamente', () => {
    const result = calculateStreaks([
      entry('2026-10-01', 'COMPLETED'),
      entry('2026-10-02', 'COMPLETED'),
      entry('2026-10-03', 'COMPLETED'),
      entry('2026-10-04', 'MISSED'),
      entry('2026-10-05', 'COMPLETED'),
    ]);

    expect(result.bestStreak).toBe(3);
    expect(result.currentStreak).toBe(1);
  });

  it('zera a sequência atual quando o último período foi perdido', () => {
    const result = calculateStreaks([
      entry('2026-10-01', 'COMPLETED'),
      entry('2026-10-02', 'COMPLETED'),
      entry('2026-10-03', 'MISSED'),
    ]);

    expect(result.currentStreak).toBe(0);
    // A melhor sequência continua existindo no histórico.
    expect(result.bestStreak).toBe(2);
  });

  it('calcula a taxa de conclusão só sobre períodos definidos', () => {
    const result = calculateStreaks([
      entry('2026-10-01', 'COMPLETED'),
      entry('2026-10-02', 'COMPLETED'),
      entry('2026-10-03', 'MISSED'),
      entry('2026-10-04', 'COMPLETED'),
      entry('2026-10-05', 'PENDING'),
    ]);

    // 3 concluídos de 4 definidos (o PENDING não conta).
    expect(result.completionRate).toBeCloseTo(0.75, 5);
    expect(result.completedCount).toBe(3);
    expect(result.missedCount).toBe(1);
  });

  it('desordena a entrada antes de calcular', () => {
    const resultado = calculateStreaks([
      entry('2026-10-04', 'COMPLETED'),
      entry('2026-10-01', 'COMPLETED'),
      entry('2026-10-03', 'COMPLETED'),
      entry('2026-10-02', 'COMPLETED'),
    ]);

    expect(resultado.currentStreak).toBe(4);
    expect(resultado.bestStreak).toBe(4);
  });

  it('não altera o array recebido', () => {
    const original = [entry('2026-10-02', 'COMPLETED'), entry('2026-10-01', 'COMPLETED')];
    const copia = [...original];

    calculateStreaks(original);

    expect(original).toEqual(copia);
  });

  it('uma semana perdida também quebra a sequência', () => {
    const result = calculateStreaks([
      entry('2026-09-14', 'COMPLETED'),
      entry('2026-09-21', 'COMPLETED'),
      entry('2026-09-28', 'MISSED'),
      entry('2026-10-05', 'COMPLETED'),
    ]);

    expect(result.currentStreak).toBe(1);
    expect(result.bestStreak).toBe(2);
  });
});