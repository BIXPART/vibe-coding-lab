import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv();

/**
 * Validação das variáveis de ambiente.
 *
 * Objetivo: a aplicação NÃO deve subir com configuração inválida ou ausente.
 * Falhar aqui (fail fast) é melhor do que descobrir um segredo faltando no meio
 * de uma requisição em produção. (AI_NOTES.md §9)
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),

  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET precisa ter ao menos 32 caracteres'),
  JWT_EXPIRES_IN: z.string().min(1).default('1d'),

  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),

  CORS_ORIGIN: z.string().min(1).default('*'),

  SQL_LOGGING: z
    .enum(['true', 'false', 'sequelize'])
    .default('false')
    .transform((value) => {
      if (value === 'true') return true;
      if (value === 'false') return false;
      return console.log; // eslint-disable-line no-console
    }),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(raiz)'}: ${issue.message}`)
    .join('\n');

  // Não imprimimos os valores recebidos, apenas os nomes dos campos com problema.
  throw new Error(
    `Configuração de ambiente inválida:\n${details}\n\nCopie .env.example para .env e preencha os valores.`,
  );
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';