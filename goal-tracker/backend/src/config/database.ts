import { Sequelize } from 'sequelize';

import { env, isProduction } from './env.js';

/**
 * Conexão com o PostgreSQL via Sequelize.
 *
 * A string de conexão vem exclusivamente de `env` (variável de ambiente),
 * nunca do código-fonte. (AI_NOTES.md §9)
 */
export const sequelize = new Sequelize(env.DATABASE_URL, {
  logging: isProduction ? false : env.SQL_LOGGING,
  dialectOptions: {
    // Em produção a conexão normalmente é feita via TLS.
    ssl: isProduction ? { rejectUnauthorized: false } : false,
  },
  pool: {
    max: 10,
    min: 0,
    acquire: 30_000,
    idle: 10_000,
  },
  define: {
    underscored: true,
    timestamps: true,
  },
});

export async function connectDatabase(): Promise<void> {
  await sequelize.authenticate();
}

export async function disconnectDatabase(): Promise<void> {
  await sequelize.close();
}