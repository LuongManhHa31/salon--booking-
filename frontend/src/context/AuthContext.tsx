import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { apiFetch, getToken, setToken } from "../api/client";
import { Account } from "../types";

interface AuthContextValue {
  account: Account | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<Account>;
  register: (fullName: string, phone: string, email: string | undefined, password: string) => Promise<Account>;
  loginWithOtp: (phone: string, code: string, fullName?: string) => Promise<Account>;
  refreshAccount: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    apiFetch<{ account: Account }>("/auth/me")
      .then((res) => setAccount(res.account))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(identifier: string, password: string) {
    const res = await apiFetch<{ token: string; account: Account }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    });
    setToken(res.token);
    setAccount(res.account);
    return res.account;
  }

  async function register(fullName: string, phone: string, email: string | undefined, password: string) {
    const res = await apiFetch<{ token: string; account: Account }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ fullName, phone, email, password }),
    });
    setToken(res.token);
    setAccount(res.account);
    return res.account;
  }

  async function loginWithOtp(phone: string, code: string, fullName?: string) {
    const res = await apiFetch<{ token: string; account: Account }>("/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify({ phone, code, fullName }),
    });
    setToken(res.token);
    setAccount(res.account);
    return res.account;
  }

  async function refreshAccount() {
    const res = await apiFetch<{ account: Account }>("/auth/me");
    setAccount(res.account);
  }

  function logout() {
    setToken(null);
    setAccount(null);
  }

  return (
    <AuthContext.Provider value={{ account, loading, login, register, loginWithOtp, refreshAccount, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phải được dùng bên trong AuthProvider");
  return ctx;
}
