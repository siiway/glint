import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import {
  Input,
  Button,
  Checkbox,
  Body1,
  Body2,
  Caption1,
  Title2,
  Subtitle2,
  Spinner,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  makeStyles,
  tokens,
  mergeClasses,
} from "@fluentui/react-components";
import {
  Add24Regular,
  Delete24Regular,
  ReOrder24Regular,
  ChevronRight20Regular,
  ChevronDown20Regular,
  Edit24Regular,
  Checkmark24Regular,
  CheckmarkCircle24Regular,
  Circle24Regular,
  Dismiss24Regular,
  AddCircle24Regular,
  MoreVertical24Regular,
} from "@fluentui/react-icons";
import type { Todo } from "../types";
import { useIsMobile } from "../hooks/useIsMobile";
import { useI18n } from "../i18n";

const useStyles = makeStyles({
  layout: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
  },
  header: {
    padding: "16px 24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    gap: "8px",
  },
  headerMobile: {
    padding: "12px 16px",
  },
  content: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 24px",
  },
  contentMobile: {
    padding: "12px 16px",
  },
  inputRow: {
    display: "flex",
    gap: "8px",
    marginBottom: "16px",
  },
  inputFlex: {
    flex: 1,
  },
  todoItem: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px 8px",
    borderRadius: tokens.borderRadiusMedium,
    userSelect: "none" as const,
    "&:hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  todoItemMobile: {
    padding: "10px 8px",
    gap: "8px",
  },
  todoItemDragging: {
    opacity: "0.4",
  },
  todoItemDragOver: {
    borderTop: `2px solid ${tokens.colorBrandForeground1}`,
  },
  todoContent: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  todoTitle: {
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  completed: {
    textDecoration: "line-through",
    color: tokens.colorNeutralForeground4,
  },
  subTodos: {
    paddingLeft: "28px",
  },
  subTodosMobile: {
    paddingLeft: "16px",
  },
  expandBtn: {
    minWidth: "20px",
    width: "20px",
    height: "20px",
    padding: "0",
  },
  expandPlaceholder: {
    width: "20px",
    minWidth: "20px",
  },
  dragHandle: {
    cursor: "grab",
    color: tokens.colorNeutralForeground4,
    display: "flex",
    alignItems: "center",
    "&:hover": {
      color: tokens.colorNeutralForeground2,
    },
  },
  empty: {
    textAlign: "center" as const,
    padding: "48px 0",
    color: tokens.colorNeutralForeground4,
  },
});

type Props = {
  token: string;
};

