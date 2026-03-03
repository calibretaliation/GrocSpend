import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { User } from "../types";
import { DEV_USER, DEV_TOKEN } from "../services/devData";

export type AuthorizedFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

interface SessionData {
  token: string;
  user: User;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  authorizedFetch: AuthorizedFetch;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = "smart_spend_session";

const IS_DEV_MODE = import.meta.env.VITE_DEV_MODE === "true";

const readStoredSession = (): SessionData | null => {
  if (IS_DEV_MODE) {
    return { token: DEV_TOKEN, user: DEV_USER };
  }
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SessionData;
    if (parsed.token && parsed.user) {
      return parsed;
    }
  } catch (error) {
    console.warn("Failed to parse stored session", error);
  }
  return null;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSession(readStoredSession());
    setLoading(false);
  }, []);

  const persistSession = useCallback((data: SessionData | null) => {
    if (typeof window === "undefined") return;
    if (data) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const handleAuthResponse = useCallback((data: any) => {
    if (!data?.token || !data?.user) {
      throw new Error("Malformed authentication response.");
    }
    const nextSession: SessionData = {
      token: data.token,
      user: data.user,
    };
    setSession(nextSession);
    persistSession(nextSession);
  }, [persistSession]);

  const authorizedFetch = useCallback<AuthorizedFetch>(
    async (input, init) => {
      if (!session?.token) {
        throw new Error("Not authenticated");
      }

      const headers = new Headers(init?.headers ?? undefined);
      headers.set("Authorization", `Bearer ${session.token}`);

      return fetch(input, {
        ...init,
        headers,
      });
    },
    [session?.token]
  );

  const login = useCallback(
    async (username: string, password: string) => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to log in.");
      }

      const data = await response.json();
      handleAuthResponse(data);
    },
    [handleAuthResponse]
  );

  const register = useCallback(
    async (username: string, password: string) => {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to register.");
      }

      const data = await response.json();
      handleAuthResponse(data);
    },
    [handleAuthResponse]
  );

  const logout = useCallback(async () => {
    if (session?.token) {
      try {
        await authorizedFetch("/api/auth/logout", { method: "POST" });
      } catch (error) {
        console.warn("Failed to revoke session", error);
      }
    }
    setSession(null);
    persistSession(null);
  }, [authorizedFetch, persistSession, session?.token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      loading,
      login,
      register,
      logout,
      authorizedFetch,
    }),
    [session, loading, login, register, logout, authorizedFetch]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
