const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TYPES = ['ENTRY', 'SALE', 'LOSS', 'ADJUSTMENT', 'EXPIRATION'];

const StockMovement = sequelize.define(
  'StockMovement',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'products',
        key: 'id',
      },
    },
    lot_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'lots',
        key: 'id',
      },
    },
    type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        isIn: { args: [TYPES], msg: 'Tipo de movimentação inválido' },
      },
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: { args: [1], msg: 'A quantidade deve ser maior que zero' },
        isInt: { msg: 'A quantidade deve ser um número inteiro' },
      },
    },
    reason: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
  },
  {
    tableName: 'stock_movements',
    timestamps: true,
    underscored: true,
    updatedAt: false, // Conforme especificação: apenas created_at
  }
);

StockMovement.TYPES = TYPES;

module.exports = StockMovement;
