const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Lot = sequelize.define(
  'Lot',
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
    lot_code: {
      type: DataTypes.STRING(60),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'O código do lote é obrigatório' },
      },
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: { args: [0], msg: 'A quantidade não pode ser negativa' },
        isInt: { msg: 'A quantidade deve ser um número inteiro' },
      },
    },
    manufactured_at: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    expires_at: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        notNull: { msg: 'A data de validade é obrigatória' },
        isDate: { msg: 'Data de validade inválida' },
      },
    },
  },
  {
    tableName: 'lots',
    timestamps: true,
    underscored: true,
  }
);

module.exports = Lot;
