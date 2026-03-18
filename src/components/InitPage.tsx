import { useState } from "react";
import {
  Button,
  Title1,
  Title3,
  Body1,
  Body2,
  Card,
  Input,
  Switch,
  Spinner,
  Divider,
  makeStyles,
  tokens,
  MessageBar,
  MessageBarBody,
} from "@fluentui/react-components";
import { Database24Regular } from "@fluentui/react-icons";

const useStyles = makeStyles({
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100%",
    padding: "24px",
  },
  card: {
    maxWidth: "560px",
    width: "100%",
    padding: "32px",
  },
  header: {
    textAlign: "center",
    marginBottom: "24px",
  },
  icon: {
    fontSize: "48px",
    color: tokens.colorBrandForeground1,
    marginBottom: "16px",
    display: "block",
    marginLeft: "auto",
    marginRight: "auto",
  },
  title: {
    marginBottom: "8px",
  },
  subtitle: {
    color: tokens.colorNeutralForeground3,
  },
  section: {
    marginBottom: "20px",
  },
  sectionTitle: {
    marginBottom: "12px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    marginBottom: "12px",
  },
  fieldLabel: {
    fontWeight: "600",
  },
  fieldHint: {
    fontSize: "12px",
    color: tokens.colorNeutralForeground4,
  },
  error: {
    marginBottom: "16px",
  },
  actions: {
    display: "flex",
    justifyContent: "center",
    marginTop: "24px",
  },
});

