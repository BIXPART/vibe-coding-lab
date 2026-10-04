/**
 * Criação/Atualização do schema.
 *
 * DECISÃO DE ARQUITETURA (revisar em produção):
 * `sequelize.sync()` é aceitável para DESENVOLVIMENTO e APRENDIZADO, mas em
 * produção ele pode ALTERAR ou APAGAR tabela sem avisar. O caminho correto é
 * usar migrações versionadas (sequelize-cli/umzug) e rodar `migrate` no deploy.
 *
 * Por isso `server.ts` recusa NODE_ENV=production.
 */
import { Goal, GoalOccurrence, User } from '../models/index.js';
import { sequelize } from '../config/database.js';
import { env } from '../config/env.js';

/** Ordem importa: filho antes do pai, por causa das foreign keys. */
export const models = [GoalOccurrence, Goal, User];

export async function syncDatabase(): Promise<void> {
  await sequelize.sync({ alter: env.NODE_ENV === 'development' });
}