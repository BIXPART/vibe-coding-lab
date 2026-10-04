/**
 * Erros de aplicação.
 *
 * Regra (AI_NOTES.md §9): o handler de erros converte AppError em resposta
 * segura. Qualquer outro erro vira 500 SEM expor stack, SQL ou segredos.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, statusCode: number, code: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, new.target);
  }
}

/** 400 - requisição malformada ou dados inválidos. */
export class ValidationError extends AppError {
  constructor(message = 'Dados inválidos.', details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

/** 401 - ausente ou inválido. */
export class UnauthorizedError extends AppError {
  constructor(message = 'Não autenticado.', code = 'UNAUTHENTICATED') {
    super(message, 401, code);
  }
}

/** 403 - autenticado, mas sem permissão. */
export class ForbiddenError extends AppError {
  constructor(message = 'Acesso negado.', code = 'FORBIDDEN') {
    super(message, 403, code);
  }
}

/** 404 - recurso inexistente. */
export class NotFoundError extends AppError {
  constructor(message = 'Recurso não encontrado.', code = 'NOT_FOUND') {
    super(message, 404, code);
  }
}

/** 409 - conflito de estado (duplicidade, unicidade). */
export class ConflictError extends AppError {
  constructor(message: string, code = 'CONFLICT') {
    super(message, 409, code);
  }
}

/**
 * 422 - a requisição é sintaticamente válida, porém viola uma regra de negócio.
 * Ex.: tentar concluir uma ocorrência de um período que já passou.
 */
export class BusinessRuleError extends AppError {
  constructor(message: string, code = 'BUSINESS_RULE_VIOLATION') {
    super(message, 422, code);
  }
}