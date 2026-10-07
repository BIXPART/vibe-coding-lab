/**
 * Serviço central de comunicação com a API.
 *
 * A URL da API é definida em UM único lugar:
 * - variável de ambiente EXPO_PUBLIC_API_URL (recomendado)
 * - ou fallback para http://localhost:3000/api em desenvolvimento
 *
 * O backend no Render Free pode demorar para "acordar" (cold start),
 * então as requisições possuem timeout e estado de erro claro.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

// Timeout maior que o padrão para absorver o cold start do Render Free
const DEFAULT_TIMEOUT_MS = 20000;

const TOKEN_KEY = '@valistock:token';

export const getToken = async () => AsyncStorage.getItem(TOKEN_KEY);
export const setToken = async (token) => AsyncStorage.setItem(TOKEN_KEY, token);
export const clearToken = async () => AsyncStorage.removeItem(TOKEN_KEY);

/**
 * Erro customizado para tratamento amigável nas telas.
 */
class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Requisição base com timeout, token e padronização de resposta.
 */
const request = async (endpoint, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  const url = `${API_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const token = await getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new ApiError(
        'O servidor demorou para responder. Verifique sua conexão e tente novamente.',
        408
      );
    }
    throw new ApiError(
      'Não foi possível conectar ao servidor. Verifique sua conexão.',
      0
    );
  }
  clearTimeout(timeoutId);

  let body = null;
  const text = await response.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch (_e) {
      body = null;
    }
  }

  if (!response.ok) {
    const message =
      (body && body.message) ||
      `Erro inesperado do servidor (${response.status})`;

    // Token expirado/inválido → sinaliza para o AuthContext deslogar
    if (response.status === 401) {
      const err = new ApiError(message, 401);
      err.unauthorized = true;
      throw err;
    }

    throw new ApiError(message, response.status);
  }

  // Resposta padronizada da API: { success, data }
  return body && body.data !== undefined ? body.data : body;
};

/**
 * Wrapper HTTP.
 */
const api = {
  get: (endpoint, options) => request(endpoint, { method: 'GET', ...options }),

  post: (endpoint, body, options) =>
    request(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    }),

  put: (endpoint, body, options) =>
    request(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    }),

  delete: (endpoint, options) =>
    request(endpoint, { method: 'DELETE', ...options }),

  /**
   * Upload de arquivo CSV (multipart/form-data).
   * Usa FormData (suportado pelo React Native).
   */
  upload: (endpoint, formData, options) =>
    request(
      endpoint,
      {
        method: 'POST',
        body: formData,
        headers: {}, // FormData define o Content-Type automaticamente
        ...options,
      },
      60000 // upload pode demorar mais
    ),
};

export { ApiError };
export default api;
