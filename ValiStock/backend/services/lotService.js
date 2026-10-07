const { sequelize, Product, Lot, StockMovement } = require('../models');
const AppError = require('../utils/AppError');
const { getExpiryStatus, daysUntilExpiry } = require('../utils/validity');
const { registerMovement } = require('./stockService');

const withStatus = (lot) => {
  const json = lot.toJSON();
  json.status = getExpiryStatus(json.expires_at);
  return json;
};

/**
 * Lista lotes de um produto (ordenados pela validade mais próxima).
 */
const listByProduct = async (productId) => {
  const product = await Product.findByPk(productId);
  if (!product) {
    throw new AppError('Produto não encontrado', 404);
  }

  const lots = await Lot.findAll({
    where: { product_id: productId },
    order: [['expires_at', 'ASC']],
  });

  return lots.map(withStatus);
};

/**
 * Cria um lote para um produto e registra a movimentação ENTRY
 * na mesma transação (atomicidade).
 */
const create = async (productId, { lot_code, quantity, manufactured_at, expires_at }, userId = null) => {
  const product = await Product.findByPk(productId);
  if (!product) {
    throw new AppError('Produto não encontrado', 404);
  }

  if (!lot_code || !String(lot_code).trim()) {
    throw new AppError('O código do lote é obrigatório', 400);
  }

  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty <= 0) {
    throw new AppError('A quantidade deve ser um número inteiro maior que zero', 400);
  }

  if (!expires_at) {
    throw new AppError('A data de validade é obrigatória', 400);
  }

  if (manufactured_at && daysUntilExpiry(manufactured_at) > 0) {
    throw new AppError('A data de fabricação não pode estar no futuro', 400);
  }

  if (daysUntilExpiry(expires_at) < 0) {
    // Permite cadastrar lote já vencido? Regra de negócio: não — avisar.
    throw new AppError('A data de validade já passou', 400);
  }

  if (expires_at < manufactured_at) {
    throw new AppError('A validade não pode ser anterior à fabricação', 400);
  }

  const result = await sequelize.transaction(async (t) => {
    const lot = await Lot.create(
      {
        product_id: productId,
        lot_code: String(lot_code).trim(),
        quantity: 0,
        manufactured_at: manufactured_at || null,
        expires_at,
      },
      { transaction: t }
    );

    // Registra a entrada e atualiza a quantidade do lote
    await registerMovement({
      product_id: productId,
      lot_id: lot.id,
      type: 'ENTRY',
      quantity: qty,
      reason: 'Entrada de mercadoria - novo lote',
      user_id: userId,
      transaction: t,
    });

    await lot.reload({ transaction: t });
    return lot;
  });

  return withStatus(result);
};

/**
 * Busca um lote por ID.
 */
const getById = async (id) => {
  const lot = await Lot.findByPk(id, {
    include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'barcode'] }],
  });

  if (!lot) {
    throw new AppError('Lote não encontrado', 404);
  }

  return withStatus(lot);
};

/**
 * Atualiza dados do lote (código, datas).
 * Alterações de quantidade devem passar por movimentações.
 */
const update = async (id, { lot_code, manufactured_at, expires_at }) => {
  const lot = await Lot.findByPk(id);
  if (!lot) {
    throw new AppError('Lote não encontrado', 404);
  }

  if (lot_code !== undefined) {
    if (!String(lot_code).trim()) {
      throw new AppError('O código do lote é obrigatório', 400);
    }
    lot.lot_code = String(lot_code).trim();
  }

  if (expires_at !== undefined) {
    if (!expires_at) {
      throw new AppError('A data de validade é obrigatória', 400);
    }
    const mfg = manufactured_at !== undefined ? manufactured_at : lot.manufactured_at;
    if (mfg && expires_at < mfg) {
      throw new AppError('A validade não pode ser anterior à fabricação', 400);
    }
    lot.expires_at = expires_at;
  }

  if (manufactured_at !== undefined) {
    const exp = expires_at !== undefined ? expires_at : lot.expires_at;
    if (manufactured_at && manufactured_at > exp) {
      throw new AppError('A fabricação não pode ser posterior à validade', 400);
    }
    lot.manufactured_at = manufactured_at || null;
  }

  await lot.save();
  return withStatus(lot);
};

/**
 * Remove um lote.
 * Bloqueado se houver quantidade em estoque ou movimentações vinculadas.
 */
const remove = async (id) => {
  const lot = await Lot.findByPk(id);
  if (!lot) {
    throw new AppError('Lote não encontrado', 404);
  }

  if (lot.quantity > 0) {
    throw new AppError(
      'Não é possível excluir um lote com estoque. Registre a saída/perda primeiro.',
      409
    );
  }

  const movementCount = await StockMovement.count({
    where: { lot_id: id },
  });

  if (movementCount > 0) {
    // Mantém o histórico: apenas "zera" o lote não é possível sem apagar histórico.
    // Exclusão permitida apenas se o lote nunca teve movimentações.
    throw new AppError(
      'Não é possível excluir um lote com histórico de movimentações',
      409
    );
  }

  await lot.destroy();
};

module.exports = { listByProduct, create, getById, update, remove };
