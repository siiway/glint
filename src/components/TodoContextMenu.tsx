import { makeStyles, tokens } from "@fluentui/react-components";
import {
  AddCircle24Regular,
  ArrowUp24Regular,
  ArrowDown24Regular,
  Comment24Regular,
  Circle24Regular,
  CheckmarkCircle24Regular,
  Edit24Regular,
  Delete24Regular,
  SelectAllOn24Regular,
  DismissCircle24Regular,
  PersonAvailable24Regular,
  PersonDelete24Regular,
} from "@fluentui/react-icons";
import type { Todo } from "../types";
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
  divider: {
    height: "1px",
    backgroundColor: tokens.colorNeutralStroke2,
    margin: "4px 0",
  },
});

type Props = {
  x: number;
  y: number;
  todo: Todo;
  isRoot: boolean;
  isSelected: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canToggle: boolean;
  hasPerm: (key: string) => boolean;
  onClose: () => void;
  onAddSubTodo: () => void;
  onAddBefore: () => void;
  onAddAfter: () => void;
  onOpenComments: () => void;
  onToggleSelect: (e: React.MouseEvent) => void;
  onSelectAll: () => void;
  onEdit: () => void;
  onToggleComplete: () => void;
  onClaim: () => void;
  isClaimed: boolean;
  isClaimedByMe: boolean;
  onDelete: () => void;
  rootCount: number;
};

export function TodoContextMenu({
  x,
  y,
  todo,
  isRoot,
  isSelected,
  canEdit,
  canDelete,
  canToggle,
  hasPerm,
  onClose,
  onAddSubTodo,
  onAddBefore,
  onAddAfter,
  onOpenComments,
  onToggleSelect,
  onSelectAll,
  onEdit,
  onToggleComplete,
  onClaim,
  isClaimed,
  isClaimedByMe,
  onDelete,
  rootCount,
}: Props) {
  const styles = useStyles();
  const { t } = useI18n();

  return (
    <div className={styles.menu} style={{ left: x, top: y }} onClick={onClose}>
      <button className={styles.item} onClick={onAddBefore}>
        <ArrowUp24Regular /> {t.actionAddBefore}
      </button>
      <button className={styles.item} onClick={onAddAfter}>
        <ArrowDown24Regular /> {t.actionAddAfter}
      </button>
      {hasPerm("add_subtodos") && (
        <button className={styles.item} onClick={onAddSubTodo}>
          <AddCircle24Regular /> {t.actionAddSubTodo}
        </button>
      )}
      {hasPerm("comment") && (
        <button className={styles.item} onClick={onOpenComments}>
          <Comment24Regular /> {t.actionComments}{" "}
          {todo.commentCount > 0 ? `(${todo.commentCount})` : ""}
        </button>
      )}
      {isRoot && (
        <button className={styles.item} onClick={onToggleSelect}>
          {isSelected ? <DismissCircle24Regular /> : <Circle24Regular />}
          {isSelected ? ` ${t.actionDeselect}` : ` ${t.actionSelect}`}
        </button>
      )}
      {isRoot && rootCount > 0 && (
        <button className={styles.item} onClick={onSelectAll}>
          <SelectAllOn24Regular /> {t.actionSelectAll}
        </button>
      )}
      <div className={styles.divider} />
      {canEdit && (
        <button className={styles.item} onClick={onEdit}>
          <Edit24Regular /> {t.edit}
        </button>
      )}
      {hasPerm("claim_todos") && (!isClaimed || isClaimedByMe) && (
        <button className={styles.item} onClick={onClaim}>
          {isClaimedByMe ? (
            <PersonDelete24Regular />
          ) : (
            <PersonAvailable24Regular />
          )}
          {isClaimedByMe ? ` ${t.actionUnclaim}` : ` ${t.actionClaim}`}
        </button>
      )}
      {canToggle && (
        <button className={styles.item} onClick={onToggleComplete}>
          {todo.completed ? <Circle24Regular /> : <CheckmarkCircle24Regular />}
          {todo.completed
            ? ` ${t.actionMarkIncomplete}`
            : ` ${t.actionMarkComplete}`}
        </button>
      )}
      {canDelete && (
        <button className={styles.item} onClick={onDelete}>
          <Delete24Regular /> {t.delete}
        </button>
      )}
    </div>
  );
}
