/**
 * Tipos do contrato com a API.
 *
 * Estes tipos espelham EXATAMENTE o que o backend devolve. Não são um modelo de
 * domínio: o mobile não recalcula período, não decide status e não inventa
 * estatística. Ele consome o que a API já resolveu.
 *
 * Regra 10 (AI_NOTES §8): o backend é a autoridade. Se um cálculo aparece
 * aqui, é porque o servidor já devolveu o resultado pronto.
 */

export type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export type OccurrenceStatus = 'PENDING' | 'COMPLETED' | 'MISSED';

export interface User {
  id: number;
  email: string;
  name: string | null;
  /** Fuso IANA. A regra 7 do backend depende deste valor. */
  timezone: string;
  createdAt: string;
}

export interface AuthResult {
  user: User;
  token: string;
}

export interface Goal {
  id: number;
  name: string;
  description: string | null;
  frequency: Frequency;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedGoals {
  goals: Goal[];
  pagination: Pagination;
}

/** Uma ocorrência devolvida por `GET /goals/:id/occurrences`. */
export interface Occurrence {
  /** `YYYY-MM-DD` — data civil, não instante. */
  periodStart: string;
  periodEnd: string;
  status: OccurrenceStatus;
  completedAt: string | null;
  /**
   * `false` quando o backend gerou a linha para preencher uma lacuna: o
   * usuário não abriu o app naquele dia.
   */
  persisted: boolean;
}

export interface GoalOccurrences {
  goalId: number;
  frequency: Frequency;
  timeZone: string;
  today: string;
  from: string;
  to: string;
  total: number;
  occurrences: Occurrence[];
}

/** `GET /goals/:id/stats` */
export interface GoalStats {
  goalId: number;
  goalName: string;
  frequency: Frequency;
  currentPeriod: {
    periodStart: string;
    periodEnd: string;
    status: OccurrenceStatus;
    completedAt: string | null;
  };
  window: {
    from: string;
    to: string;
    periodsCounted: number;
  };
  currentStreak: number;
  bestStreak: number;
  completedCount: number;
  missedCount: number;
  pendingCount: number;
  completionRate: number;
  /**
   * `false` = ainda não há períodos definidos. A API §6 proíbe inventar
   * número; o app deve mostrar "sem dados" e não "0%".
   */
  hasData: boolean;
}

/** `GET /dashboard` */
export interface Dashboard {
  timeZone: string;
  generatedAt: string;
  /**
   * Duas medidas, e elas não se misturam:
   *
   * - `completed`/`pending` = **metas** no período atual (é a lista da aba
   *   "Hoje": o que falta agora).
   * - `completionRate` = **períodos** fechados na janela de medição, com a
   *   mesma definição de `GoalStats.completionRate`. Não é `completed /
   *   activeGoals`.
   *
   * `hasData: false` significa que nenhum período da janela foi fechado ainda
   * — o app deve mostrar "—", nunca "0%" (AI_NOTES §6).
   */
  totals: {
    activeGoals: number;
    completed: number;
    pending: number;
    completionRate: number;
    hasData: boolean;
  };
  goals: {
    goalId: number;
    name: string;
    frequency: Frequency;
    description: string | null;
    isActive: boolean;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    status: OccurrenceStatus;
    completedAt: string | null;
    currentStreak: number;
    bestStreak: number;
    /** Períodos concluídos na janela de medição. */
    completedCount: number;
    /** Períodos perdidos na janela de medição. */
    missedCount: number;
  }[];
}

/** Formato de erro padronizado pelo backend (`error-handler.ts`). */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: { field: string; message: string }[] | unknown;
  };
}
