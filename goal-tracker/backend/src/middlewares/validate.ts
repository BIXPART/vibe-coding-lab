/**
 * Middlewares de validação de entrada.
 *
 * O controller recebe dados JÁ validados e já em formato normalizado
 * (ex.: e-mail em minúsculas, `id` numérico). Se a validação falhar, o ZodError
 * sobe até o error handler central, que responde 400.
 *
 * Três entradas passam por aqui, todas do cliente:
 *
 * | Entrada     | Middleware        | Motivo                                  |
 * |-------------|-------------------|-----------------------------------------|
 * | `req.body`  | `validateBody`    | regra 10                                |
 * | `req.query` | `validateQuery`   | paginação e filtros                     |
 * | `req.params`| `validateParams`  | **`:id` não é confiável** (regra 12)    |
 *
 * `req.query` e `req.params` são somente-leitura no Express 5, por isso o
 * resultado é guardado em `validatedQuery` / `validatedParams` em vez de
 * reatribuído. Ler com `validatedQuery<T>(req)` / `validatedParams<T>(req)`.
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';

interface ValidatedCarrier {
  validatedQuery?: unknown;
  validatedParams?: unknown;
}

function attach(req: Request, key: keyof ValidatedCarrier, value: unknown): void {
  Object.defineProperty(req, key, {
    value,
    writable: true,
    configurable: true,
    enumerable: true,
  });
}

export function validateBody(schema: ZodType): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      next(result.error);
      return;
    }

    // Substitui pelo resultado parseado (valores já transformados/defaults).
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodType): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      next(result.error);
      return;
    }

    attach(req, 'validatedQuery', result.data);
    next();
  };
}

export function validateParams(schema: ZodType): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      next(result.error);
      return;
    }

    attach(req, 'validatedParams', result.data);
    next();
  };
}

/** Lê o resultado de `validateQuery` com tipagem. */
export function validatedQuery<T>(req: Request): T {
  return (req as Request & ValidatedCarrier).validatedQuery as T;
}

/** Lê o resultado de `validateParams` com tipagem. */
export function validatedParams<T>(req: Request): T {
  return (req as Request & ValidatedCarrier).validatedParams as T;
}
