import { useNavigate } from "react-router-dom";
import {
  Button,
  Title1,
  Body1,
  Card,
  CardHeader,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { LockClosed24Regular } from "@fluentui/react-icons";
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
    color: tokens.colorPaletteRedForeground1,
    marginBottom: "16px",
  },
  title: {
    marginBottom: "8px",
  },
  subtitle: {
    marginBottom: "24px",
    color: tokens.colorNeutralForeground3,
  },
});

export function NotAuthorizedPage() {
  const styles = useStyles();
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        <CardHeader image={<LockClosed24Regular className={styles.icon} />} />
        <Title1 className={styles.title}>{t.notAuthorizedTitle}</Title1>
        <Body1 className={styles.subtitle}>{t.notAuthorizedDesc}</Body1>
        <Button appearance="primary" size="large" onClick={() => navigate("/")}>
          {t.notAuthorizedGoHome}
        </Button>
      </Card>
    </div>
  );
}
