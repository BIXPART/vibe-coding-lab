/**
 * Mutação (escrita) com estado de carregamento e erro.
 *
 * Complementar ao `useAsync`, que é para leitura. Escrita tem um problema
 * diferente: o que acontece quando ela **falha** depois de a tela já ter mudado
 * de estado. Por isso o resultado é commitado em estado, não em variável solta.
 *
 * ## Por que `run` devolve o valor
 *
 * Quem chama costuma precisar do retorno para decidir o próximo passo (navegar,
 * fechar um modal). O `useAsync` não faz isso porque leitura tem `data`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError } from '@/services/api';

export interface ActionState<TArgs extends unknown[], TResult> {
  run(...args: TArgs): Promise<TResult | undefined>;
  pending: boolean;
  error: string | null;
  /**
   * A exceção original.
   *
   * Existe junto do `error` (texto) porque parte das telas precisa do
   * **estrutura**: o `ApiError.details` do backend é uma lista
   * `{ field, message }`, e mostrar isso abaixo do campo correspondente exige
   * ler o objeto — não a string.
   */
  cause: unknown;
  /** Limpa o erro. Útil ao trocar de tela: erro da tela anterior não deve
   * aparecer quando o usuário volta. */
  reset(): void;
}

export function useAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
): ActionState<TArgs, TResult> {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cause, setCause] = useState<unknown>(null);

  // Mantém a função mais recente sem colocá-la em `deps`: assim o `run` é
  // estável e a tela pode passá-lo direto para um handler.
  //
  // A atribuição fica num efeito, e não no corpo do render: escrever em ref
  // durante render é proibido (o valor escaparia da renderização atual) e a
  // regra `react-hooks/refs` acusa. Só há risco de obsolescência antes do
  // primeiro efeito rodar, e `run` só é chamado de handlers de evento — depois
  // dos efeitos.
  const actionRef = useRef(action);

  useEffect(() => {
    actionRef.current = action;
  }, [action]);

  // Idem: evita `setState` em componente já desmontado.
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (...args: TArgs): Promise<TResult | undefined> => {
    setPending(true);
    setError(null);
    setCause(null);

    try {
      return await actionRef.current(...args);
    } catch (thrown) {
      if (mounted.current) {
        setCause(thrown);
        setError(explain(thrown));
      }
      return undefined;
    } finally {
      if (mounted.current) setPending(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setCause(null);
  }, []);

  // Memoizado pelo mesmo motivo do `useAsync`: um literal de objeto aqui
  // devolveria identidade nova a cada render e tornaria instável qualquer
  // `useCallback` que dependesse do objeto inteiro.
  return useMemo(
    () => ({ run, pending, error, cause, reset }),
    [run, pending, error, cause, reset],
  );
}

/**
 * Extrai `{ field: mensagem }` do erro do backend.
 *
 * Retorna `null` se não for um `ApiError` com `details` — quem chama decide o
 * que fazer (normalmente mostrar a mensagem genérica).
 */
export function fieldErrorsOf(cause: unknown): Record<string, string> | null {
  if (!(cause instanceof ApiError)) return null;

  const details: unknown = cause.details;
  if (!Array.isArray(details)) return null;

  const map: Record<string, string> = {};

  for (const detail of details) {
    if (
      typeof detail === 'object' &&
      detail !== null &&
      typeof (detail as { field?: unknown }).field === 'string' &&
      typeof (detail as { message?: unknown }).message === 'string'
    ) {
      map[(detail as { field: string }).field] = (detail as { message: string }).message;
    }
  }

  return Object.keys(map).length > 0 ? map : null;
}

function explain(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'Não foi possível concluir a ação.';
}