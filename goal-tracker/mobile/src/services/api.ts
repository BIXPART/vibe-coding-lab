/**
 * Cliente HTTP da API.
 *
 * ## Responsabilidades
 *
 * - Anexar `Authorization: Bearer` quando há token.
 * - Traduzir o corpo de erro padronizado (`{ error: { code, message, details } }`)
 *   em uma exceção com `code` e `status` tipados — assim a UI decide por
 *   `code`, não por texto de mensagem (mensagem pode mudar, código não).
 * - Avisar a sessão quando o token expira (401), para que o app volte ao login
 *   em vez de travar em tela morta.
 *
 * ## O que NÃO mora aqui
 *
 * Regra de negócio. Nada aqui decide se o usuário pode concluir uma meta; isso
 * é do backend (regra 10). O 409 `OCCURRENCE_ALREADY_COMPLETED` é *informação*,
 * não exceção a ser "corrigida" no cliente.
 */
import { API_BASE_URL } from '@/lib/env';
import { tokenStorage } from '@/lib/token-storage';
import type { ApiErrorBody } from '@/types/api';

/** Erro vindo da API, com o `code` preservado. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ApiErrorBody['error']['details'];

  constructor(status: number, body: ApiErrorBody['error']) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.details = body.details;
  }
}

/** A rede falhou: API fora do ar, host errado, CORS, TLS. Não é erro de regra. */
export class NetworkError extends Error {
  constructor(url: string, cause?: unknown) {
    super(
      `Não foi possível falar com a API em ${url}. ` +
        'Verifique se o backend está rodando e se a URL está certa ' +
        '(no emulador Android, `localhost` é o próprio aparelho — ' +
        'use http://10.0.2.2:3000).',
      { cause },
    );
    this.name = 'NetworkError';
  }
}

/** Chamado quando a API responde 401: a sessão acabou. */
type UnauthorizedListener = () => void;
let onUnauthorized: UnauthorizedListener | null = null;

export function setUnauthorizedHandler(listener: UnauthorizedListener | null): void {
  onUnauthorized = listener;
}

const TIMEOUT_MS = 15_000;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** `false` para endpoints públicos (login/registro). */
  auth?: boolean;
  signal?: AbortSignal;
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null) return false;
  const error = (value as { error?: unknown }).error;
  if (typeof error !== 'object' || error === null) return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  return typeof code === 'string' && typeof message === 'string';
}

async function parseBody(response: Response): Promise<unknown> {
  // 204 e 205 não têm corpo; `.json()` lançaria.
  if (response.status === 204 || response.status === 205) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, signal } = options;

  // Um signal JÁ abortado nunca dispara o listener `abort` que registramos
  // abaixo — o evento só ocorre depois. Sem esta guarda, `fetch` sairia mesmo
  // depois do cancelamento pedido pelo chamador. `useAsync` aborta o controller
  // anterior antes de partir um novo, então este caminho é comum.
  if (signal?.aborted) {
    throw signal.reason instanceof Error ? signal.reason : new Error('Requisição cancelada.');
  }

  const headers: Record<string, string> = { Accept: 'application/json' };

  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (auth) {
    const token = await tokenStorage.get();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  // O AbortController local garante que uma requisição abandonada não vaze:
  // quando o usuário sai da tela no meio do fetch, a conexão fecha.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const abortFromCaller = () => controller.abort();
  signal?.addEventListener('abort', abortFromCaller);

  const url = `${API_BASE_URL}/api${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (cause) {
    // Cancelamento explícito do chamador não é erro de rede para a UI.
    if (signal?.aborted) throw cause;
    throw new NetworkError(url, cause);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abortFromCaller);
  }

  const payload = await parseBody(response);

  if (!response.ok) {
    if (response.status === 401 && auth) {
      // Token inválido/expirado: limpa e avisa. O `SessionProvider` escuta e
      // redireciona. Não propagamos o erro — a tela de login vai pedir de novo.
      await tokenStorage.clear();
      onUnauthorized?.();
    }

    if (isApiErrorBody(payload)) throw new ApiError(response.status, payload.error);

    // Resposta sem o envelope padrão (proxy, 502 do Metro, etc.).
    throw new ApiError(response.status, {
      code: 'UNEXPECTED_RESPONSE',
      message: `Resposta inesperada do servidor (HTTP ${response.status}).`,
    });
  }

  return payload as T;
}