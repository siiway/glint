import type { ReactNode } from "react";
import { makeStyles } from "@fluentui/react-components";
import { Footer } from "./Footer";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
  },
  content: {
    flex: 1,
    overflow: "auto",
  },
});

/**
 * Full-height page layout with a shared footer.
 * - `footer={false}` hides the footer (e.g. TodoPage manages its own chrome).
 * - Content fills the remaining space and scrolls independently.
 */
export function PageLayout({
  children,
  footer = true,
}: {
  children: ReactNode;
  footer?: boolean;
}) {
  const styles = useStyles();

  return (
    <div className={styles.root}>
      <div className={styles.content}>{children}</div>
      {footer && <Footer />}
    </div>
  );
}
