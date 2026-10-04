import 'express';

/**
 * A augmentação do tipo Request do Express fica centralizada aqui.
 * Qualquer rota que use `req.user` depende deste arquivo estar incluído no
 * `include` do tsconfig (a pasta src inteira).
 */
export interface AuthenticatedUserRef {
  id: number;
  email: string;
  name: string | null;
  timezone: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Presente apenas em rotas protegidas por `authenticate`. */
      user?: AuthenticatedUserRef;
    }
  }
}

export {};