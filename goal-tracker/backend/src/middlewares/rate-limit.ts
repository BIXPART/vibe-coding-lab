/**
 * Rate limiting.
 *
 * AI_NOTES.md §9 pede rate limiting em endpoints sensíveis. Autenticação é o
 * alvo principal: sem limite, login vira ferramenta de brute force e
 * registro vira forma de poluir o banco.
 */
import rateLimit, { ipKeyGenerator, type RateLimitRequestHandler } from 'express-rate-limit';

import { env } from '../config/env.js';

function handler(_req: unknown, res: { status: (code: number) => { json: (body: unknown) => unknown } }): void {
  res.status(429).json({
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Muitas requisições. Tente novamente em alguns instantes.',
    },
  });
}

/** Limite global, bem alto: só protege contra abuso grosseiro. */
export const globalLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: handler as never,
});

/** Limite apertado para login e registro. */
export const authLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Conta por IP + e-mail enviado, para não punir quem digitou o e-mail errado.
  //
  // `ipKeyGenerator` é obrigatório: um IPv6 temMany endereços, então usar
  // `req.ip` cru permitiria trocar de endereço a cada requisição e furar o
  // limite. O helper normaliza o IP em uma chave só.
  keyGenerator: (req) => {
    const email =
      typeof req.body === 'object' && req.body !== null && 'email' in req.body
        ? String((req.body as { email?: unknown }).email ?? '').toLowerCase()
        : '';

    return `${ipKeyGenerator(req.ip ?? '')}:${email}`;
  },
  handler: handler as never,
});