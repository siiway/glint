import { useEffect, useState } from "react";
import {
  Button,
  Title1,
  Body1,
  CardHeader,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { CheckmarkCircle24Regular } from "@fluentui/react-icons";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";
import { AuthShell } from "./AuthShell";

const useStyles = makeStyles({
  icon: {
    fontSize: "48px",
    color: tokens.colorBrandForeground1,
  },
  logo: {
    maxWidth: "160px",
    maxHeight: "48px",
    objectFit: "contain" as const,
  },
  subtitle: {
    color: tokens.colorNeutralForeground3,
  },
  actions: {
    display: "flex",
    justifyContent: "center",
    marginTop: "8px",
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
    <AuthShell cardGap={12}>
      {siteLogo ? (
        <img src={siteLogo} alt={siteName} className={styles.logo} />
      ) : (
        <CardHeader
          image={<CheckmarkCircle24Regular className={styles.icon} />}
        />
      )}
      <Title1>{siteName}</Title1>
      <Body1 className={styles.subtitle}>{t.tagline}</Body1>
      <div className={styles.actions}>
        <Button appearance="primary" size="large" onClick={login}>
          {t.signInWithPrism}
        </Button>
      </div>
    </AuthShell>
  );
}
