import { useEffect, useState } from "react";
import {
  Routes,
  Route,
  useParams,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
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
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogContent,
  DialogActions,
} from "@fluentui/react-components";
import { AuthProvider, useAuth } from "./auth";
import { I18nProvider, useI18n } from "./i18n";
import { PageLayout } from "./components/PageLayout";
import { InitPage } from "./components/InitPage";
import { LoginPage } from "./components/LoginPage";
import { TodoPage } from "./components/TodoPage";
import { SharedPage } from "./components/SharedPage";
import { CallbackPage } from "./components/CallbackPage";
import { NotAuthorizedPage } from "./components/NotAuthorizedPage";
import { buildLoginPath } from "./utils/authRedirect";

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
  const {
    user,
    loading,
    sessionExpiredNotice,
    appTokenWarning,
    dismissAppTokenWarning,
    goToLogin,
    logout,
  } = useAuth();
  const { configured, markConfigured } = useInitStatus();
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = `${location.pathname}${location.search}${location.hash}`;
  const loginPath = buildLoginPath(currentPath);

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
    return <Navigate to={loginPath} replace />;
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
              <Button
                appearance="primary"
                onClick={() => {
                  void goToLogin();
                  navigate(loginPath, { replace: true });
                }}
              >
                {t.sessionExpiredGoLogin}
              </Button>
            }
          />
        </MessageBar>
      )}
      <Dialog open={appTokenWarning} modalType="alert">
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{t.appTokenWarningTitle}</DialogTitle>
            <DialogContent>{t.appTokenWarningBody}</DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={dismissAppTokenWarning}>
                {t.continue}
              </Button>
              <Button appearance="primary" onClick={() => void logout()}>
                {t.signOut}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
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
            <Route
              path="/login"
              element={
                <PageLayout>
                  <LoginPage />
                </PageLayout>
              }
            />
            <Route
              path="/not-authorized"
              element={
                <PageLayout>
                  <NotAuthorizedPage />
                </PageLayout>
              }
            />
            <Route path="*" element={<AppShell />} />
          </Routes>
        </AuthProvider>
      </I18nProvider>
    </FluentProvider>
  );
}
