const { Op } = require('sequelize');
const { sequelize, Product, Category, Lot, StockMovement } = require('../models');
const AppError = require('../utils/AppError');
const { getExpiryStatus, STATUS, daysUntilExpiry } = require('../utils/validity');

/**
 * Monta o objeto de resposta de um produto com totais calculados
 * a partir dos lotes (produto ≠ validade).
 */
const buildProductSummary = (product) => {
  const lots = product.lots || [];
  let totalQuantity = 0;
  let nearestExpiry = null;
  let nearestStatus = null;

  lots.forEach((lot) => {
    totalQuantity += lot.quantity;
    const status = getExpiryStatus(lot.expires_at);
    if (
      !nearestExpiry ||
      daysUntilExpiry(lot.expires_at) < daysUntilExpiry(nearestExpiry)
    ) {
      nearestExpiry = lot.expires_at;
      nearestStatus = status;
    }
  });

  return {
    id: product.id,
    barcode: product.barcode,
    name: product.name,
    brand: product.brand,
    active: product.active,
    category: product.category
      ? { id: product.category.id, name: product.category.name }
      : null,
    total_quantity: totalQuantity,
    lots_count: lots.length,
    nearest_expires_at: nearestExpiry,
    nearest_status: nearestStatus,
    created_at: product.created_at,
    updated_at: product.updated_at,
  };
};

/**
 * Lista produtos com busca (nome ou código de barras) e filtro de validade.
 *
 * Filtros: all | expired | urgent | up_to_7 | up_to_30 | normal
 */
const list = async ({ search, filter = 'all' } = {}) => {
  const where = { active: true };

  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { barcode: { [Op.like]: `%${search}%` } },
    ];
  }

  const products = await Product.findAll({
    where,
    include: [
      { model: Category, as: 'category', attributes: ['id', 'name'] },
      {
        model: Lot,
        as: 'lots',
        attributes: ['id', 'lot_code', 'quantity', 'expires_at'],
        required: false,
      },
    ],
    order: [['name', 'ASC']],
  });

  let summaries = products.map((product) => {
    const summary = buildProductSummary(product);
    // Mantém os lotes para o filtro de validade abaixo
    summary.lots = product.lots;
    return summary;
  });

  // Filtro de validade aplicado sobre os lotes de cada produto
  if (filter && filter !== 'all') {
    summaries = summaries
      .map((summary) => {
        const filteredLots = (summary.lots || []).filter((lot) => {
          const days = daysUntilExpiry(lot.expires_at);
          switch (filter) {
            case 'expired':
              return days < 0;
            case 'urgent':
              return days >= 0 && days <= 3;
            case 'up_to_7':
              return days >= 0 && days <= 7;
            case 'up_to_30':
              return days >= 0 && days <= 30;
            case 'normal':
              return days > 30;
            default:
              return true;
          }
        });

        if (filteredLots.length === 0) return null;

        const total = filteredLots.reduce((sum, l) => sum + l.quantity, 0);
        return {
          ...summary,
          filtered_lots_count: filteredLots.length,
          filtered_total_quantity: total,
        };
      })
      .filter(Boolean);
  }

  return summaries;
};

/**
 * Busca um produto por ID com lotes.
 */
const getById = async (id) => {
  const product = await Product.findOne({
    where: { id, active: true },
    include: [
      { model: Category, as: 'category', attributes: ['id', 'name'] },
      {
        model: Lot,
        as: 'lots',
        required: false,
        order: [['expires_at', 'ASC']],
      },
    ],
  });

  if (!product) {
    throw new AppError('Produto não encontrado', 404);
  }

  // Anexa status dinâmico a cada lote
  const lots = product.lots.map((lot) => {
    const lotJson = lot.toJSON();
    lotJson.status = getExpiryStatus(lot.expires_at);
    return lotJson;
  });

  // Ordena lotes do mais próximo ao mais distante
  lots.sort(
    (a, b) => daysUntilExpiry(a.expires_at) - daysUntilExpiry(b.expires_at)
  );

  const summary = buildProductSummary({ ...product.toJSON(), lots });

  return { ...summary, lots };
};

/**
 * Busca produto por código de barras.
 */
const getByBarcode = async (barcode) => {
  if (!barcode) {
    throw new AppError('Código de barras é obrigatório', 400);
  }

  const product = await Product.findOne({
    where: { barcode, active: true },
    include: [
      { model: Category, as: 'category', attributes: ['id', 'name'] },
      {
        model: Lot,
        as: 'lots',
        required: false,
        order: [['expires_at', 'ASC']],
      },
    ],
  });

  if (!product) {
    return null; // Scanner trata como "produto não cadastrado"
  }

  const lots = product.lots.map((lot) => {
    const lotJson = lot.toJSON();
    lotJson.status = getExpiryStatus(lot.expires_at);
    return lotJson;
  });

  lots.sort(
    (a, b) => daysUntilExpiry(a.expires_at) - daysUntilExpiry(b.expires_at)
  );

  const summary = buildProductSummary({ ...product.toJSON(), lots });

  return { ...summary, lots };
};

/**
 * Cria um produto.
 */
const create = async ({ barcode, name, brand, category_id }) => {
  if (!barcode || !String(barcode).trim()) {
    throw new AppError('O código de barras é obrigatório', 400);
  }
  if (!name || !name.trim()) {
    throw new AppError('O nome do produto é obrigatório', 400);
  }

  const existing = await Product.findOne({
    where: { barcode: String(barcode).trim() },
  });

  if (existing) {
    throw new AppError('Já existe um produto com este código de barras', 409);
  }

  if (category_id) {
    const category = await Category.findByPk(category_id);
    if (!category) {
      throw new AppError('Categoria não encontrada', 404);
    }
  }

  const product = await Product.create({
    barcode: String(barcode).trim(),
    name: name.trim(),
    brand: brand ? brand.trim() : null,
    category_id: category_id || null,
  });

  return getById(product.id);
};

/**
 * Atualiza um produto.
 */
const update = async (id, { barcode, name, brand, category_id, active }) => {
  const product = await Product.findByPk(id);
  if (!product) {
    throw new AppError('Produto não encontrado', 404);
  }

  if (barcode !== undefined) {
    const existing = await Product.findOne({
      where: { barcode: String(barcode).trim(), id: { [Op.ne]: id } },
    });
    if (existing) {
      throw new AppError('Já existe um produto com este código de barras', 409);
    }
    product.barcode = String(barcode).trim();
  }

  if (name !== undefined) {
    if (!name.trim()) {
      throw new AppError('O nome do produto é obrigatório', 400);
    }
    product.name = name.trim();
  }

  if (brand !== undefined) {
    product.brand = brand ? brand.trim() : null;
  }

  if (category_id !== undefined) {
    if (category_id) {
      const category = await Category.findByPk(category_id);
      if (!category) {
        throw new AppError('Categoria não encontrada', 404);
      }
    }
    product.category_id = category_id || null;
  }

  if (active !== undefined) {
    product.active = !!active;
  }

  await product.save();
  return getById(product.id);
};

/**
 * Exclui (desativa) um produto.
 * Soft delete: mantém histórico de movimentações.
 */
const remove = async (id) => {
  const product = await Product.findByPk(id);
  if (!product) {
    throw new AppError('Produto não encontrado', 404);
  }

  product.active = false;
  await product.save();
  return { id: product.id, active: false };
};

module.exports = {
  list,
  getById,
  getByBarcode,
  create,
  update,
  remove,
  buildProductSummary,
};
