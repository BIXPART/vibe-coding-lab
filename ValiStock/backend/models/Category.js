const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Category = sequelize.define(
  'Category',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
      unique: { msg: 'Já existe uma categoria com este nome' },
      validate: {
        notEmpty: { msg: 'O nome da categoria é obrigatório' },
      },
    },
  },
  {
    tableName: 'categories',
    timestamps: true,
    underscored: true,
  }
);

module.exports = Category;
