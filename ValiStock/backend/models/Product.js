const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Product = sequelize.define(
  'Product',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    barcode: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: { msg: 'Já existe um produto com este código de barras' },
      validate: {
        notEmpty: { msg: 'O código de barras é obrigatório' },
      },
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'O nome do produto é obrigatório' },
      },
    },
    brand: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    category_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'categories',
        key: 'id',
      },
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: 'products',
    timestamps: true,
    underscored: true,
  }
);

module.exports = Product;
