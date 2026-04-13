import { useEffect, useState } from "react";
import { Routes, Route, useParams } from "react-router-dom";
import {
  FluentProvider,
  webLightTheme,
  webDarkTheme,
  Spinner,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  MessageBarActions,
  Button,
} from "@fluentui/react-components";
import { AuthProvider, useAuth } from "./auth";
import { I18nProvider, useI18n } from "./i18n";
import { PageLayout } from "./components/PageLayout";
import { InitPage } from "./components/InitPage";
import { LoginPage } from "./components/LoginPage";
import { TodoPage } from "./components/TodoPage";
import { SharedPage } from "./components/SharedPage";
import { CallbackPage } from "./components/CallbackPage";

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

function SharedRoute() {
  const { token } = useParams<{ token: string }>();
  return (
    <PageLayout>
      <SharedPage token={token!} />
    </PageLayout>
  );
}

function AppShell() {
  const { user, loading, sessionExpiredNotice, goToLogin } = useAuth();
  const { configured, markConfigured } = useInitStatus();
  const { t } = useI18n();

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
      {sessionExpiredNotice && (
        <MessageBar intent="error" style={{ margin: "12px 16px 0" }}>
          <MessageBarBody>
            <MessageBarTitle>{t.sessionExpiredTitle}</MessageBarTitle>
            {t.sessionExpiredBody}
          </MessageBarBody>
          <MessageBarActions
            containerAction={
              <Button appearance="primary" onClick={() => void goToLogin()}>
                {t.sessionExpiredGoLogin}
              </Button>
            }
          />
        </MessageBar>
      )}
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
          <Routes>
            <Route path="/shared/:token" element={<SharedRoute />} />
            <Route path="/callback" element={<CallbackPage />} />
            <Route path="*" element={<AppShell />} />
          </Routes>
        </AuthProvider>
      </I18nProvider>
    </FluentProvider>
  );
}
