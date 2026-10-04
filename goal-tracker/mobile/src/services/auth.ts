/**
 * Autenticação.
 *
 * Este módulo é o ÚNICO lugar do app que sabe como obter e guardar um token.
 * Todo o resto chama a API autenticada e pronto.
 *
 * ## Regra 10 na prática
 *
 * `login` e `register` traduzem erros do servidor em mensagens que o usuário
 * entende, mas **não decidem nada**. `INVALID_CREDENTIALS` vira
 * "e-mail ou senha incorretos" — o backend que decidiu. Nada aqui tenta
 * "corrigir" um 401 ou insistir em reenviar credenciais.
 */
import { ApiError, request } from '@/services/api';
import { tokenStorage } from '@/lib/token-storage';
import type { AuthResult, User } from '@/types/api';

/**
 * Códigos de erro do backend. REGRA 10: quem decide é o servidor.
 *
 * Cada constante aqui ESPELHA uma string de `backend/src/services/*.ts`. O
 * `switch` abaixo só acerta se os dois lados concordarem — por isso o valor é
 * copiado, não inventado. (Já houve `EMAIL_TAKEN` aqui contra
 * `EMAIL_ALREADY_IN_USE` no servidor: o `case` existia e nunca executava.)
 */

/** `409`: e-mail já cadastrado (`auth.service.ts`, `ConflictError`). */
export const EMAIL_ALREADY_IN_USE = 'EMAIL_ALREADY_IN_USE';
/** `401`: e-mail ou senha incorretos. */
export const INVALID_CREDENTIALS = 'INVALID_CREDENTIALS';

export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

/**
 * Traduz `ApiError` em texto apresentável.
 *
 * Retorna `null` quando não há nada a dizer além da mensagem original — nesse
 * caso a UI usa `error.message`, que já vem em português do backend.
 */
export function explainAuthError(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;

  switch (error.code) {
    case INVALID_CREDENTIALS:
      // Não distingue "e-mail não existe" de "senha errada": confirmar isso
      // seria um oráculo de cadastro válido.
      return 'E-mail ou senha incorretos.';

    case EMAIL_ALREADY_IN_USE:
      return 'Já existe uma conta com este e-mail.';

    case 'VALIDATION_ERROR':
      // O backend devolve `details` campo a campo; mostra o primeiro problema.
      const detail = firstDetail(error.details);
      return detail ?? error.message;

    default:
      return null;
  }
}

function firstDetail(details: ApiErrorBodyDetails): string | null {
  if (!Array.isArray(details)) return null;
  const first = details[0];
  return first && typeof first.message === 'string' ? first.message : null;
}

type ApiErrorBodyDetails = ApiError['details'];

export async function register(input: RegisterInput): Promise<AuthResult> {
  const result = await request<AuthResult>('/auth/register', {
    method: 'POST',
    body: input,
    auth: false,
  });

  // O backend já devolve o token; persistimos antes de "entrar".
  await tokenStorage.set(result.token);

  return result;
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const result = await request<AuthResult>('/auth/login', {
    method: 'POST',
    body: input,
    auth: false,
  });

  await tokenStorage.set(result.token);

  return result;
}

export async function logout(): Promise<void> {
  await tokenStorage.clear();
}

/**
 * Revalida a sessão salva.
 *
 * Chamada no boot: o token pode estar no disco mas expirado (ou o token pode
 * ter sido revogado). O `GET /auth/me` é a única forma de saber — não
 * presumimos que "token presente" = "sessão válida". Um 401 aqui é esperado e
 * vira "deslogado", não erro.
 */
export async function restoreSession(signal?: AbortSignal): Promise<User | null> {
  const token = await tokenStorage.get();
  if (!token) return null;

  try {
    const result = await request<{ user: User }>('/auth/me', { signal });
    return result.user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    // Falha de rede aqui NÃO significa sessão encerrada: pode ser o backend
    // fora do ar. Propagar deixa a UI distinguir "sem conexão" de "deslogado".
    throw error;
  }
}

export interface UpdateProfileInput {
  name?: string | null;
  timezone?: string;
}

export async function updateProfile(
  input: UpdateProfileInput,
  signal?: AbortSignal,
): Promise<User> {
  const result = await request<{ user: User }>('/auth/me', {
    method: 'PATCH',
    body: input,
    signal,
  });

  return result.user;
}