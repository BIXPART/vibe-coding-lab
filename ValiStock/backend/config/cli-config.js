/**
 * Configuração específica do sequelize-cli (para migrations e seeders).
 * A configuração usada pela aplicação em runtime fica em config/database.js.
 * Ambas leem as mesmas variáveis de ambiente para manter um único ponto de troca
 * caso o banco migre de SQLite para PostgreSQL no futuro.
 */
require('dotenv').config();

const dialect = process.env.DATABASE_DIALECT || 'sqlite';

const baseConfig = {
  development: {},
  test: {},
  production: {},
};

if (dialect === 'postgres') {
  Object.keys(baseConfig).forEach((env) => {
    baseConfig[env] = {
      dialect: 'postgres',
      url: process.env.DATABASE_URL,
      use_env_variable: process.env.DATABASE_URL ? 'DATABASE_URL' : undefined,
      dialectOptions: {
        ssl: process.env.DATABASE_SSL === 'true'
          ? { require: true, rejectUnauthorized: false }
          : false,
      },
    };
  });
} else {
  const storage = process.env.DATABASE_PATH || './database/database.sqlite';
  Object.keys(baseConfig).forEach((env) => {
    baseConfig[env] = {
      dialect: 'sqlite',
      storage,
    };
  });
}

module.exports = baseConfig;
