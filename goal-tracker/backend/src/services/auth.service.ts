/**
 * Autenticação.
 *
 * Observações de segurança (AI_NOTES.md §9):
 * - Senha nunca é comparada em texto puro; só o hash bcrypt é persistido.
 * - Falha de login devolve mensagem genérica ("credenciais inválidas"), sem
 *   distinguir e-mail inexistente de senha errada: essa diferença permite
 *   enumerar contas cadastradas.
 * - `passwordHash` é buscado por um scope explícito e nunca serializado.
 */
import { randomUUID } from 'node:crypto';

import { UniqueConstraintError } from 'sequelize';

import { sequelize } from '../config/database.js';
import { User } from '../models/index.js';
import { ConflictError, UnauthorizedError } from '../utils/errors.js';
import { generateToken } from '../utils/jwt.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import type { LoginInput, RegisterInput, UpdateProfileInput } from '../validators/index.js';

export interface AuthenticatedUser {
  id: number;
  email: string;
  name: string | null;
  timezone: string;
  createdAt: Date;
}

export interface AuthResult {
  user: AuthenticatedUser;
  token: string;
}

function toAuthenticatedUser(user: User): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    timezone: user.timezone,
    createdAt: user.createdAt,
  };
}

/**
 * Hash descartável, gerado uma única vez e reaproveitado.
 * Serve apenas para gastar o mesmo tempo de CPU dos demais logins.
 */
let dummyHash: Promise<string> | null = null;

function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(randomUUID());
  return dummyHash;
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  // Hash ANTES da transação: bcrypt é lento (~100ms) e segurar uma conexão
  // do pool durante isso reduz muito a vazão.
  const passwordHash = await hashPassword(input.password);

  try {
    const user = await sequelize.transaction(async (transaction) => {
      // Checagem explícita para devolver 409 com mensagem clara. A constraint
      // unique continua sendo a garantia real contra corrida.
      const existing = await User.findOne({
        where: { email: input.email },
        transaction,
      });

      if (existing) {
        throw new ConflictError('Este e-mail já está cadastrado.', 'EMAIL_ALREADY_IN_USE');
      }

      return User.create(
        {
          email: input.email,
          passwordHash,
          name: input.name ?? null,
          timezone: input.timezone ?? 'UTC',
        },
        { transaction },
      );
    });

    return { user: toAuthenticatedUser(user), token: generateToken(user.id) };
  } catch (error) {
    // Corrida entre dois registros com o mesmo e-mail.
    if (error instanceof UniqueConstraintError) {
      throw new ConflictError('Este e-mail já está cadastrado.', 'EMAIL_ALREADY_IN_USE');
    }
    throw error;
  }
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await User.scope('withPassword').findOne({
    where: { email: input.email },
  });

  // Equalização de tempo: comparamos contra um hash bcrypt REAL gerado uma
  // vez no carregamento do módulo. Sem isso, "e-mail inexistente" responderia
  // bem mais rápido que "senha errada" e revelaria quais e-mails existem.
  // (Um hash inventado não serviria: comparar um valor inválido custa ~0.)
  if (!user) {
    await verifyPassword(input.password, await getDummyHash());
    throw new UnauthorizedError('Credenciais inválidas.', 'INVALID_CREDENTIALS');
  }

  const passwordMatches = await verifyPassword(input.password, user.passwordHash);

  if (!passwordMatches) {
    throw new UnauthorizedError('Credenciais inválidas.', 'INVALID_CREDENTIALS');
  }

  return { user: toAuthenticatedUser(user), token: generateToken(user.id) };
}

export async function getProfile(userId: number): Promise<AuthenticatedUser> {
  const user = await User.findByPk(userId);

  if (!user) {
    throw new UnauthorizedError('Sessão inválida.', 'INVALID_SESSION');
  }

  return toAuthenticatedUser(user);
}

export async function updateProfile(
  userId: number,
  input: UpdateProfileInput,
): Promise<AuthenticatedUser> {
  const user = await User.findByPk(userId);

  if (!user) {
    throw new UnauthorizedError('Sessão inválida.', 'INVALID_SESSION');
  }

  if (input.name !== undefined) user.name = input.name;
  if (input.timezone !== undefined) user.timezone = input.timezone;

  await user.save();

  return toAuthenticatedUser(user);
}