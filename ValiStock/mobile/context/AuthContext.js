/**
 * Contexto de autenticação.
 * Guarda o token no AsyncStorage e expõe login/logout para as telas.
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import api, { getToken, setToken, clearToken } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // verificando token salvo

  // Ao iniciar: verifica se há sessão salva
  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (token) {
          const me = await api.get('/auth/me');
          setUser(me);
        }
      } catch (_error) {
        // Token expirado ou inválido → limpa
        await clearToken();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email, password) => {
    const result = await api.post('/auth/login', { email, password });
    await setToken(result.token);
    setUser(result.user);
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    await clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
