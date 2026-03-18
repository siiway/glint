import { Caption1, Link, makeStyles, tokens } from "@fluentui/react-components";

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

  return (
    <div className={styles.footer}>
      <Caption1>
        <Link href="https://github.com/siiway/glint" target="_blank">
          GitHub
        </Link>
        <span className={styles.dot}>&middot;</span>
        Licensed under the{" "}
        <Link href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank">
          GNU GPL v3.0
        </Link>
      </Caption1>
    </div>
  );
}
