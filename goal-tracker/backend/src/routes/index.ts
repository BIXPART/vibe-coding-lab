/**
 * Rotas da API.
 *
 * Cada rota declara explicitamente a validação de entrada e, quando aplicável,
 * `authenticate`. Não existe rota autenticada sem `authenticate`, e nenhum
 * controller recebe dado do cliente sem antes passar por um schema (regra 10).
 *
 * A ordem dos middlewares importa: `validateParams` roda antes do controller
 * para que `req.params.id` já seja um inteiro validado. `authenticate` vem antes
 * de tudo nas rotas protegidas — não faz sentido validar o id de uma meta que o
 * usuário nem pode ver.
 */
import { Router } from 'express';

import * as controllers from '../controllers/index.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authLimiter } from '../middlewares/rate-limit.js';
import { validateBody, validateParams, validateQuery } from '../middlewares/validate.js';
import {
  createGoalSchema,
  goalIdParamSchema,
  listGoalsQuerySchema,
  loginSchema,
  occurrencesQuerySchema,
  registerSchema,
  updateGoalSchema,
  updateProfileSchema,
} from '../validators/index.js';

export const authRouter = Router();

// Rate limit apenas em login/registro: são os alvos de brute force.
authRouter.post('/register', authLimiter, validateBody(registerSchema), controllers.register);
authRouter.post('/login', authLimiter, validateBody(loginSchema), controllers.login);

authRouter.get('/me', authenticate, controllers.me);
authRouter.patch('/me', authenticate, validateBody(updateProfileSchema), controllers.updateMe);

export const goalsRouter = Router();

// A partir daqui toda rota tem `req.user` garantido.
goalsRouter.use(authenticate);

goalsRouter.get('/', validateQuery(listGoalsQuerySchema), controllers.list);
goalsRouter.post('/', validateBody(createGoalSchema), controllers.create);
goalsRouter.get('/:id', validateParams(goalIdParamSchema), controllers.getById);
goalsRouter.patch(
  '/:id',
  validateParams(goalIdParamSchema),
  validateBody(updateGoalSchema),
  controllers.update,
);
goalsRouter.delete('/:id', validateParams(goalIdParamSchema), controllers.remove);

// Histórico e estatísticas do período.
goalsRouter.get(
  '/:id/occurrences',
  validateParams(goalIdParamSchema),
  validateQuery(occurrencesQuerySchema),
  controllers.history,
);
goalsRouter.post(
  '/:id/occurrences/complete',
  validateParams(goalIdParamSchema),
  controllers.completeCurrent,
);
goalsRouter.get('/:id/stats', validateParams(goalIdParamSchema), controllers.goalStats);

export const dashboardRouter = Router();
dashboardRouter.use(authenticate);
dashboardRouter.get('/', controllers.dashboard);

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/goals', goalsRouter);
apiRouter.use('/dashboard', dashboardRouter);
