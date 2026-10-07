const stockService = require('../services/stockService');
const { Product, Lot } = require('../models');
const AppError = require('../utils/AppError');
const { getExpiryStatus, daysUntilExpiry, STATUS } = require('../utils/validity');

/**
 * POST /api/stock/movements
 * Registra uma movimentação (ENTRY, SALE, LOSS, ADJUSTMENT, EXPIRATION).
 */
const createMovement = async (req, res, next) => {
  try {
    const { product_id, lot_id, type, quantity, signed_quantity, reason } = req.body;

    if (!product_id || !lot_id || !type) {
      throw new AppError('product_id, lot_id e type são obrigatórios', 400);
    }

    const movement = await stockService.createMovement({
      product_id,
      lot_id,
      type,
      quantity: Number(quantity),
      signedQuantity: signed_quantity !== undefined ? Number(signed_quantity) : null,
      reason: reason || null,
      user_id: req.user ? req.user.id : null,
    });

    res.status(201).json({ success: true, data: movement });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/stock/movements
 * Lista o histórico de movimentações.
 */
const listMovements = async (req, res, next) => {
  try {
    const { product_id, lot_id, type, limit, offset } = req.query;
    const result = await stockService.listMovements({
      product_id,
      lot_id,
      type,
      limit,
      offset,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/stock
 * Visão geral do estoque: produtos com totais e situação dos lotes.
 */
const getStock = async (req, res, next) => {
  try {
    const products = await Product.findAll({
      where: { active: true },
      include: [
        {
          model: Lot,
          as: 'lots',
          required: false,
          order: [['expires_at', 'ASC']],
        },
      ],
      order: [['name', 'ASC']],
    });

    const data = products.map((product) => {
      const lots = product.lots.map((lot) => {
        const json = lot.toJSON();
        json.status = getExpiryStatus(json.expires_at);
        return json;
      });

      const total = lots.reduce((sum, l) => sum + l.quantity, 0);
      const nearest = lots.length ? lots[0] : null;

      return {
        id: product.id,
        barcode: product.barcode,
        name: product.name,
        brand: product.brand,
        total_quantity: total,
        lots_count: lots.length,
        nearest_expires_at: nearest ? nearest.expires_at : null,
        nearest_status: nearest ? nearest.status : null,
        lots,
      };
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/stock/expiring?days=3
 * Lotes vencendo dentro do período informado (padrão 7 dias).
 */
const getExpiring = async (req, res, next) => {
  try {
    const days = Number(req.query.days) || 7;

    const lots = await Lot.findAll({
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'barcode', 'brand'],
          where: { active: true },
        },
      ],
      order: [['expires_at', 'ASC']],
    });

    const filtered = lots
      .map((lot) => {
        const json = lot.toJSON();
        json.status = getExpiryStatus(json.expires_at);
        json.days = json.status.days;
        return json;
      })
      .filter((lot) => lot.days >= 0 && lot.days <= days);

    res.status(200).json({ success: true, data: filtered });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/stock/expired
 * Lotes já vencidos.
 */
const getExpired = async (req, res, next) => {
  try {
    const lots = await Lot.findAll({
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'barcode', 'brand'],
          where: { active: true },
        },
      ],
      order: [['expires_at', 'ASC']],
    });

    const filtered = lots
      .map((lot) => {
        const json = lot.toJSON();
        json.status = getExpiryStatus(json.expires_at);
        json.days = json.status.days;
        return json;
      })
      .filter((lot) => lot.days < 0);

    res.status(200).json({ success: true, data: filtered });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createMovement,
  listMovements,
  getStock,
  getExpiring,
  getExpired,
};
