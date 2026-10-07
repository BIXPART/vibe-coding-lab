/**
 * Testes de integração do núcleo de estoque (lotes + movimentações).
 * Usa o mesmo banco SQLite (ambiente de teste recria os registros).
 * Executar: npm test
 */
const test = require('node:test');
const assert = require('node:assert');

const { sequelize, Product, Lot, StockMovement, Category } = require('../models');
const stockService = require('../services/stockService');
const lotService = require('../services/lotService');

const futureDate = (days) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

test.before(async () => {
  await sequelize.authenticate();
});

test.after(async () => {
  // Limpa os registros de teste
  await StockMovement.destroy({ where: {} });
  await Lot.destroy({ where: {} });
  await Product.destroy({ where: {} });
  await Category.destroy({ where: {} });
  await sequelize.close();
});

let product;

test('criar produto de teste', async () => {
  product = await Product.create({
    barcode: 'TEST-001',
    name: 'Produto Teste',
    brand: 'Marca Teste',
  });
  assert.ok(product.id);
});

test('criar lote registra movimentação ENTRY automaticamente', async () => {
  const lot = await lotService.create(product.id, {
    lot_code: 'LT001',
    quantity: 50,
    manufactured_at: futureDate(-10),
    expires_at: futureDate(60),
  });

  assert.strictEqual(lot.quantity, 50);

  const movements = await StockMovement.findAll({
    where: { lot_id: lot.id, type: 'ENTRY' },
  });
  assert.strictEqual(movements.length, 1);
  assert.strictEqual(movements[0].quantity, 50);
});

test('rejeita lote com validade vencida', async () => {
  await assert.rejects(
    () =>
      lotService.create(product.id, {
        lot_code: 'LT-VENCIDO',
        quantity: 10,
        expires_at: futureDate(-1),
      }),
    /validade já passou/i
  );
});

test('rejeita lote com quantidade zero ou negativa', async () => {
  await assert.rejects(
    () =>
      lotService.create(product.id, {
        lot_code: 'LT-ZERO',
        quantity: 0,
        expires_at: futureDate(30),
      }),
    /maior que zero/i
  );
});

test('SALE reduz a quantidade do lote', async () => {
  const lot = await Lot.findOne({ where: { lot_code: 'LT001' } });

  await stockService.createMovement({
    product_id: product.id,
    lot_id: lot.id,
    type: 'SALE',
    quantity: 20,
    user_id: null,
  });

  await lot.reload();
  assert.strictEqual(lot.quantity, 30);
});

test('impede estoque negativo', async () => {
  const lot = await Lot.findOne({ where: { lot_code: 'LT001' } });

  await assert.rejects(
    () =>
      stockService.createMovement({
        product_id: product.id,
        lot_id: lot.id,
        type: 'SALE',
        quantity: 9999,
        user_id: null,
      }),
    /Estoque insuficiente/i
  );

  await lot.reload();
  assert.strictEqual(lot.quantity, 30, 'quantidade não deve mudar');
});

test('LOSS reduz a quantidade', async () => {
  const lot = await Lot.findOne({ where: { lot_code: 'LT001' } });

  await stockService.createMovement({
    product_id: product.id,
    lot_id: lot.id,
    type: 'LOSS',
    quantity: 5,
    reason: 'Produto danificado',
    user_id: null,
  });

  await lot.reload();
  assert.strictEqual(lot.quantity, 25);
});

test('ADJUSTMENT negativo reduz a quantidade', async () => {
  const lot = await Lot.findOne({ where: { lot_code: 'LT001' } });

  await stockService.createMovement({
    product_id: product.id,
    lot_id: lot.id,
    type: 'ADJUSTMENT',
    quantity: 3,
    signedQuantity: -3,
    user_id: null,
  });

  await lot.reload();
  assert.strictEqual(lot.quantity, 22);
});

test('ADJUSTMENT positivo aumenta a quantidade', async () => {
  const lot = await Lot.findOne({ where: { lot_code: 'LT001' } });

  await stockService.createMovement({
    product_id: product.id,
    lot_id: lot.id,
    type: 'ADJUSTMENT',
    quantity: 2,
    signedQuantity: 2,
    user_id: null,
  });

  await lot.reload();
  assert.strictEqual(lot.quantity, 24);
});

test('cada operação gera uma movimentação no histórico', async () => {
  const lot = await Lot.findOne({ where: { lot_code: 'LT001' } });

  const movements = await StockMovement.findAll({
    where: { lot_id: lot.id },
  });

  // 1 ENTRY (criação) + 1 SALE + 1 LOSS + 2 ADJUSTMENT
  assert.strictEqual(movements.length, 5);
});

test('remover lote com estoque é bloqueado', async () => {
  const lot = await Lot.findOne({ where: { lot_code: 'LT001' } });

  await assert.rejects(() => lotService.remove(lot.id), /estoque/i);
});
