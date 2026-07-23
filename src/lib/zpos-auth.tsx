import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { zdb, type AppUser, type Organization } from "./zpos-db";

const SESSION_KEY = "zpos:session:v1";

interface Session {
  userId: string;
}

interface AuthCtx {
  user: AppUser | null;
  org: Organization | null;
  login: (identifier: string, password: string) => { ok: boolean; error?: string };
  logout: () => void;
  ready: boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      try {
        const s = JSON.parse(raw) as Session;
        const db = zdb.get();
        const u = db.users.find((x) => x.id === s.userId) ?? null;
        setUser(u);
        setOrg(u?.orgId ? (db.orgs.find((o) => o.id === u.orgId) ?? null) : null);
      } catch {
        /* noop */
      }
    }
    setReady(true);
  }, []);

  const login: AuthCtx["login"] = (identifier, password) => {
    const db = zdb.get();
    const u = db.users.find(
      (x) =>
        (x.email.toLowerCase() === identifier.toLowerCase() ||
          x.phone === identifier) &&
        x.password === password,
    );
    if (!u) return { ok: false, error: "Invalid credentials" };
    if (u.disabled) return { ok: false, error: "Account disabled" };
    const o = u.orgId ? (db.orgs.find((x) => x.id === u.orgId) ?? null) : null;
    if (o && o.status === "suspended")
      return { ok: false, error: "Organization suspended" };
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: u.id }));
    setUser(u);
    setOrg(o);
    return { ok: true };
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
    setOrg(null);
  };

  return (
    <Ctx.Provider value={{ user, org, login, logout, ready }}>{children}</Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}

export function useDbVersion() {
  const [, setV] = useState(0);
  useEffect(() => {
    const unsub = zdb.subscribe(() => setV((n) => n + 1));
    return () => {
      unsub();
    };
  }, []);
}
