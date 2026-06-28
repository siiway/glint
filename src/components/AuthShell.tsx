/**
 * Shared shell for all auth-style centered-card pages (login, register, init, error cards).
 * Owns the full-viewport layout, brand-gradient canvas, card styling, and entrance animation.
 * Exposes --auth-card-pad CSS var so full-bleed children can stretch edge-to-edge.
 */
import type { ReactNode } from "react";
import { makeStyles, tokens } from "@fluentui/react-components";

const useStyles = makeStyles({
  page: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "20px",
    padding: "32px 16px",
    backgroundColor: tokens.colorNeutralBackground2,
    backgroundImage: `radial-gradient(ellipse at 20% 80%, color-mix(in srgb, ${tokens.colorBrandBackground} 8%, transparent) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, color-mix(in srgb, ${tokens.colorBrandBackground} 8%, transparent) 0%, transparent 50%)`,
    backgroundAttachment: "fixed",
  },
  card: {
    width: "100%",
    borderRadius: "12px",
    border: `1px solid ${tokens.colorNeutralStroke3}`,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow16,
    display: "flex",
    flexDirection: "column",
    padding: "40px",
    "--auth-card-pad": "40px",
    animationName: "authCardEnter",
    animationDuration: "0.35s",
    animationTimingFunction: "cubic-bezier(0.33, 1, 0.68, 1)",
    animationFillMode: "both",
    "@media (prefers-reduced-motion: reduce)": {
      animationName: "none",
    },
    "@media (max-width: 480px)": {
      padding: "28px",
      "--auth-card-pad": "28px",
    },
  },
  "@keyframes authCardEnter": {
    from: {
      opacity: 0,
      transform: "translateY(10px)",
    },
    to: {
      opacity: 1,
      transform: "translateY(0)",
    },
  },
});

type Props = {
  children: ReactNode;
  maxWidth?: number;
  cardGap?: number;
};

export function AuthShell({ children, maxWidth = 400, cardGap = 20 }: Props) {
  const styles = useStyles();

  return (
    <div className={styles.page}>
      <div
        className={styles.card}
        style={{ maxWidth, gap: cardGap, display: "flex", flexDirection: "column" }}
      >
        {children}
      </div>
    </div>
  );
}
