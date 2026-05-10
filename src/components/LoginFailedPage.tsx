import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Button,
  Title1,
  Body1,
  Body2,
  Card,
  CardHeader,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { ErrorCircle24Regular } from "@fluentui/react-icons";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";

const useStyles = makeStyles({
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100%",
    padding: "24px",
  },
  card: {
    maxWidth: "440px",
    width: "100%",
    padding: "32px",
    textAlign: "center",
  },
  icon: {
    fontSize: "48px",
    color: tokens.colorPaletteRedForeground1,
    marginBottom: "16px",
  },
  title: {
    marginBottom: "8px",
  },
  description: {
    marginBottom: "16px",
    color: tokens.colorNeutralForeground3,
  },
  detail: {
    display: "block",
    marginBottom: "24px",
    padding: "8px 12px",
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground2,
    wordBreak: "break-word",
  },
  actions: {
    display: "flex",
    gap: "8px",
    justifyContent: "center",
    flexWrap: "wrap",
  },
});

export function LoginFailedPage() {
  const styles = useStyles();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const { t } = useI18n();

  const reason = searchParams.get("reason") ?? "";
  const message = searchParams.get("message") ?? "";

  const description = (() => {
    switch (reason) {
      case "not_authorized":
        return t.loginFailedDescNotAuthorized;
      case "state_mismatch":
        return t.loginFailedDescStateMismatch;
      case "provider_denied":
        return t.loginFailedDescProviderDenied;
      case "exchange_failed":
        return t.loginFailedDescExchangeFailed;
      case "network_error":
        return t.loginFailedDescNetworkError;
      default:
        return t.loginFailedDescDefault;
    }
  })();

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        <CardHeader image={<ErrorCircle24Regular className={styles.icon} />} />
        <Title1 className={styles.title}>{t.loginFailedTitle}</Title1>
        <Body1 className={styles.description}>{description}</Body1>
        {message && <Body2 className={styles.detail}>{message}</Body2>}
        <div className={styles.actions}>
          <Button appearance="primary" onClick={() => void login()}>
            {t.loginFailedTryAgain}
          </Button>
          <Button appearance="secondary" onClick={() => navigate("/")}>
            {t.notAuthorizedGoHome}
          </Button>
        </div>
      </Card>
    </div>
  );
}
