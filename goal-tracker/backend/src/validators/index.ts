/**
 * Schemas de validação de entrada (Zod).
 *
 * Toda entrada do cliente é validada AQUI, no backend, antes de chegar em
 * qualquer regra de negócio. Validação apenas no mobile não é segurança:
 * qualquer pessoa pode chamar a API direto. (AI_NOTES.md regra 10)
 */
import { z } from 'zod';

import { isValidCivilDateString, isValidTimeZone } from '../utils/civil-date.js';
import { FREQUENCIES } from '../utils/period.js';

/* -------------------------------------------------------------------------- */
/* Comuns                                                                     */
/* -------------------------------------------------------------------------- */

const civilDate = z
  .string()
  .refine(isValidCivilDateString, { message: 'Data inválida. Use o formato YYYY-MM-DD.' });

const timezone = z.string().refine(isValidTimeZone, {
  message: 'Fuso horário inválido. Use um identificador IANA, ex.: America/Sao_Paulo.',
});

/**
 * E-mail normalizado ANTES de ser validado.
 *
 * A ordem importa e é o ponto deste schema. `z.email().transform(trim)` valida
 * primeiro e normaliza depois — logo `"  joao@x.com  "` é REJEITADO com "E-mail
 * inválido.", porque o espaço ainda está lá quando o `z.email()` roda. O
 * transform só enxerga e-mails que já eram válidos, ou seja, não faz nada nos
 * casos que ele existe para corrigir.
 *
 * `pipe` inverte a ordem: `trim` → `toLowerCase` → `max(255)` → valida o
 * formato. O limite de tamanho é medido sobre o valor já normalizado, que é o
 * que vai para o banco (a coluna é `STRING(255)`).
 *
 * Motivo de normalizar no servidor e não no cliente: `AI_NOTES.md` §8 regra 12
 * — nada de dado do cliente é confiável. "O app já manda sem espaço" não é
 * garantia; a API precisa aceitar o que qualquer cliente mandar.
 */
const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(255, 'O e-mail precisa ter no máximo 255 caracteres.')
  .pipe(z.email('E-mail inválido.'));

/**
 * bcrypt considera no máximo 72 bytes. Sem este limite, uma senha maior é
 * truncada silenciosamente e "senha longa" vira sinônimo de "senha curta".
 */
const password = z
  .string()
  .min(8, 'A senha precisa ter ao menos 8 caracteres.')
  .max(72, 'A senha precisa ter no máximo 72 caracteres.');

/* -------------------------------------------------------------------------- */
/* Auth                                                                       */
/* -------------------------------------------------------------------------- */

export const registerSchema = z.object({
  email,
  password,
  name: z.string().trim().min(1).max(120).optional(),
  timezone: timezone.optional(),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Informe a senha.').max(72),
});

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(120).nullable().optional(),
    timezone: timezone.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Envie ao menos um campo para atualizar.',
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/* -------------------------------------------------------------------------- */
/* Goals                                                                      */
/* -------------------------------------------------------------------------- */

export const createGoalSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome da meta.').max(120),
  description: z.string().trim().max(500).nullable().optional(),
  frequency: z.enum(FREQUENCIES, {
    message: 'Frequência inválida. Use DAILY, WEEKLY ou MONTHLY.',
  }),
  isActive: z.boolean().optional(),
});

export const updateGoalSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    frequency: z.enum(FREQUENCIES).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Envie ao menos um campo para atualizar.',
  });

/**
 * Parâmetros de rota com `:id`.
 *
 * SEM este schema, `Number(req.params.id)` devolve `NaN` para `/goals/abc`, o
 * Sequelize gera `WHERE id = NaN` e o Postgres responde
 * `column "nan" does not exist` — ou seja, um **500** onde o correto é **400**.
 * Nenhum ID vindo do cliente é confiável (regra 12).
 */
export const goalIdParamSchema = z.object({
  id: z.coerce
    .number({ message: 'Identificador de meta inválido.' })
    .int('Identificador de meta deve ser um número inteiro.')
    .positive('Identificador de meta deve ser maior que zero.'),
});

export const listGoalsQuerySchema = z.object({
  includeInactive: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const occurrencesQuerySchema = z
  .object({
    from: civilDate.optional(),
    to: civilDate.optional(),
    status: z.enum(['PENDING', 'COMPLETED', 'MISSED']).optional(),
  })
  .refine((value) => !(value.from && value.to) || value.from <= value.to, {
    message: 'O campo "from" precisa ser anterior ou igual a "to".',
    path: ['from'],
  });

export type GoalIdParam = z.infer<typeof goalIdParamSchema>;
export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
export type ListGoalsQuery = z.infer<typeof listGoalsQuerySchema>;
export type OccurrencesQuery = z.infer<typeof occurrencesQuerySchema>;