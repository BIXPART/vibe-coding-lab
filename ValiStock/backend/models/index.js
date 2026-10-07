/**
 * Central de models e associations do Sequelize.
 * Relacionamentos:
 * - Category 1:N Product
 * - Product 1:N Lot
 * - Product 1:N StockMovement
 * - Lot 1:N StockMovement
 * - User 1:N StockMovement
 */
const { sequelize, Sequelize } = require('../config/database');

const User = require('./User');
const Category = require('./Category');
const Product = require('./Product');
const Lot = require('./Lot');
const StockMovement = require('./StockMovement');

// Category 1:N Product
Category.hasMany(Product, {
  foreignKey: 'category_id',
  as: 'products',
  onDelete: 'SET NULL',
});
Product.belongsTo(Category, {
  foreignKey: 'category_id',
  as: 'category',
});

// Product 1:N Lot
Product.hasMany(Lot, {
  foreignKey: 'product_id',
  as: 'lots',
  onDelete: 'CASCADE',
});
Lot.belongsTo(Product, {
  foreignKey: 'product_id',
  as: 'product',
});

// Product 1:N StockMovement
Product.hasMany(StockMovement, {
  foreignKey: 'product_id',
  as: 'movements',
  onDelete: 'CASCADE',
});
StockMovement.belongsTo(Product, {
  foreignKey: 'product_id',
  as: 'product',
});

// Lot 1:N StockMovement
Lot.hasMany(StockMovement, {
  foreignKey: 'lot_id',
  as: 'movements',
  onDelete: 'SET NULL',
});
StockMovement.belongsTo(Lot, {
  foreignKey: 'lot_id',
  as: 'lot',
});

// User 1:N StockMovement
User.hasMany(StockMovement, {
  foreignKey: 'user_id',
  as: 'movements',
  onDelete: 'SET NULL',
});
StockMovement.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

module.exports = {
  sequelize,
  Sequelize,
  User,
  Category,
  Product,
  Lot,
  StockMovement,
};
