const { Sequelize } = require('sequelize');
require('dotenv').config();

const getDatabaseConfig = () => {
  const dialect = process.env.DATABASE_DIALECT || 'sqlite';
  
  if (dialect === 'postgres') {
    // Configuração preparada para PostgreSQL no futuro
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL é obrigatório quando DATABASE_DIALECT=postgres');
    }
    
    return {
      dialect: 'postgres',
      url: process.env.DATABASE_URL,
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      dialectOptions: {
        ssl: process.env.DATABASE_SSL === 'true'
          ? {
              require: true,
              rejectUnauthorized: false,
            }
          : false,
      },
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
    };
  }
  
  // Configuração padrão para SQLite
  const storage = process.env.DATABASE_PATH || './database/database.sqlite';
  
  return {
    dialect: 'sqlite',
    storage,
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    define: {
      timestamps: true,
    },
  };
};

const config = getDatabaseConfig();
const sequelize = new Sequelize(config);

module.exports = {
  sequelize,
  Sequelize,
  config,
};