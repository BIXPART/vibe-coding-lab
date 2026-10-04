/**
 * Middleware de autenticação.
 *
 * REGRA 12 (AI_NOTES.md §8): o `userId` usado daqui em diante vem do token
 * assinado, cujo conteúdo não pode ser forjado pelo cliente. Nenhuma rota
 * deve ler `userId` do body ou da query.
 */
import type { NextFunction, Request, Response } from 'express';

import { getProfile } from '../services/auth.service.js';
import { UnauthorizedError } from '../utils/errors.js';
import { subjectToUserId, verifyToken } from '../utils/jwt.js';

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Token de autenticação ausente.', 'MISSING_TOKEN');
    }

    const token = header.slice('Bearer '.length).trim();

    if (token.length === 0) {
      throw new UnauthorizedError('Token de autenticação ausente.', 'MISSING_TOKEN');
    }

    const userId = subjectToUserId(verifyToken(token));

    // Recarregamos o usuário do banco a cada requisição: permite revogar
    // acesso apagando a conta sem precisar esperar o token expirar.
    req.user = await getProfile(userId);

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Helper para rotas protegidas: garante `req.user` sem repetir a checagem.
 * Lança em vez de retornar para não continuar a execução sem usuário.
 */
export function requireUser(req: Request): NonNullable<Request['user']> {
  if (!req.user) {
    throw new UnauthorizedError('Não autenticado.', 'UNAUTHENTICATED');
  }
  return req.user;
}