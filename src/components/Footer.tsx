import { Caption1, Link, makeStyles, tokens } from "@fluentui/react-components";
import { useI18n } from "../i18n";

const useStyles = makeStyles({
  footer: {
    padding: "12px 16px",
    textAlign: "center" as const,
    color: tokens.colorNeutralForeground4,
    flexShrink: 0,
  },
  dot: {
    margin: "0 6px",
  },
});

export function Footer() {
  const styles = useStyles();
  const { t } = useI18n();

  return (
    <div className={styles.footer}>
      <Caption1>
        <Link href="https://github.com/siiway/glint" target="_blank">
          {t.footerGitHub}
        </Link>
        <span className={styles.dot}>&middot;</span>
        {t.footerLicense}{" "}
        <Link href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank">
          {t.footerLicenseName}
        </Link>
      </Caption1>
    </div>
  );
}
