import { makeStyles, tokens } from "@fluentui/react-components";
import {
  AddCircle24Regular,
  Comment24Regular,
  Circle24Regular,
  CheckmarkCircle24Regular,
  Edit24Regular,
  Delete24Regular,
  SelectAllOn24Regular,
  DismissCircle24Regular,
} from "@fluentui/react-icons";
import type { Todo } from "../types";

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
  onOpenComments: () => void;
  onToggleSelect: (e: React.MouseEvent) => void;
  onSelectAll: () => void;
  onEdit: () => void;
  onToggleComplete: () => void;
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
  onOpenComments,
  onToggleSelect,
  onSelectAll,
  onEdit,
  onToggleComplete,
  onDelete,
  rootCount,
}: Props) {
  const styles = useStyles();

  return (
    <div className={styles.menu} style={{ left: x, top: y }} onClick={onClose}>
      {hasPerm("add_subtodos") && (
        <button className={styles.item} onClick={onAddSubTodo}>
          <AddCircle24Regular /> Add sub-todo
        </button>
      )}
      {hasPerm("comment") && (
        <button className={styles.item} onClick={onOpenComments}>
          <Comment24Regular /> Comments{" "}
          {todo.commentCount > 0 ? `(${todo.commentCount})` : ""}
        </button>
      )}
      {isRoot && (
        <button className={styles.item} onClick={onToggleSelect}>
          {isSelected ? <DismissCircle24Regular /> : <Circle24Regular />}
          {isSelected ? " Deselect" : " Select"}
        </button>
      )}
      {isRoot && rootCount > 0 && (
        <button className={styles.item} onClick={onSelectAll}>
          <SelectAllOn24Regular /> Select all
        </button>
      )}
      <div className={styles.divider} />
      {canEdit && (
        <button className={styles.item} onClick={onEdit}>
          <Edit24Regular /> Edit
        </button>
      )}
      {canToggle && (
        <button className={styles.item} onClick={onToggleComplete}>
          {todo.completed ? <Circle24Regular /> : <CheckmarkCircle24Regular />}
          {todo.completed ? " Mark incomplete" : " Mark complete"}
        </button>
      )}
      {canDelete && (
        <button className={styles.item} onClick={onDelete}>
          <Delete24Regular /> Delete
        </button>
      )}
    </div>
  );
}
