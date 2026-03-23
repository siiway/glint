import { useEffect, useState } from "react";
import {
  FluentProvider,
  webLightTheme,
  webDarkTheme,
  Spinner,
} from "@fluentui/react-components";
import { AuthProvider, useAuth } from "./auth";
import { I18nProvider, useI18n } from "./i18n";
import { PageLayout } from "./components/PageLayout";
import { InitPage } from "./components/InitPage";
import { LoginPage } from "./components/LoginPage";
import { TodoPage } from "./components/TodoPage";
import { SharedPage } from "./components/SharedPage";

function useColorScheme() {
  const [dark, setDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return dark;
}

function useInitStatus() {
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/init/status")
      .then((res) => res.json())
      .then((data: { configured: boolean }) => setConfigured(data.configured))
      .catch(() => setConfigured(false));
  }, []);

  return { configured, markConfigured: () => setConfigured(true) };
}

function useSharedToken(): string | null {
  const [token, setToken] = useState<string | null>(() => {
    const match = window.location.pathname.match(/^\/shared\/([a-f0-9]+)$/);
    return match ? match[1] : null;
  });
  useEffect(() => {
    const handler = () => {
      const match = window.location.pathname.match(/^\/shared\/([a-f0-9]+)$/);
      setToken(match ? match[1] : null);
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);
  return token;
}

function AppContent() {
  const { user, loading } = useAuth();
  const { configured, markConfigured } = useInitStatus();
  const { t } = useI18n();
  const sharedToken = useSharedToken();

  if (sharedToken) {
    return (
      <PageLayout>
        <SharedPage token={sharedToken} />
      </PageLayout>
    );
  }

  if (loading || configured === null) {
    return (
      <PageLayout>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100%",
          }}
        >
          <Spinner size="large" label={t.loading} />
        </div>
      </PageLayout>
    );
  }

  if (!configured) {
    return (
      <PageLayout>
        <InitPage onComplete={markConfigured} />
      </PageLayout>
    );
  }

  if (!user) {
    return (
      <PageLayout>
        <LoginPage />
      </PageLayout>
    );
  }

  return (
    <PageLayout footer={false}>
      <TodoPage />
    </PageLayout>
  );
}

export default function App() {
  const dark = useColorScheme();

  return (
    <FluentProvider
      theme={dark ? webDarkTheme : webLightTheme}
      style={{ height: "100%" }}
    >
      <I18nProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </I18nProvider>
    </FluentProvider>
  );
}
