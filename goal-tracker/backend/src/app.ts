/**
 * Montagem da aplicação Express.
 *
 * Fica separada de `server.ts` de propósito: `server.ts` cuida de conexão com
 * o banco e de listen/close, `app.ts` só monta o app. Assim os testes de
 * integração importam o app sem abrir porta nem depender de rede.
 */
import cors from 'cors';
import express, { type Application } from 'express';
import helmet from 'helmet';

import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';
import { globalLimiter } from './middlewares/rate-limit.js';
import { apiRouter } from './routes/index.js';

export function createApp(): Application {
  const app = express();

  // Confiar apenas em 1 proxy é o mínimo para o express-rate-limit usar o IP
  // real. Configurar `true` aqui permitiria falsificar o IP via header.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // A API serve JSON, não HTML: desliga CSP para não enviar header inútil.
      contentSecurityPolicy: false,
    }),
  );

  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',').map((o) => o.trim()),
      credentials: false,
    }),
  );

  // Limite de tamanho evita que alguém envie um corpo gigante para ocupar
  // memória do servidor.
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(globalLimiter);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
  });

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}