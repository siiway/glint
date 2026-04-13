import { useEffect, useState } from "react";
import {
  Button,
  Title1,
  Body1,
  Card,
  CardHeader,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { CheckmarkCircle24Regular } from "@fluentui/react-icons";
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
    maxWidth: "400px",
    width: "100%",
    padding: "32px",
    textAlign: "center",
  },
  icon: {
    fontSize: "48px",
    color: tokens.colorBrandForeground1,
    marginBottom: "16px",
  },
  logo: {
    maxWidth: "160px",
    maxHeight: "48px",
    objectFit: "contain" as const,
    marginBottom: "8px",
  },
  title: {
    marginBottom: "8px",
  },
  subtitle: {
    marginBottom: "24px",
    color: tokens.colorNeutralForeground3,
  },
});

export function LoginPage() {
  const styles = useStyles();
  const { login } = useAuth();
  const { t } = useI18n();
  const [siteName, setSiteName] = useState("Glint");
  const [siteLogo, setSiteLogo] = useState("");

  useEffect(() => {
    fetch("/api/init/branding")
      .then((r) => r.json())
      .then((data: { site_name?: string; site_logo_url?: string }) => {
        if (data.site_name) setSiteName(data.site_name);
        if (data.site_logo_url) setSiteLogo(data.site_logo_url);
      })
      .catch(() => {});
  }, []);

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        {siteLogo ? (
          <img src={siteLogo} alt={siteName} className={styles.logo} />
        ) : (
          <CardHeader
            image={<CheckmarkCircle24Regular className={styles.icon} />}
          />
        )}
        <Title1 className={styles.title}>{siteName}</Title1>
        <Body1 className={styles.subtitle}>{t.tagline}</Body1>
        <Button appearance="primary" size="large" onClick={login}>
          {t.signInWithPrism}
        </Button>
      </Card>
    </div>
  );
}
