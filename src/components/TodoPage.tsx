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
  Comment24Regular,
  ChevronRight20Regular,
  ChevronDown20Regular,
  Edit24Regular,
  Checkmark24Regular,
  CheckmarkCircle24Regular,
  Circle24Regular,
  Dismiss24Regular,
  AddCircle24Regular,
  Folder24Regular,
  MoreVertical24Regular,
  Navigation24Regular,
  DismissCircle24Regular,
} from "@fluentui/react-icons";
import { useAuth } from "../auth";
import type { Todo, TodoSet, TeamRole, Comment } from "../types";
import { useIsMobile } from "../hooks/useIsMobile";
import { Sidebar } from "./Sidebar";
import { CommentsDialog } from "./CommentsDialog";
import { SelectionBar } from "./SelectionBar";
import { TodoContextMenu } from "./TodoContextMenu";
import { SettingsPage } from "./SettingsPage";

// ─── Styles ──────────────────────────────────────────────────────────────────

const useStyles = makeStyles({
  layout: {
    display: "flex",
    height: "100%",
    overflow: "hidden",
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
  },
  mainHeader: {
    padding: "16px 24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    gap: "8px",
  },
  mainHeaderMobile: {
    padding: "12px 16px",
  },
  mainContent: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 24px",
  },
  mainContentMobile: {
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
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flex: 1,
    minWidth: 0,
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
  todoItemSelected: {
    backgroundColor: tokens.colorNeutralBackground1Selected,
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
  commentBadge: {
    display: "flex",
    alignItems: "center",
    gap: "2px",
    color: tokens.colorNeutralForeground4,
    fontSize: "12px",
    cursor: "pointer",
    "&:hover": {
      color: tokens.colorBrandForeground1,
    },
  },
  empty: {
    textAlign: "center" as const,
    padding: "48px 0",
    color: tokens.colorNeutralForeground4,
  },
});

// ─── Component ───────────────────────────────────────────────────────────────

export function TodoPage() {
  const styles = useStyles();
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();

  const teams = user?.teams ?? [];
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [sets, setSets] = useState<TodoSet[]>([]);
  const [selectedSetId, setSelectedSetId] = useState("");
  const [teamRole, setTeamRole] = useState<TeamRole | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loadingSets, setLoadingSets] = useState(false);
  const [loadingTodos, setLoadingTodos] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [siteName, setSiteName] = useState("Glint");
  const [siteLogo, setSiteLogo] = useState("");
  const [perms, setPerms] = useState<Record<string, boolean>>({});

  // Todo UI state
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);
  const [subTitle, setSubTitle] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [commentTodoId, setCommentTodoId] = useState<string | null>(null);

  // Drag state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragCounter = useRef(0);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Context menu
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    todoId: string;
  } | null>(null);

  // ─── Effects ─────────────────────────────────────────────────────────────

  useEffect(() => {
    setSelected(new Set());
  }, [selectedSetId]);

  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener("click", handler);
    window.addEventListener("contextmenu", handler);
    return () => {
      window.removeEventListener("click", handler);
      window.removeEventListener("contextmenu", handler);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (teams.length > 0 && !selectedTeamId) setSelectedTeamId(teams[0].id);
  }, [teams, selectedTeamId]);

  useEffect(() => {
    if (!selectedTeamId) return;
    fetch(`/api/teams/${selectedTeamId}/settings`)
      .then((r) => r.json())
      .then(
        (data: { settings: { site_name: string; site_logo_url: string } }) => {
          setSiteName(data.settings.site_name || "Glint");
          setSiteLogo(data.settings.site_logo_url || "");
        },
      )
      .catch(() => {});
  }, [selectedTeamId]);

  const fetchSets = useCallback(async () => {
    if (!selectedTeamId) return;
    setLoadingSets(true);
    try {
      const res = await fetch(`/api/teams/${selectedTeamId}/sets`);
      if (res.ok) {
        const data: { sets: TodoSet[]; role: TeamRole } = await res.json();
        setSets(data.sets);
        setTeamRole(data.role);
        if (
          data.sets.length > 0 &&
          !data.sets.find((s) => s.id === selectedSetId)
        )
          setSelectedSetId(data.sets[0].id);
        else if (data.sets.length === 0) setSelectedSetId("");
      }
    } finally {
      setLoadingSets(false);
    }
  }, [selectedTeamId]);

  useEffect(() => {
    setSelectedSetId("");
    setSets([]);
    setTodos([]);
    fetchSets();
  }, [fetchSets]);

  const fetchTodos = useCallback(async () => {
    if (!selectedTeamId || !selectedSetId) return;
    setLoadingTodos(true);
    try {
      const res = await fetch(
        `/api/teams/${selectedTeamId}/sets/${selectedSetId}/todos`,
      );
      if (res.ok) {
        const data: {
          todos: Todo[];
          role: TeamRole;
          permissions?: Record<string, boolean>;
        } = await res.json();
        setTodos(data.todos);
        setTeamRole(data.role);
        if (data.permissions) setPerms(data.permissions);
      }
    } finally {
      setLoadingTodos(false);
    }
  }, [selectedTeamId, selectedSetId]);

  useEffect(() => {
    setTodos([]);
    fetchTodos();
  }, [fetchTodos]);

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const hasPerm = (key: string) =>
    teamRole === "owner" || (perms[key] ?? false);
  const canModify = (todo: Todo) =>
    todo.userId === user?.id
      ? hasPerm("edit_own_todos")
      : hasPerm("edit_any_todo");
  const canDeleteTodo = (todo: Todo) =>
    todo.userId === user?.id
      ? hasPerm("delete_own_todos")
      : hasPerm("delete_any_todo");
  const canDeleteComment = (c: Comment) =>
    c.userId === user?.id
      ? hasPerm("delete_own_comments")
      : hasPerm("delete_any_comment");

  const rootTodos = todos
    .filter((t) => t.parentId === null)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const selectedSet = sets.find((s) => s.id === selectedSetId);
  const commentTodo = todos.find((t) => t.id === commentTodoId);
  const canDrag = !isMobile;

  // ─── Actions ─────────────────────────────────────────────────────────────

  const addTodo = async (parentId?: string) => {
    const title = parentId ? subTitle : newTitle;
    if (!title.trim() || adding || !selectedTeamId || !selectedSetId) return;
    setAdding(true);
    const res = await fetch(
      `/api/teams/${selectedTeamId}/sets/${selectedSetId}/todos`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, parentId: parentId ?? undefined }),
      },
    );
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
    await fetch(`/api/teams/${selectedTeamId}/todos/${todo.id}`, {
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
    await fetch(`/api/teams/${selectedTeamId}/todos/${id}`, {
      method: "DELETE",
    });
  };

  const saveEdit = async (todoId: string) => {
    if (!editTitle.trim()) return;
    setTodos((prev) =>
      prev.map((t) =>
        t.id === todoId ? { ...t, title: editTitle.trim() } : t,
      ),
    );
    setEditingId(null);
    await fetch(`/api/teams/${selectedTeamId}/todos/${todoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle.trim() }),
    });
  };

  // ─── Selection ───────────────────────────────────────────────────────────

  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (e?.shiftKey && prev.size > 0) {
        const lastSelected = [...prev].pop()!;
        const lastIdx = rootTodos.findIndex((t) => t.id === lastSelected);
        const curIdx = rootTodos.findIndex((t) => t.id === id);
        if (lastIdx >= 0 && curIdx >= 0) {
          const [from, to] =
            lastIdx < curIdx ? [lastIdx, curIdx] : [curIdx, lastIdx];
          for (let i = from; i <= to; i++) next.add(rootTodos[i].id);
          return next;
        }
      }
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(rootTodos.map((t) => t.id)));
  const clearSelection = () => setSelected(new Set());

  const bulkMarkCompleted = async (completed: boolean) => {
    const ids = [...selected];
    setTodos((prev) =>
      prev.map((t) => (selected.has(t.id) ? { ...t, completed } : t)),
    );
    setSelected(new Set());
    await Promise.all(
      ids.map((id) =>
        fetch(`/api/teams/${selectedTeamId}/todos/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed }),
        }),
      ),
    );
  };

  const bulkDelete = async () => {
    const ids = [...selected];
    const toRemove = new Set<string>();
    const collect = (pid: string) => {
      toRemove.add(pid);
      todos.filter((t) => t.parentId === pid).forEach((t) => collect(t.id));
    };
    ids.forEach(collect);
    setTodos((prev) => prev.filter((t) => !toRemove.has(t.id)));
    setSelected(new Set());
    await Promise.all(
      ids.map((id) =>
        fetch(`/api/teams/${selectedTeamId}/todos/${id}`, { method: "DELETE" }),
      ),
    );
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
    await fetch(`/api/teams/${selectedTeamId}/todos/reorder`, {
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

  // ─── Sidebar callbacks ───────────────────────────────────────────────────

  const handleAddSet = async (name: string) => {
    const res = await fetch(`/api/teams/${selectedTeamId}/sets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const data: { set: TodoSet } = await res.json();
      setSets((prev) => [...prev, data.set]);
      setSelectedSetId(data.set.id);
    }
  };

  const handleDeleteSet = async (setId: string) => {
    setSets((prev) => prev.filter((s) => s.id !== setId));
    if (selectedSetId === setId) {
      const remaining = sets.filter((s) => s.id !== setId);
      setSelectedSetId(remaining.length > 0 ? remaining[0].id : "");
    }
    await fetch(`/api/teams/${selectedTeamId}/sets/${setId}`, {
      method: "DELETE",
    });
  };

  const handleRenameSet = async (setId: string, name: string) => {
    setSets((prev) => prev.map((s) => (s.id === setId ? { ...s, name } : s)));
    await fetch(`/api/teams/${selectedTeamId}/sets/${setId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  };

  const handleReorderSets = async (
    items: { id: string; sortOrder: number }[],
  ) => {
    const orderMap = Object.fromEntries(
      items.map((it) => [it.id, it.sortOrder]),
    );
    setSets((prev) =>
      prev
        .map((s) => ({ ...s, sortOrder: orderMap[s.id] ?? s.sortOrder }))
        .sort((a, b) => a.sortOrder - b.sortOrder),
    );
    await fetch(`/api/teams/${selectedTeamId}/sets/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
  };

  const refreshBranding = () => {
    fetch(`/api/teams/${selectedTeamId}/settings`)
      .then((r) => r.json())
      .then(
        (data: { settings: { site_name: string; site_logo_url: string } }) => {
          setSiteName(data.settings.site_name || "Glint");
          setSiteLogo(data.settings.site_logo_url || "");
        },
      )
      .catch(() => {});
  };

  // ─── Todo menu items ─────────────────────────────────────────────────────

  function getChildren(parentId: string): Todo[] {
    return todos
      .filter((t) => t.parentId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const todoMenuItems = (todo: Todo) => (
    <MenuList>
      {hasPerm("add_subtodos") && (
        <MenuItem
          icon={<AddCircle24Regular />}
          onClick={() => {
            setAddingSubFor(todo.id);
            setSubTitle("");
          }}
        >
          Add sub-todo
        </MenuItem>
      )}
      {hasPerm("comment") && (
        <MenuItem
          icon={<Comment24Regular />}
          onClick={() => setCommentTodoId(todo.id)}
        >
          Comments {todo.commentCount > 0 ? `(${todo.commentCount})` : ""}
        </MenuItem>
      )}
      {todo.parentId === null && (
        <MenuItem
          icon={
            selected.has(todo.id) ? (
              <DismissCircle24Regular />
            ) : (
              <Circle24Regular />
            )
          }
          onClick={(e) => toggleSelect(todo.id, e)}
        >
          {selected.has(todo.id) ? "Deselect" : "Select"}
        </MenuItem>
      )}
      {canModify(todo) && (
        <MenuItem
          icon={<Edit24Regular />}
          onClick={() => {
            setEditingId(todo.id);
            setEditTitle(todo.title);
          }}
        >
          Edit
        </MenuItem>
      )}
      {(todo.userId === user?.id || hasPerm("complete_any_todo")) && (
        <MenuItem
          icon={
            todo.completed ? <Circle24Regular /> : <CheckmarkCircle24Regular />
          }
          onClick={() => toggleTodo(todo)}
        >
          {todo.completed ? "Mark incomplete" : "Mark complete"}
        </MenuItem>
      )}
      {canDeleteTodo(todo) && (
        <MenuItem
          icon={<Delete24Regular />}
          onClick={() => deleteTodo(todo.id)}
        >
          Delete
        </MenuItem>
      )}
    </MenuList>
  );

  // ─── Render todo item ────────────────────────────────────────────────────

  function renderTodo(todo: Todo, index: number, root: boolean): ReactNode {
    const children = getChildren(todo.id);
    const hasChildren = children.length > 0;
    const isExpanded = expanded.has(todo.id);
    const isEditing = editingId === todo.id;

    return (
      <div key={todo.id}>
        <div
          className={
            "fui-todo-row " +
            mergeClasses(
              styles.todoItem,
              isMobile && styles.todoItemMobile,
              selected.has(todo.id) && styles.todoItemSelected,
              root && canDrag && dragIndex === index && styles.todoItemDragging,
              root &&
                canDrag &&
                dragOverIndex === index &&
                dragIndex !== index &&
                styles.todoItemDragOver,
            )
          }
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
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setContextMenu({ x: e.clientX, y: e.clientY, todoId: todo.id });
          }}
          onClick={
            selected.size > 0 && root
              ? (e) => {
                  e.stopPropagation();
                  toggleSelect(todo.id, e);
                }
              : undefined
          }
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
              onClick={(e) => {
                e.stopPropagation();
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
            onClick={(e) => e.stopPropagation()}
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
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
                <Button
                  appearance="transparent"
                  size="small"
                  icon={<Checkmark24Regular />}
                  onClick={(e) => {
                    e.stopPropagation();
                    saveEdit(todo.id);
                  }}
                />
                <Button
                  appearance="transparent"
                  size="small"
                  icon={<Dismiss24Regular />}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingId(null);
                  }}
                />
              </>
            ) : (
              <>
                <Body2
                  className={mergeClasses(
                    styles.todoTitle,
                    todo.completed && styles.completed,
                  )}
                >
                  {todo.title}
                </Body2>
                {todo.commentCount > 0 && (
                  <span
                    className={styles.commentBadge}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCommentTodoId(todo.id);
                    }}
                  >
                    <Comment24Regular style={{ fontSize: 14 }} />
                    {todo.commentCount}
                  </span>
                )}
              </>
            )}
          </div>

          {!isEditing && (
            <Menu>
              <MenuTrigger disableButtonEnhancement>
                <Button
                  appearance="transparent"
                  size="small"
                  icon={<MoreVertical24Regular />}
                  onClick={(e) => e.stopPropagation()}
                />
              </MenuTrigger>
              <MenuPopover>{todoMenuItems(todo)}</MenuPopover>
            </Menu>
          )}
        </div>

        {addingSubFor === todo.id && (
          <div className={isMobile ? styles.subTodosMobile : styles.subTodos}>
            <div className={styles.inputRow}>
              <Input
                className={styles.inputFlex}
                size="small"
                placeholder="Sub-todo title..."
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
                {isMobile ? undefined : "Add"}
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

  // ─── Settings page ───────────────────────────────────────────────────────

  if (showSettings && selectedTeamId) {
    return (
      <SettingsPage
        teamId={selectedTeamId}
        onBack={() => {
          setShowSettings(false);
          refreshBranding();
        }}
      />
    );
  }

  // ─── No teams ────────────────────────────────────────────────────────────

  if (teams.length === 0) {
    return (
      <div className={styles.layout}>
        <div
          className={styles.main}
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <div className={styles.empty}>
            <Subtitle2>No teams found</Subtitle2>
            <Body1>
              You need to be a member of at least one team on Prism to use
              Glint.
            </Body1>
          </div>
        </div>
      </div>
    );
  }

  // ─── Context menu data ───────────────────────────────────────────────────

  const contextTodo = contextMenu
    ? todos.find((t) => t.id === contextMenu.todoId)
    : undefined;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      <div className={styles.layout}>
        <Sidebar
          isMobile={isMobile}
          drawerOpen={drawerOpen}
          onDrawerChange={setDrawerOpen}
          teams={teams}
          selectedTeamId={selectedTeamId}
          onTeamChange={setSelectedTeamId}
          sets={sets}
          selectedSetId={selectedSetId}
          onSetSelect={setSelectedSetId}
          loadingSets={loadingSets}
          siteName={siteName}
          siteLogo={siteLogo}
          canManageSettings={hasPerm("manage_settings")}
          onOpenSettings={() => setShowSettings(true)}
          onAddSet={handleAddSet}
          onDeleteSet={handleDeleteSet}
          onRenameSet={handleRenameSet}
          onReorderSets={handleReorderSets}
          user={
            user
              ? {
                  displayName: user.displayName,
                  username: user.username,
                  avatarUrl: user.avatarUrl,
                }
              : null
          }
          onLogout={logout}
        />

        <div className={styles.main}>
          {selectedSetId ? (
            <>
              <div
                className={mergeClasses(
                  styles.mainHeader,
                  isMobile && styles.mainHeaderMobile,
                )}
              >
                <div className={styles.headerLeft}>
                  {isMobile && (
                    <Button
                      appearance="transparent"
                      icon={<Navigation24Regular />}
                      onClick={() => setDrawerOpen(true)}
                    />
                  )}
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
                    {selectedSet?.name ?? "Todos"}
                  </Title2>
                </div>
                <Caption1 style={{ whiteSpace: "nowrap" }}>
                  {rootTodos.length} item{rootTodos.length !== 1 ? "s" : ""}
                </Caption1>
              </div>

              {selected.size > 0 && (
                <SelectionBar
                  count={selected.size}
                  isMobile={isMobile}
                  onSelectAll={selectAll}
                  onMarkCompleted={() => bulkMarkCompleted(true)}
                  onMarkIncomplete={() => bulkMarkCompleted(false)}
                  onDelete={bulkDelete}
                  onClear={clearSelection}
                />
              )}

              <div
                className={mergeClasses(
                  styles.mainContent,
                  isMobile && styles.mainContentMobile,
                )}
              >
                <div className={styles.inputRow}>
                  <Input
                    className={styles.inputFlex}
                    placeholder="What needs to be done?"
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
                    {isMobile ? undefined : "Add"}
                  </Button>
                </div>

                {loadingTodos ? (
                  <div className={styles.empty}>
                    <Spinner size="medium" label="Loading todos..." />
                  </div>
                ) : rootTodos.length === 0 ? (
                  <div className={styles.empty}>
                    <Body1>No todos yet. Add one above!</Body1>
                  </div>
                ) : (
                  rootTodos.map((todo, index) => renderTodo(todo, index, true))
                )}
              </div>
            </>
          ) : (
            <div
              className={styles.main}
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              {isMobile && (
                <Button
                  appearance="transparent"
                  icon={<Navigation24Regular />}
                  onClick={() => setDrawerOpen(true)}
                  style={{ position: "absolute", top: 12, left: 12 }}
                />
              )}
              <div className={styles.empty}>
                <Folder24Regular
                  style={{ fontSize: 48, marginBottom: 8, display: "block" }}
                />
                <Subtitle2>
                  {sets.length === 0
                    ? "Create a todo set to get started"
                    : "Select a todo set"}
                </Subtitle2>
                {isMobile && (
                  <Button
                    appearance="primary"
                    style={{ marginTop: 16 }}
                    onClick={() => setDrawerOpen(true)}
                  >
                    Open sets
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <CommentsDialog
        open={commentTodoId !== null}
        onClose={() => setCommentTodoId(null)}
        todoTitle={commentTodo?.title}
        teamId={selectedTeamId}
        todoId={commentTodoId}
        canDelete={canDeleteComment}
        onCommentCountChange={(todoId, delta) => {
          setTodos((prev) =>
            prev.map((t) =>
              t.id === todoId
                ? { ...t, commentCount: Math.max(0, t.commentCount + delta) }
                : t,
            ),
          );
        }}
      />

      {contextMenu && contextTodo && (
        <TodoContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          todo={contextTodo}
          isRoot={contextTodo.parentId === null}
          isSelected={selected.has(contextTodo.id)}
          canEdit={canModify(contextTodo)}
          canDelete={canDeleteTodo(contextTodo)}
          canToggle={
            contextTodo.userId === user?.id || hasPerm("complete_any_todo")
          }
          hasPerm={hasPerm}
          onClose={() => setContextMenu(null)}
          onAddSubTodo={() => {
            setAddingSubFor(contextTodo.id);
            setSubTitle("");
          }}
          onOpenComments={() => setCommentTodoId(contextTodo.id)}
          onToggleSelect={(e) => toggleSelect(contextTodo.id, e)}
          onSelectAll={selectAll}
          onEdit={() => {
            setEditingId(contextTodo.id);
            setEditTitle(contextTodo.title);
          }}
          onToggleComplete={() => toggleTodo(contextTodo)}
          onDelete={() => deleteTodo(contextTodo.id)}
          rootCount={rootTodos.length}
        />
      )}
    </>
  );
}
