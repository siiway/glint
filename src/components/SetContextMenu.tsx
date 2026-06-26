import { makeStyles, tokens } from "@fluentui/react-components";
import {
  Edit24Regular,
  Settings24Regular,
  Link24Regular,
  Delete24Regular,
} from "@fluentui/react-icons";
import { useLayoutEffect, useRef } from "react";
import { useI18n } from "../i18n";

const useStyles = makeStyles({
  menu: {
    position: "fixed" as const,
    zIndex: 1000,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow16,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    padding: "4px",
    minWidth: "180px",
  },
  item: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 12px",
    borderRadius: tokens.borderRadiusSmall,
    cursor: "pointer",
    border: "none",
    background: "none",
    width: "100%",
    textAlign: "left" as const,
    fontSize: "14px",
    color: tokens.colorNeutralForeground1,
    "&:hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
});

type Props = {
  x: number;
  y: number;
  canManageLinks: boolean;
  onClose: () => void;
  onRename: () => void;
  onSettings: () => void;
  onManageLinks: () => void;
  onDelete: () => void;
};

export function SetContextMenu({
  x,
  y,
  canManageLinks,
  onClose,
  onRename,
  onSettings,
  onManageLinks,
  onDelete,
}: Props) {
  const styles = useStyles();
  const { t } = useI18n();
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const menuEl = menuRef.current;
    if (!menuEl) return;

    const padding = 8;
    const maxX = window.innerWidth - menuEl.offsetWidth - padding;
    const maxY = window.innerHeight - menuEl.offsetHeight - padding;
    const clampedX = Math.max(padding, Math.min(x, maxX));
    const clampedY = Math.max(padding, Math.min(y, maxY));
    menuEl.style.left = `${clampedX}px`;
    menuEl.style.top = `${clampedY}px`;
  });

  return (
    <div
      ref={menuRef}
      className={styles.menu}
      style={{ left: x, top: y }}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <button
        className={styles.item}
        onClick={(e) => {
          e.stopPropagation();
          onRename();
          onClose();
        }}
      >
        <Edit24Regular /> {t.rename}
      </button>
      <button
        className={styles.item}
        onClick={(e) => {
          e.stopPropagation();
          onSettings();
          onClose();
        }}
      >
        <Settings24Regular /> {t.sidebarSetSettings}
      </button>
      {canManageLinks && (
        <button
          className={styles.item}
          onClick={(e) => {
            e.stopPropagation();
            onManageLinks();
            onClose();
          }}
        >
          <Link24Regular /> {t.shareManageLinks}
        </button>
      )}
      <button
        className={styles.item}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
          onClose();
        }}
      >
        <Delete24Regular /> {t.delete}
      </button>
    </div>
  );
}
