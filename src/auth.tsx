import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { PrismClient } from "@siiway/prism";

export type TeamInfo = {
  id: string;
  name: string;
  role: "owner" | "co-owner" | "admin" | "member";
  avatarUrl?: string;
};

export type User = {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  teams: TeamInfo[];
  isAppToken?: boolean;
};

type AuthConfig = {
  baseUrl: string;
  clientId: string;
  redirectUri: string;
  usePkce: boolean;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  sessionExpiredNotice: boolean;
  appTokenWarning: boolean;
  dismissAppTokenWarning: () => void;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  goToLogin: () => Promise<void>;
  handleCallback: (code: string, codeVerifier?: string) => Promise<boolean>;
};

const AuthContext = createContext<AuthContextType | null>(null);

// Lazily initialized from /api/auth/config
let configPromise: Promise<AuthConfig> | null = null;
let prismPromise: Promise<PrismClient> | null = null;

function getConfig(): Promise<AuthConfig> {
  if (!configPromise) {
    configPromise = fetch("/api/auth/config")
      .then((res) => res.json())
      .then((cfg: AuthConfig) => ({
        baseUrl: cfg.baseUrl,
        clientId: cfg.clientId,
        redirectUri: cfg.redirectUri || `${window.location.origin}/callback`,
        usePkce: cfg.usePkce ?? true,
      }));
  }
  return configPromise;
}

function getPrism(): Promise<PrismClient> {
  if (!prismPromise) {
    prismPromise = getConfig().then(
      (cfg) =>
        new PrismClient({
          baseUrl: cfg.baseUrl,
          clientId: cfg.clientId,
          redirectUri: cfg.redirectUri,
          scopes: ["openid", "profile", "email", "teams:read"],
        }),
    );
  }
  return prismPromise;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState(false);
  const [appTokenWarning, setAppTokenWarning] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data: { user: User | null }) => {
        setUser(data.user);
        if (data.user?.isAppToken) setAppTokenWarning(true);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const dismissAppTokenWarning = useCallback(
    () => setAppTokenWarning(false),
    [],
  );

  // Show persistent session-expired notice on 401; let users decide when to re-login.
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const res = await originalFetch(...args);
      if (res.status === 401 && user) {
        const url =
          typeof args[0] === "string"
            ? args[0]
            : args[0] instanceof Request
              ? args[0].url
              : "";
        // Don't trigger on auth endpoints to avoid loops
        if (url.includes("/api/") && !url.includes("/api/auth/")) {
          setSessionExpiredNotice(true);
        }
      }
      return res;
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, [user]);

  const login = useCallback(async () => {
    const cfg = await getConfig();
    const prism = await getPrism();

    if (cfg.usePkce) {
      const { url, pkce } = await prism.createAuthorizationUrl();
      sessionStorage.setItem("pkce_verifier", pkce.codeVerifier);
      sessionStorage.setItem("pkce_state", pkce.state);
      window.location.href = url;
    } else {
      // Non-PKCE: simple authorization URL without code challenge
      const state = PrismClient.generateState();
      const params = new URLSearchParams({
        response_type: "code",
        client_id: cfg.clientId,
        redirect_uri: cfg.redirectUri,
        scope: "openid profile email teams:read",
        state,
      });
      sessionStorage.setItem("pkce_state", state);
      window.location.href = `${cfg.baseUrl}/api/oauth/authorize?${params}`;
    }
  }, []);

  const handleCallback = useCallback(
    async (code: string, codeVerifier?: string): Promise<boolean> => {
      const body: { code: string; codeVerifier?: string } = { code };
      if (codeVerifier) body.codeVerifier = codeVerifier;

      const res = await fetch("/api/auth/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) return false;

      const data: { user: User } = await res.json();
      setUser(data.user);
      setSessionExpiredNotice(false);
      if (data.user?.isAppToken) setAppTokenWarning(true);
      return true;
    },
    [],
  );

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setSessionExpiredNotice(false);
  }, []);

  const goToLogin = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    setSessionExpiredNotice(false);
  }, []);

  return (
    <AuthContext
      value={{
        user,
        loading,
        sessionExpiredNotice,
        appTokenWarning,
        dismissAppTokenWarning,
        login,
        logout,
        goToLogin,
        handleCallback,
      }}
    >
      {children}
    </AuthContext>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
