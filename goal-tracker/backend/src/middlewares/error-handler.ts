/**
 * Handler central de erros.
 *
 * REGRA: em produção NENHUM erro desconhecido vaza stack trace, SQL, nome de
 * tabela ou mensagem original. O cliente recebe um código estável e uma
 * mensagem genérica; o detalhe vai para o log do servidor.
 * (AI_NOTES.md §9 - "Não expor informações sensíveis nos erros")
 */
import type { NextFunction, Request, Response } from 'express';
import { UniqueConstraintError } from 'sequelize';
import { ZodError } from 'zod';

import { isProduction } from '../config/env.js';
import { AppError } from '../utils/errors.js';

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function notFoundHandler(req: Request, res: Response<ErrorBody>): void {
  res.status(404).json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Rota não encontrada: ${req.method} ${req.originalUrl}`,
    },
  });
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response<ErrorBody>,
  next: NextFunction,
): void {
  // Se a resposta já começou, só delegamos. Headers já enviados não podem
  // ser alterados; finalizamos a conexão para não deixar o socket pendurado.
  if (res.headersSent) {
    next(error);
    return;
  }

  // 1. Erros de validação de entrada (Zod).
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos.',
        // Lista campo/mensagem. Não inclui o valor recebido, para não ecoar
        // o que o cliente mandou (pode conter dado sensível).
        details: error.issues.map((issue) => ({
          field: issue.path.join('.') || '(raiz)',
          message: issue.message,
        })),
      },
    });
    return;
  }

  // 2. Erros de negócio e HTTP conhecidos.
  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      console.error('[erro interno]', error);
    }

    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    });
    return;
  }

  // 3. Violação de constraint única que escapou do service.
  if (error instanceof UniqueConstraintError) {
    res.status(409).json({
      error: {
        code: 'DUPLICATE_RESOURCE',
        message: 'Registro duplicado.',
      },
    });
    return;
  }

  // 4. JSON malformado enviado pelo cliente.
  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({
      error: {
        code: 'INVALID_JSON',
        message: 'Corpo da requisição não é um JSON válido.',
      },
    });
    return;
  }

  // 5. Qualquer outra coisa: 500 sem detalhes.
  console.error('[erro não tratado]', error);

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Erro interno do servidor.',
      // Só em desenvolvimento, para facilitar o debug local.
      ...(isProduction
        ? {}
        : { details: error instanceof Error ? error.message : String(error) }),
    },
  });
}