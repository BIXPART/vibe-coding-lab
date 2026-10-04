/**
 * Emissão e validação de tokens JWT.
 *
 * O token carrega APENAS o id do usuário (subject). Autorização de acesso a
 * uma meta nunca vem do token nem do body: vem de uma consulta filtrada por
 * userId no banco. (AI_NOTES.md regra 12)
 */
import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';
import { UnauthorizedError } from './errors.js';

export interface TokenPayload {
  /** Subject: id do usuário. */
  sub: string;
}

export function generateToken(userId: number): string {
  const payload: TokenPayload = { sub: String(userId) };

  // `expiresIn` aceita tanto número de segundos quanto string ("1d", "2h").
  // O cast resolve o conflito entre o `string` do env e o tipo do jsonwebtoken.
  const options: jwt.SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    algorithm: 'HS256',
  };

  return jwt.sign(payload, env.JWT_SECRET, options);
}

/**
 * Erros de JWT são convertidos em mensagem genérica: distinguir
 * "token expirado" de "token inválido" só ajuda quem ataca a API.
 */
export function verifyToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });

    if (typeof decoded === 'string' || typeof decoded.sub !== 'string') {
      throw new UnauthorizedError('Token inválido.', 'INVALID_TOKEN');
    }

    return { sub: decoded.sub };
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    throw new UnauthorizedError('Token inválido ou expirado.', 'INVALID_TOKEN');
  }
}

/** Extrai o userId do subject já validado. */
export function subjectToUserId(payload: TokenPayload): number {
  const userId = Number(payload.sub);

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new UnauthorizedError('Token inválido.', 'INVALID_TOKEN');
  }

  return userId;
}