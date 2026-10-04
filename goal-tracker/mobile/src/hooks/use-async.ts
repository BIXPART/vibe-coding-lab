/**
 * Carregamento de dados assíncronos com o trio `data | loading | error`.
 *
 * ## Por que não usar `useEffect` direto em cada tela
 *
 * Quase toda tela precisa da mesma coisa: buscar, mostrar spinner, mostrar erro,
 * permitir retry, e **cancelar quando a tela sai**. O último item é o que
 * ninguém lembra: sem `AbortController`, uma requisição que responde depois do
 * `unmount` chama `setState` em um componente morto e o React 19 avisa.
 *
 * ## `reload` vs `refetch`
 *
 * - `reload()` busca de novo mantendo os dados atuais visíveis (refresh).
 * - `refetch()` volta ao estado de carregamento (retry depois de erro).
 *
 * ## Um detalhe sobre a regra `set-state-in-effect`
 *
 * Buscar dados é justamente sincronizar com um sistema externo, e ainda assim a
 * regra recomenda nunca chamar `setState` de forma síncrona no corpo do efeito
 * (gera render em cascata). Por isso o efeito aqui **não** chama `run` (que
 * zeraria estado de imediato): ele só dispara a promessa. O `setState` acontece
 * dentro de `.then`/`.catch`, que já é assíncrono.
 *
 * Estado inicial já é `loading: true` / `data: null`, então a primeira busca
 * não precisa de nenhuma escrita antes de partir.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError, NetworkError } from '@/services/api';

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  /** Recarrega mantendo os dados visíveis. Para `RefreshControl`. */
  reload(): void;
  /** Recarrega do zero. Para botão "tentar de novo" depois de erro. */
  refetch(): void;
}

/**
 * Executa `loader` e expõe o resultado.
 *
 * `deps` funciona como no `useEffect`: mudar a dependência refaz a busca. É o
 * que faz a tela de detalhe carregar de novo ao trocar de `:id`.
 */
export function useAsync<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // O `loader` mais recente, guardado para `reload`/`refetch` não ficarem
  // presos à primeira closure. Atribuição em efeito, nunca no render.
  const loaderRef = useRef(loader);

  useEffect(() => {
    loaderRef.current = loader;
  }, [loader]);

  // Controlador vivo: aborta a requisição anterior quando deps mudam, quando o
  // usuário pede reload, ou quando a tela desmonta.
  const controllerRef = useRef<AbortController | null>(null);

  // Precisa ser ref e não closure: os callbacks abaixo são estáveis e precisam
  // enxergar o valor atual para não commitarem estado após o unmount.
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  /**
   * Dispara a busca e faz os commits de estado.
   *
   * Sem `setState` síncrono: quem chama decide o que já está zerado.
   */
  const fetchInto = useCallback((nextLoader: (signal: AbortSignal) => Promise<T>) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    void nextLoader(controller.signal)
      .then((result) => {
        if (!mounted.current || controller.signal.aborted) return;
        setData(result);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!mounted.current || controller.signal.aborted) return;
        setError(explain(cause));
      })
      .finally(() => {
        if (!mounted.current || controller.signal.aborted) return;
        setLoading(false);
      });
  }, []);

  /** Busca disparada por evento (pull-to-refresh, botão de retry). */
  const run = useCallback(
    (mode: 'reload' | 'refetch') => {
      if (mode === 'refetch') {
        setData(null);
        setLoading(true);
      }
      setError(null);
      fetchInto(loaderRef.current);
    },
    [fetchInto],
  );

  const reload = useCallback(() => run('reload'), [run]);
  const refetch = useCallback(() => run('refetch'), [run]);

  useEffect(() => {
    // Só a partida: nenhuma escrita síncrona de estado aqui.
    //
    // O estado inicial já é `loading: true` + `data: null`, então a primeira
    // busca não precisa de reset. E numa troca de dependência, manter os dados
    // antigos visíveis enquanto o novo carrega é o comportamento correto
    // (equivale a `reload`) — trocar a meta ou a página não deve piscar um
    // spinner no lugar do conteúdo.
    //
    // O `error` anterior também não é zerado aqui de propósito: ele só some
    // quando a nova busca der certo, o que evita a tela piscar entre "erro" e
    // "vazio".
    fetchInto(loaderRef.current);
    // `fetchInto` é estável; as deps reais são as declaradas pelo chamador.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // O objeto de retorno é MEMOIZADO de propósito, e não por economia.
  //
  // Se devolvêssemos `{ data, error, loading, reload, refetch }` literal, ele
  // teria identidade nova a cada render. Quem dependesse do objeto inteiro num
  // `useCallback` — como o `refresh` de `goals/[id]/index.tsx` — ficaria
  // instável, o `useFocusEffect` (que usa `useEffect` com o effect em `deps`)
  // rodaria o cleanup a cada render, e o cleanup chama `reload()`… que dispara
  // fetch, que seta estado, que re-renderiza. Loop infinito de requisições.
  //
  // `data`/`error`/`loading` mudam de verdade quando o fetch resolve, então a
  // memoização não mascara renderização: só impede que o *container* mude de
  // identidade à toa.
  return useMemo(
    () => ({ data, error, loading, reload, refetch }),
    [data, error, loading, reload, refetch],
  );
}

/**
 * Converte uma exceção em algo apresentável.
 *
 * `NetworkError` e `ApiError` já trazem mensagens escritas para o usuário; o
 * resto cai num genérico sem vazar stack trace na tela.
 */
function explain(error: unknown): string {
  if (error instanceof NetworkError || error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Algo deu errado. Tente de novo.';
}