/**
 * Controllers: camada fina.
 *
 * Regras de negócio NÃO moram aqui (AI_NOTES.md §10). O controller só valida a
 * entrada, chama o service e formata a resposta.
 *
 * Os controllers não abrem transação, não montam SQL e não decidem regra. Se
 * você precisa ler algo aqui com muita atenção, provavelmente pertence a um
 * service.
 */
import type { Request, Response } from 'express';

import { requireUser } from '../middlewares/authenticate.js';
import { validatedParams, validatedQuery } from '../middlewares/validate.js';
import * as authService from '../services/auth.service.js';
import * as goalService from '../services/goal.service.js';
import * as occurrenceService from '../services/occurrence.service.js';
import * as statsService from '../services/stats.service.js';
import {
  compareCivilDates,
  formatCivilDate,
  parseCivilDate,
  toCivilDate,
} from '../utils/civil-date.js';
import { ValidationError } from '../utils/errors.js';
import {
  createGoalSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
  type CreateGoalInput,
  type GoalIdParam,
  type ListGoalsQuery,
  type OccurrencesQuery,
  type UpdateGoalInput,
} from '../validators/index.js';

/* -------------------------------------------------------------------------- */
/* Auth                                                                       */
/* -------------------------------------------------------------------------- */

export async function register(req: Request, res: Response): Promise<void> {
  const input = registerSchema.parse(req.body);
  const result = await authService.register(input);

  res.status(201).json(result);
}

export async function login(req: Request, res: Response): Promise<void> {
  const input = loginSchema.parse(req.body);
  const result = await authService.login(input);

  res.json(result);
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);

  res.json({ user });
}

export async function updateMe(req: Request, res: Response): Promise<void> {
  const current = requireUser(req);
  const input = updateProfileSchema.parse(req.body);

  const user = await authService.updateProfile(current.id, input);

  res.json({ user });
}

/* -------------------------------------------------------------------------- */
/* Goals                                                                      */
/* -------------------------------------------------------------------------- */

export async function list(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const query = validatedQuery<ListGoalsQuery>(req);

  const result = await goalService.listGoals(user.id, {
    includeInactive: query.includeInactive,
    page: query.page,
    limit: query.limit,
  });

  res.json({
    goals: result.goals.map(serializeGoal),
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    },
  });
}

export async function create(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  // O body já foi validado e normalizado pelo middleware da rota.
  const goal = await goalService.createGoal(user.id, req.body as CreateGoalInput);

  res.status(201).json({ goal: serializeGoal(goal) });
}

export async function getById(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id } = validatedParams<GoalIdParam>(req);

  const goal = await goalService.findGoalForUser(user.id, id);

  res.json({ goal: serializeGoal(goal) });
}

export async function update(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id } = validatedParams<GoalIdParam>(req);

  const goal = await goalService.updateGoal(user.id, id, req.body as UpdateGoalInput);

  res.json({ goal: serializeGoal(goal) });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id } = validatedParams<GoalIdParam>(req);

  await goalService.deleteGoal(user.id, id, user.timezone);

  res.status(204).send();
}

/* -------------------------------------------------------------------------- */
/* Occurrences                                                                */
/* -------------------------------------------------------------------------- */

export async function completeCurrent(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id: goalId } = validatedParams<GoalIdParam>(req);

  // Regras (inativa, transação, duplicidade) e o `userId` do token ficam todos
  // no service. Aqui só formatamos a resposta.
  const { occurrence, period } = await goalService.completeOccurrenceForUser(
    user.id,
    goalId,
    user.timezone,
  );

  res.json({
    occurrence: {
      goalId: occurrence.goalId,
      periodStart: occurrence.periodStart,
      periodEnd: occurrence.periodEnd,
      status: occurrence.status,
      completedAt: occurrence.completedAt,
    },
    period: {
      frequency: period.frequency,
      start: formatCivilDate(period.start),
      end: formatCivilDate(period.end),
    },
  });
}

export async function history(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id: goalId } = validatedParams<GoalIdParam>(req);
  const query = validatedQuery<OccurrencesQuery>(req);

  const goal = await goalService.findGoalForUser(user.id, goalId);

  const now = new Date();
  const today = toCivilDate(now, user.timezone);
  const window = statsService.defaultHistoryWindow(goal.frequency, user.timezone, now);

  const from = query.from ? parseCivilDate(query.from) : parseCivilDate(window.from);
  const to = query.to ? parseCivilDate(query.to) : parseCivilDate(window.to);

  if (compareCivilDates(from, to) > 0) {
    throw new ValidationError('O intervalo informado é inválido.');
  }

  const entries = await occurrenceService.buildHistory({
    goalId: goal.id,
    frequency: goal.frequency,
    timeZone: user.timezone,
    now,
    createdAt: goal.createdAt,
    from,
    to,
  });

  const filtered = query.status
    ? entries.filter((entry) => entry.status === query.status)
    : entries;

  res.json({
    goalId: goal.id,
    frequency: goal.frequency,
    timeZone: user.timezone,
    today: formatCivilDate(today),
    from: formatCivilDate(from),
    to: formatCivilDate(to),
    total: filtered.length,
    occurrences: filtered.map((entry) => ({
      periodStart: entry.periodStart,
      periodEnd: entry.periodEnd,
      status: entry.status,
      completedAt: entry.completedAt,
      persisted: entry.persisted,
    })),
  });
}

/* -------------------------------------------------------------------------- */
/* Stats                                                                      */
/* -------------------------------------------------------------------------- */

export async function goalStats(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const { id } = validatedParams<GoalIdParam>(req);

  const stats = await statsService.goalStats(user.id, id, user.timezone);

  res.json({ stats });
}

export async function dashboard(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);

  const summary = await statsService.buildDashboard(user.id, user.timezone);

  res.json(summary);
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function serializeGoal(goal: {
  id: number;
  name: string;
  description: string | null;
  frequency: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): Record<string, unknown> {
  return {
    id: goal.id,
    name: goal.name,
    description: goal.description,
    frequency: goal.frequency,
    isActive: goal.isActive,
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
  };
}
