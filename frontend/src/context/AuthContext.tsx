import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { storage } from "@/src/utils/storage";
import { authApi, AuthUser } from "@/src/lib/backend";
import { setAuthToken } from "@/src/lib/client";

const TOKEN_KEY = "auth_token";

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, nickname: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: AuthUser) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    const t = await storage.secureGet<string>(TOKEN_KEY, "");
    if (!t) { setLoading(false); return; }
    setAuthToken(t);
    setToken(t);
    try {
      const me = await authApi.me();
      setUserState(me);
    } catch {
      setAuthToken(null);
      setToken(null);
      await storage.secureRemove(TOKEN_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { bootstrap(); }, [bootstrap]);

  const persist = async (t: string, u: AuthUser) => {
    setAuthToken(t);
    setToken(t);
    setUserState(u);
    await storage.secureSet(TOKEN_KEY, t);
  };

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    await persist(res.access_token, res.user);
  };

  const register = async (email: string, nickname: string, password: string) => {
    const res = await authApi.register(email, nickname, password);
    await persist(res.access_token, res.user);
  };

  const logout = async () => {
    setAuthToken(null);
    setToken(null);
    setUserState(null);
    await storage.secureRemove(TOKEN_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, setUser: setUserState }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
