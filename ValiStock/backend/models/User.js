const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ROLES = ['ADMIN', 'MANAGER', 'EMPLOYEE'];

const User = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'O nome é obrigatório' },
      },
    },
    email: {
      type: DataTypes.STRING(160),
      allowNull: false,
      unique: { msg: 'Este e-mail já está cadastrado' },
      validate: {
        isEmail: { msg: 'E-mail inválido' },
        notEmpty: { msg: 'O e-mail é obrigatório' },
      },
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'EMPLOYEE',
      validate: {
        isIn: { args: [ROLES], msg: 'Papel inválido' },
      },
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: 'users',
    timestamps: true,
    underscored: true,
    // Nunca expor password_hash nas respostas
    defaultScope: {
      attributes: { exclude: ['password_hash'] },
    },
    scopes: {
      withPassword: {
        attributes: { include: ['password_hash'] },
      },
    },
  }
);

User.ROLES = ROLES;

module.exports = User;