export function SharedPage({ token }: Props) {
  const styles = useStyles();
  const isMobile = useIsMobile();
  const { t } = useI18n();

  const [setName, setSetName] = useState("");
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);
  const [subTitle, setSubTitle] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  // Drag state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragCounter = useRef(0);
  const canDrag = !isMobile;

  const apiBase = `/api/shared/${token}`;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiBase);
      if (!res.ok) {
        setNotFound(true);
        return;
      }
      const data: { set: { name: string }; todos: Todo[] } = await res.json();
      setSetName(data.set.name);
      setTodos(data.todos);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const rootTodos = todos
    .filter((t) => t.parentId === null)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  function getChildren(parentId: string): Todo[] {
    return todos
      .filter((t) => t.parentId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  // ─── Actions ─────────────────────────────────────────────────────────────

  const addTodo = async (parentId?: string) => {
    const title = parentId ? subTitle : newTitle;
    if (!title.trim() || adding) return;
    setAdding(true);
    const res = await fetch(`${apiBase}/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, parentId: parentId ?? undefined }),
    });
    if (res.ok) {
      const data: { todo: Todo } = await res.json();
      setTodos((prev) => [...prev, data.todo]);
      if (parentId) {
        setSubTitle("");
        setAddingSubFor(null);
        setExpanded((prev) => new Set(prev).add(parentId));
      } else setNewTitle("");
    }
    setAdding(false);
  };

  const toggleTodo = async (todo: Todo) => {
    const completed = !todo.completed;
    setTodos((prev) =>
      prev.map((t) => (t.id === todo.id ? { ...t, completed } : t)),
    );
    await fetch(`${apiBase}/todos/${todo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    });
  };

  const deleteTodo = async (id: string) => {
    const toRemove = new Set<string>();
    const collect = (pid: string) => {
      toRemove.add(pid);
      todos.filter((t) => t.parentId === pid).forEach((t) => collect(t.id));
    };
    collect(id);
    setTodos((prev) => prev.filter((t) => !toRemove.has(t.id)));
    await fetch(`${apiBase}/todos/${id}`, { method: "DELETE" });
  };

  const saveEdit = async (todoId: string) => {
    if (!editTitle.trim()) return;
    setTodos((prev) =>
      prev.map((t) =>
        t.id === todoId ? { ...t, title: editTitle.trim() } : t,
      ),
    );
    setEditingId(null);
    await fetch(`${apiBase}/todos/${todoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle.trim() }),
    });
  };

  // ─── Drag ────────────────────────────────────────────────────────────────

  const handleDragStart = (i: number) => setDragIndex(i);
  const handleDragEnter = (i: number) => {
    dragCounter.current++;
    setDragOverIndex(i);
  };
  const handleDragLeave = () => {
    dragCounter.current--;
    if (dragCounter.current === 0) setDragOverIndex(null);
  };
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = async (dropIndex: number) => {
    dragCounter.current = 0;
    setDragOverIndex(null);
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      return;
    }
    const reordered = [...rootTodos];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, moved);
    const items = reordered.map((t, i) => ({ id: t.id, sortOrder: i + 1 }));
    const orderMap = Object.fromEntries(
      items.map((it) => [it.id, it.sortOrder]),
    );
    setTodos((prev) =>
      prev.map((t) =>
        orderMap[t.id] != null ? { ...t, sortOrder: orderMap[t.id] } : t,
      ),
    );
    setDragIndex(null);
    await fetch(`${apiBase}/todos/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
  };
  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
    dragCounter.current = 0;
  };

  // ─── Render todo item ────────────────────────────────────────────────────

  function renderTodo(todo: Todo, index: number, root: boolean): ReactNode {
    const children = getChildren(todo.id);
    const hasChildren = children.length > 0;
    const isExpanded = expanded.has(todo.id);
    const isEditing = editingId === todo.id;

    return (
      <div key={todo.id}>
        <div
          className={mergeClasses(
            styles.todoItem,
            isMobile && styles.todoItemMobile,
            root && canDrag && dragIndex === index && styles.todoItemDragging,
            root &&
              canDrag &&
              dragOverIndex === index &&
              dragIndex !== index &&
              styles.todoItemDragOver,
          )}
          draggable={root && canDrag}
          onDragStart={
            root && canDrag ? () => handleDragStart(index) : undefined
          }
          onDragEnter={
            root && canDrag ? () => handleDragEnter(index) : undefined
          }
          onDragLeave={root && canDrag ? handleDragLeave : undefined}
          onDragOver={root && canDrag ? handleDragOver : undefined}
          onDrop={root && canDrag ? () => handleDrop(index) : undefined}
          onDragEnd={root && canDrag ? handleDragEnd : undefined}
        >
          {root && canDrag && (
            <span className={styles.dragHandle}>
              <ReOrder24Regular />
            </span>
          )}

          {hasChildren ? (
            <Button
              appearance="transparent"
              size="small"
              className={styles.expandBtn}
              icon={
                isExpanded ? (
                  <ChevronDown20Regular />
                ) : (
                  <ChevronRight20Regular />
                )
              }
              onClick={() => {
                setExpanded((p) => {
                  const n = new Set(p);
                  n.has(todo.id) ? n.delete(todo.id) : n.add(todo.id);
                  return n;
                });
              }}
            />
          ) : (
            <span className={styles.expandPlaceholder} />
          )}

          <Checkbox
            checked={todo.completed}
            onChange={() => toggleTodo(todo)}
          />

          <div className={styles.todoContent}>
            {isEditing ? (
              <>
                <Input
                  className={styles.inputFlex}
                  size="small"
                  value={editTitle}
                  onChange={(_, d) => setEditTitle(d.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit(todo.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  autoFocus
                />
                <Button
                  appearance="transparent"
                  size="small"
                  icon={<Checkmark24Regular />}
                  onClick={() => saveEdit(todo.id)}
                />
                <Button
                  appearance="transparent"
                  size="small"
                  icon={<Dismiss24Regular />}
                  onClick={() => setEditingId(null)}
                />
              </>
            ) : (
              <Body2
                className={mergeClasses(
                  styles.todoTitle,
                  todo.completed && styles.completed,
                )}
              >
                {todo.title}
              </Body2>
            )}
          </div>

          {!isEditing && (
            <Menu>
              <MenuTrigger disableButtonEnhancement>
                <Button
                  appearance="transparent"
                  size="small"
                  icon={<MoreVertical24Regular />}
                />
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  <MenuItem
                    icon={<AddCircle24Regular />}
                    onClick={() => {
                      setAddingSubFor(todo.id);
                      setSubTitle("");
                    }}
                  >
                    {t.actionAddSubTodo}
                  </MenuItem>
                  <MenuItem
                    icon={<Edit24Regular />}
                    onClick={() => {
                      setEditingId(todo.id);
                      setEditTitle(todo.title);
                    }}
                  >
                    {t.edit}
                  </MenuItem>
                  <MenuItem
                    icon={
                      todo.completed ? (
                        <Circle24Regular />
                      ) : (
                        <CheckmarkCircle24Regular />
                      )
                    }
                    onClick={() => toggleTodo(todo)}
                  >
                    {todo.completed
                      ? t.actionMarkIncomplete
                      : t.actionMarkComplete}
                  </MenuItem>
                  <MenuItem
                    icon={<Delete24Regular />}
                    onClick={() => deleteTodo(todo.id)}
                  >
                    {t.delete}
                  </MenuItem>
                </MenuList>
              </MenuPopover>
            </Menu>
          )}
        </div>

        {addingSubFor === todo.id && (
          <div className={isMobile ? styles.subTodosMobile : styles.subTodos}>
            <div className={styles.inputRow}>
              <Input
                className={styles.inputFlex}
                size="small"
                placeholder={t.todoSubTodoPlaceholder}
                value={subTitle}
                onChange={(_, d) => setSubTitle(d.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addTodo(todo.id);
                  if (e.key === "Escape") setAddingSubFor(null);
                }}
                autoFocus
              />
              <Button
                appearance="primary"
                size="small"
                icon={<Add24Regular />}
                onClick={() => addTodo(todo.id)}
                disabled={!subTitle.trim()}
              >
                {isMobile ? undefined : t.add}
              </Button>
              <Button
                appearance="subtle"
                size="small"
                icon={<Dismiss24Regular />}
                onClick={() => setAddingSubFor(null)}
              />
            </div>
          </div>
        )}

        {hasChildren && isExpanded && (
          <div className={isMobile ? styles.subTodosMobile : styles.subTodos}>
            {children.map((child, ci) => renderTodo(child, ci, false))}
          </div>
        )}
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={styles.layout}>
        <div className={styles.empty}>
          <Spinner size="large" label={t.loading} />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className={styles.layout}>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100%",
          }}
        >
          <div className={styles.empty}>
            <Subtitle2>{t.sharedNotFound}</Subtitle2>
            <br />
            <Button
              appearance="primary"
              onClick={() => (window.location.href = "/")}
              style={{ marginTop: 12 }}
            >
              {t.sharedGoHome}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      <div
        className={mergeClasses(styles.header, isMobile && styles.headerMobile)}
      >
        <Title2
          style={
            isMobile
              ? {
                  fontSize: "18px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }
              : undefined
          }
        >
          {setName}
        </Title2>
        <Caption1 style={{ whiteSpace: "nowrap" }}>
          {rootTodos.length === 1
            ? t.todoItemCount
                .split(" | ")[0]
                .replace("{count}", String(rootTodos.length))
            : (t.todoItemCount.split(" | ")[1] ?? t.todoItemCount).replace(
                "{count}",
                String(rootTodos.length),
              )}
        </Caption1>
      </div>

      <div
        className={mergeClasses(
          styles.content,
          isMobile && styles.contentMobile,
        )}
      >
        <div className={styles.inputRow}>
          <Input
            className={styles.inputFlex}
            placeholder={t.todoPlaceholder}
            value={newTitle}
            onChange={(_, d) => setNewTitle(d.value)}
            onKeyDown={(e) => e.key === "Enter" && addTodo()}
            disabled={adding}
          />
          <Button
            appearance="primary"
            icon={<Add24Regular />}
            onClick={() => addTodo()}
            disabled={!newTitle.trim() || adding}
          >
            {isMobile ? undefined : t.add}
          </Button>
        </div>

        {rootTodos.length === 0 ? (
          <div className={styles.empty}>
            <Body1>{t.todoEmpty}</Body1>
          </div>
        ) : (
          rootTodos.map((todo, index) => renderTodo(todo, index, true))
        )}
      </div>
    </div>
  );
}
