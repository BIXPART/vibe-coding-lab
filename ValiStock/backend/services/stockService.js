const { sequelize, StockMovement, Product, Lot, User } = require('../models');
const AppError = require('../utils/AppError');

/**
 * Regras de estoque por tipo de movimentação:
 * - ENTRY:        entrada (+) — sempre permitida
 * - SALE:         saída (-) — não pode deixar estoque negativo
 * - LOSS:         perda (-) — não pode deixar estoque negativo
 * - ADJUSTMENT:   ajuste (+ ou -) — não pode deixar estoque negativo
 * - EXPIRATION:   vencimento (-) — não pode deixar estoque negativo
 */
const MOVEMENT_RULES = {
  ENTRY: { direction: 'IN' },
  SALE: { direction: 'OUT' },
  LOSS: { direction: 'OUT' },
  EXPIRATION: { direction: 'OUT' },
  ADJUSTMENT: { direction: 'BOTH' },
};

/**
 * Registra uma movimentação de estoque e atualiza a quantidade do lote
 * dentro de UMA transação (atomicidade).
 *
 * @param {Object} params
 * @param {number} params.product_id
 * @param {number|null} params.lot_id
 * @param {string} params.type - ENTRY | SALE | LOSS | ADJUSTMENT | EXPIRATION
 * @param {number} params.quantity - sempre positivo; o sinal é definido pela regra
 * @param {number|null} params.signedQuantity - para ADJUSTMENT, pode ser negativo
 * @param {string|null} params.reason
 * @param {number|null} params.user_id
 * @param {Object|null} params.transaction
 */
const registerMovement = async ({
  product_id,
  lot_id,
  type,
  quantity,
  signedQuantity = null,
  reason = null,
  user_id = null,
  transaction = null,
}) => {
  const rule = MOVEMENT_RULES[type];
  if (!rule) {
    throw new AppError('Tipo de movimentação inválido', 400);
  }

  if (!quantity || quantity <= 0) {
    throw new AppError('A quantidade deve ser maior que zero', 400);
  }

  // Define a variação aplicada ao lote
  let delta;
  if (type === 'ADJUSTMENT') {
    if (signedQuantity === null) {
      throw new AppError('Ajuste requer signedQuantity (pode ser negativo)', 400);
    }
    delta = signedQuantity;
  } else if (rule.direction === 'IN') {
    delta = quantity;
  } else {
    delta = -quantity;
  }

  const lot = await Lot.findByPk(lot_id, { transaction });
  if (!lot) {
    throw new AppError('Lote não encontrado', 404);
  }

  if (Number(lot.product_id) !== Number(product_id)) {
    throw new AppError('Lote não pertence a este produto', 400);
  }

  const newQuantity = lot.quantity + delta;

  if (newQuantity < 0) {
    throw new AppError(
      `Estoque insuficiente no lote ${lot.lot_code}. Disponível: ${lot.quantity}`,
      400
    );
  }

  // Atualiza a quantidade do lote
  lot.quantity = newQuantity;
  await lot.save({ transaction });

  // Registra a movimentação no histórico
  const movement = await StockMovement.create(
    {
      product_id,
      lot_id,
      type,
      quantity,
      reason,
      user_id,
    },
    { transaction }
  );

  return { movement, lot };
};

/**
 * Cria uma movimentação de estoque com transação própria.
 */
const createMovement = async (params) => {
  return sequelize.transaction(async (t) => {
    const result = await registerMovement({ ...params, transaction: t });
    return result.movement;
  });
};

/**
 * Lista movimentações com filtros opcionais.
 */
const listMovements = async ({
  product_id,
  lot_id,
  type,
  limit = 100,
  offset = 0,
} = {}) => {
  const where = {};
  if (product_id) where.product_id = product_id;
  if (lot_id) where.lot_id = lot_id;
  if (type) where.type = type;

  const { count, rows } = await StockMovement.findAndCountAll({
    where,
    include: [
      { model: Product, as: 'product', attributes: ['id', 'name', 'barcode'] },
      { model: Lot, as: 'lot', attributes: ['id', 'lot_code'] },
      { model: User, as: 'user', attributes: ['id', 'name'] },
    ],
    order: [['created_at', 'DESC']],
    limit: Number(limit),
    offset: Number(offset),
  });

  return { total: count, movements: rows };
};

module.exports = {
  registerMovement,
  createMovement,
  listMovements,
  MOVEMENT_RULES,
};
