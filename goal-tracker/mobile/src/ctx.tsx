/**
 * Sessão do usuário.
 *
 * ## Estados possíveis (e por que são três, não dois)
 *
 * | Estado        | Significado                                  | Vai para |
 * |---------------|----------------------------------------------|----------|
 * | `restoring`   | boot, ainda não sabemos se há token válido   | splash   |
 * | `signedOut`   | sem sessão                                    | login    |
 * | `signedIn`    | com sessão                                    | app      |
 *
 * O estado `restoring` é separado de propósito: sem ele, o app pisca a tela de
 * login antes de revalidar o token, e o usuário vê um "flash" de logout em
 * cada abertura. É o bug clássico de sessão em app com Router.
 *
 * ## Regra 7: fuso detectado no device
 *
 * O backend usa o timezone do usuário para decidir o dia/período (regra 7). Se
 * o usuário mudou de fuso — viagem, mudança de celular — o valor salvo ficou
 * errado e TODA a lógica de período passa a usar o dia errado. Por isso o boot
 * detecta o fuso do aparelho e sincroniza em `PATCH /auth/me`.
 *
 * A sincronização é fire-and-forget: falhar aqui não pode impedir o login.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { setUnauthorizedHandler } from '@/services/api';
import * as auth from '@/services/auth';
import type { LoginInput, RegisterInput, UpdateProfileInput } from '@/services/auth';
import type { User } from '@/types/api';

export type SessionStatus = 'restoring' | 'signedOut' | 'signedIn';

export interface SessionContextValue {
  status: SessionStatus;
  user: User | null;
  login(input: LoginInput): Promise<void>;
  register(input: RegisterInput): Promise<void>;
  logout(): Promise<void>;
  updateProfile(input: UpdateProfileInput): Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Fuso IANA do aparelho.
 *
 * O `Intl` faz parte do runtime (Hermes) e conhece a base `tzdata` do
 * dispositivo, então funciona sem dependência e offline.
 */
function detectTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('restoring');
  const [user, setUser] = useState<User | null>(null);

  // Guarda se já tentamos o boot, para o StrictMode do React não disparar duas
  // leituras do storage e dois `PATCH /auth/me`.
  const booted = useRef(false);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;

    let cancelled = false;

    async function boot() {
      try {
        const restored = await auth.restoreSession();

        if (cancelled) return;

        if (!restored) {
          setStatus('signedOut');
          return;
        }

        setUser(restored);
        setStatus('signedIn');

        // Só sincroniza fuso se mudou. Um PATCH a cada abertura gastaria
        // requisição e-riskaria 429 no rate limit.
        const deviceTimeZone = detectTimeZone();
        if (deviceTimeZone && deviceTimeZone !== restored.timezone) {
          void auth
            .updateProfile({ timezone: deviceTimeZone })
            .then(setUser)
            .catch(() => {
              // Falhou: o usuário fica com o fuso salvo. Ainda funciona; só a
              // precisão cai. Não vale bloquear o login por isso.
            });
        }
      } catch (error) {
        // `restoreSession` só propaga erro de rede. Isso é "não deu para
        // verificar", não "sem sessão" — treatamos como offline, com o app
        // utilizável em modo local.
        if (!cancelled) {
          setUser(null);
          setStatus('signedOut');
        }
        throw error;
      }
    }

    void boot().catch(() => undefined);
  }, []);

  // 401 vindo de qualquer requisição: a sessão morreu no servidor.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setStatus('signedOut');
    });

    return () => setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const result = await auth.login(input);
    setUser(result.user);
    setStatus('signedIn');
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const result = await auth.register(input);
    setUser(result.user);
    setStatus('signedIn');
  }, []);

  const logout = useCallback(async () => {
    await auth.logout();
    setUser(null);
    setStatus('signedOut');
  }, []);

  const updateProfile = useCallback(async (input: UpdateProfileInput) => {
    setUser(await auth.updateProfile(input));
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({ status, user, login, register, logout, updateProfile }),
    [status, user, login, register, logout, updateProfile],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error('useSession precisa estar dentro de <SessionProvider>.');
  }

  return context;
}

/** Atalho para telas que só existem dentro de `(app)`. */
export function useCurrentUser(): User {
  const { user } = useSession();

  if (!user) {
    // Bug de navegação, não estado de usuário: falhar alto é melhor que
    // renderizar `null.user` três telas adiante.
    throw new Error('useCurrentUser chamado fora de uma rota autenticada.');
  }

  return user;
}