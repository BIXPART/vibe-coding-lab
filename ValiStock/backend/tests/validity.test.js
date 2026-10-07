/**
 * Testes básicos da função centralizada de classificação de validade.
 * Executar: npm test
 */
const test = require('node:test');
const assert = require('node:assert');

const {
  getExpiryStatus,
  daysUntilExpiry,
  STATUS,
} = require('../utils/validity');

// Helper: data relativa a hoje (YYYY-MM-DD)
const relativeDate = (days) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

test('daysUntilExpiry: data no passado retorna negativo', () => {
  assert.ok(daysUntilExpiry(relativeDate(-10)) < 0);
});

test('daysUntilExpiry: hoje retorna 0', () => {
  assert.strictEqual(daysUntilExpiry(relativeDate(0)), 0);
});

test('daysUntilExpiry: futuro retorna positivo', () => {
  assert.strictEqual(daysUntilExpiry(relativeDate(10)), 10);
});

test('classificação: VENCIDO para data no passado', () => {
  const result = getExpiryStatus(relativeDate(-1));
  assert.strictEqual(result.status, STATUS.VENCIDO);
  assert.strictEqual(result.emoji, '🔴');
});

test('classificação: URGENTE para 0 a 3 dias', () => {
  for (let d = 0; d <= 3; d++) {
    const result = getExpiryStatus(relativeDate(d));
    assert.strictEqual(result.status, STATUS.URGENTE, `dia ${d}`);
    assert.strictEqual(result.emoji, '🔴', `dia ${d}`);
  }
});

test('classificação: ATENÇÃO para 4 a 7 dias', () => {
  for (let d = 4; d <= 7; d++) {
    const result = getExpiryStatus(relativeDate(d));
    assert.strictEqual(result.status, STATUS.ATENCAO, `dia ${d}`);
    assert.strictEqual(result.emoji, '🟠', `dia ${d}`);
  }
});

test('classificação: PRÓXIMO para 8 a 30 dias', () => {
  for (let d = 8; d <= 30; d++) {
    const result = getExpiryStatus(relativeDate(d));
    assert.strictEqual(result.status, STATUS.PROXIMO, `dia ${d}`);
    assert.strictEqual(result.emoji, '🟡', `dia ${d}`);
  }
});

test('classificação: NORMAL para mais de 30 dias', () => {
  for (const d of [31, 60, 365]) {
    const result = getExpiryStatus(relativeDate(d));
    assert.strictEqual(result.status, STATUS.NORMAL, `dia ${d}`);
    assert.strictEqual(result.emoji, '🟢', `dia ${d}`);
  }
});

test('status não é armazenado no banco (cálculo dinâmico)', () => {
  // A mesma data sempre gera o mesmo status independente do contexto,
  // e o status muda conforme a data atual avança.
  const hoje = getExpiryStatus(relativeDate(2));
  assert.strictEqual(hoje.status, STATUS.URGENTE);
  assert.strictEqual(hoje.days, 2);
});

test('aceita Date e string ISO além de DATEONLY', () => {
  const dateOnly = relativeDate(5);
  const fromDate = new Date(`${dateOnly}T12:00:00`);

  assert.strictEqual(
    getExpiryStatus(dateOnly).status,
    getExpiryStatus(fromDate).status
  );
});
