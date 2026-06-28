/**
 * Standard page header with title, optional subtitle, and optional action buttons.
 * Provides consistent spacing and typography across all pages.
 */
import type { ReactNode, CSSProperties } from "react";
import { Title2, makeStyles, tokens } from "@fluentui/react-components";

const useStyles = makeStyles({
  root: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: "12px",
    marginBottom: "24px",
  },
  text: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: 0,
  },
  subtitle: {
    color: tokens.colorNeutralForeground3,
  },
  actions: {
    display: "flex",
    gap: "8px",
    flexShrink: 0,
    alignItems: "center",
  },
});

type Props = {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  style?: CSSProperties;
};

export function PageHeader({ title, subtitle, actions, style }: Props) {
  const styles = useStyles();

  return (
    <div className={styles.root} style={style}>
      <div className={styles.text}>
        <Title2>{title}</Title2>
        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