export function InitPage({ onComplete }: { onComplete: () => void }) {
  const styles = useStyles();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"config" | "confirm">("config");

  // Config fields
  const [prismBaseUrl, setPrismBaseUrl] = useState("https://prism.siiway.org");
  const [prismClientId, setPrismClientId] = useState("");
  const [prismRedirectUri, setPrismRedirectUri] = useState(
    `${window.location.origin}/callback`,
  );
  const [allowedTeamId, setAllowedTeamId] = useState("");
  const [usePkce, setUsePkce] = useState(true);
  const [prismClientSecret, setPrismClientSecret] = useState("");

  const isValid =
    prismBaseUrl.trim() !== "" &&
    prismClientId.trim() !== "" &&
    (usePkce || prismClientSecret.trim() !== "");

  const runSetup = async () => {
    setRunning(true);
    setError(null);

    try {
      const res = await fetch("/api/init/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: {
            prism_base_url: prismBaseUrl.trim(),
            prism_client_id: prismClientId.trim(),
            prism_client_secret: prismClientSecret.trim(),
            prism_redirect_uri: prismRedirectUri.trim(),
            use_pkce: usePkce,
            allowed_team_id: allowedTeamId.trim(),
          },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Setup failed" }));
        throw new Error((data as { error?: string }).error || "Setup failed");
      }
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Setup failed");
      setRunning(false);
    }
  };

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        <div className={styles.header}>
          <Database24Regular className={styles.icon} />
          <Title1 className={styles.title}>Welcome to Glint</Title1>
          <br />
          <Body1 className={styles.subtitle}>
            {step === "config"
              ? "Configure your Prism identity provider and app settings."
              : "Review your configuration and initialize the database."}
          </Body1>
        </div>

        {error && (
          <MessageBar intent="error" className={styles.error}>
            <MessageBarBody>{error}</MessageBarBody>
          </MessageBar>
        )}

        {step === "config" && (
          <>
            <div className={styles.section}>
              <Title3 className={styles.sectionTitle}>
                Prism OAuth Configuration
              </Title3>

              <div className={styles.field}>
                <Body2 className={styles.fieldLabel}>Prism Base URL *</Body2>
                <Input
                  value={prismBaseUrl}
                  onChange={(_, d) => setPrismBaseUrl(d.value)}
                  placeholder="https://prism.siiway.org"
                />
                <span className={styles.fieldHint}>
                  The base URL of your Prism identity server.
                </span>
              </div>

              <div className={styles.field}>
                <Body2 className={styles.fieldLabel}>Client ID *</Body2>
                <Input
                  value={prismClientId}
                  onChange={(_, d) => setPrismClientId(d.value)}
                  placeholder="prism_xxxxx"
                />
                <span className={styles.fieldHint}>
                  The OAuth client ID from your Prism app.
                </span>
              </div>

              <div className={styles.field}>
                <Switch
                  label="Use PKCE (public client)"
                  checked={usePkce}
                  onChange={(_, d) => setUsePkce(d.checked)}
                />
                <span className={styles.fieldHint}>
                  Enable for public clients (no secret). Disable for
                  confidential clients with a client secret.
                </span>
              </div>

              {!usePkce && (
                <div className={styles.field}>
                  <Body2 className={styles.fieldLabel}>Client Secret *</Body2>
                  <Input
                    value={prismClientSecret}
                    onChange={(_, d) => setPrismClientSecret(d.value)}
                    placeholder="your-client-secret"
                    type="password"
                  />
                  <span className={styles.fieldHint}>
                    Required for confidential clients (non-PKCE).
                  </span>
                </div>
              )}

              <div className={styles.field}>
                <Body2 className={styles.fieldLabel}>Redirect URI</Body2>
                <Input
                  value={prismRedirectUri}
                  onChange={(_, d) => setPrismRedirectUri(d.value)}
                  placeholder={`${window.location.origin}/callback`}
                />
                <span className={styles.fieldHint}>
                  Must match the redirect URI configured in Prism. Defaults to{" "}
                  {window.location.origin}/callback.
                </span>
              </div>
            </div>

            <Divider />

            <div className={styles.section} style={{ marginTop: 20 }}>
              <Title3 className={styles.sectionTitle}>Access Control</Title3>

              <div className={styles.field}>
                <Body2 className={styles.fieldLabel}>
                  Allowed Team ID (optional)
                </Body2>
                <Input
                  value={allowedTeamId}
                  onChange={(_, d) => setAllowedTeamId(d.value)}
                  placeholder="Leave empty to allow all teams"
                />
                <span className={styles.fieldHint}>
                  If set, only members of this Prism team can sign in.
                </span>
              </div>
            </div>

            <div className={styles.actions}>
              <Button
                appearance="primary"
                size="large"
                disabled={!isValid}
                onClick={() => setStep("confirm")}
              >
                Continue
              </Button>
            </div>
          </>
        )}

        {step === "confirm" && (
          <>
            <div className={styles.section}>
              <Title3 className={styles.sectionTitle}>
                Review Configuration
              </Title3>

              <div className={styles.field}>
                <Body2 className={styles.fieldLabel}>Prism Base URL</Body2>
                <Body1>{prismBaseUrl}</Body1>
              </div>

              <div className={styles.field}>
                <Body2 className={styles.fieldLabel}>Client ID</Body2>
                <Body1>{prismClientId}</Body1>
              </div>

              <div className={styles.field}>
                <Body2 className={styles.fieldLabel}>Auth Flow</Body2>
                <Body1>
                  {usePkce
                    ? "PKCE (public client)"
                    : "Confidential client (with secret)"}
                </Body1>
              </div>

              <div className={styles.field}>
                <Body2 className={styles.fieldLabel}>Redirect URI</Body2>
                <Body1>{prismRedirectUri || "(auto-detect)"}</Body1>
              </div>

              <div className={styles.field}>
                <Body2 className={styles.fieldLabel}>Allowed Team ID</Body2>
                <Body1>{allowedTeamId || "(all teams)"}</Body1>
              </div>
            </div>

            <Divider />

            <Body1
              style={{
                marginTop: 16,
                color: tokens.colorNeutralForeground3,
              }}
            >
              This will create the database tables and save your configuration.
              You can change these settings later in the admin panel.
            </Body1>

            <div className={styles.actions} style={{ gap: 8 }}>
              <Button
                appearance="secondary"
                size="large"
                onClick={() => setStep("config")}
                disabled={running}
              >
                Back
              </Button>
              <Button
                appearance="primary"
                size="large"
                onClick={runSetup}
                disabled={running}
                icon={running ? <Spinner size="tiny" /> : undefined}
              >
                {running ? "Setting up..." : "Initialize"}
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
