const { Product, Lot, StockMovement, Category, User } = require('../models');
const { getExpiryStatus, daysUntilExpiry } = require('../utils/validity');

/**
 * Dashboard com indicadores gerais e lista de lotes mais urgentes.
 * Todos os cálculos são dinâmicos (baseados na data atual).
 */
const getDashboard = async () => {
  const [productsCount, categoriesCount, usersCount] = await Promise.all([
    Product.count({ where: { active: true } }),
    Category.count(),
    User.count({ where: { active: true } }),
  ]);

  const lots = await Lot.findAll({
    include: [
      {
        model: Product,
        as: 'product',
        attributes: ['id', 'name', 'barcode', 'brand'],
        where: { active: true },
      },
    ],
  });

  let totalUnits = 0;
  let expiredCount = 0;
  let expiredUnits = 0;
  let urgent3 = 0;
  let urgent3Units = 0;
  let attention7 = 0;
  let attention7Units = 0;
  let upcoming30 = 0;
  let upcoming30Units = 0;

  const expiringLots = [];

  lots.forEach((lot) => {
    const days = daysUntilExpiry(lot.expires_at);
    totalUnits += lot.quantity;

    if (days < 0) {
      expiredCount += 1;
      expiredUnits += lot.quantity;
    } else if (days <= 3) {
      urgent3 += 1;
      urgent3Units += lot.quantity;
    } else if (days <= 7) {
      attention7 += 1;
      attention7Units += lot.quantity;
    } else if (days <= 30) {
      upcoming30 += 1;
      upcoming30Units += lot.quantity;
    }

    // Lotes vencidos ou vencendo em até 30 dias entram na lista de urgentes
    if (days <= 30) {
      const status = getExpiryStatus(lot.expires_at);
      expiringLots.push({
        lot_id: lot.id,
        lot_code: lot.lot_code,
        quantity: lot.quantity,
        expires_at: lot.expires_at,
        days,
        status,
        product: lot.product,
      });
    }
  });

  // Ordena do mais próximo (mais urgente) para o mais distante
  expiringLots.sort((a, b) => a.days - b.days);

  return {
    indicators: {
      products: productsCount,
      categories: categoriesCount,
      users: usersCount,
      total_units: totalUnits,
      lots_total: lots.length,
      lots_expired: expiredCount,
      expired_units: expiredUnits,
      lots_expiring_3_days: urgent3,
      expiring_3_days_units: urgent3Units,
      lots_expiring_7_days: attention7,
      expiring_7_days_units: attention7Units,
      lots_expiring_30_days: upcoming30,
      expiring_30_days_units: upcoming30Units,
    },
    urgent: expiringLots.slice(0, 20),
  };
};

module.exports = { getDashboard };
