import {
  useState,
  useEffect,
  useCallback,
  useMemo,
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
  Popover,
  PopoverTrigger,
  PopoverSurface,
  MenuList,
  MenuItem,
  Tooltip,
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
  ArrowImport24Regular,
  ArrowExport24Regular,
  PersonAvailable24Regular,
  PersonDelete24Regular,
  ArrowUp24Regular,
  ArrowDown24Regular,
} from "@fluentui/react-icons";
import { useNavigate, useMatch } from "react-router-dom";
import { useAuth } from "../auth";
import type { Todo, TodoSet, TeamRole, Comment, TodoSpace } from "../types";
import { useIsMobile } from "../hooks/useIsMobile";
import { Sidebar } from "./Sidebar";
import { SelectSpacePage } from "./SelectSpacePage";
import { CommentsDialog } from "./CommentsDialog";
import { SelectionBar } from "./SelectionBar";
import { TodoContextMenu } from "./TodoContextMenu";
import { SettingsPage } from "./SettingsPage";
import { SetTransferDialog } from "./SetTransferDialog";
import { useI18n } from "../i18n";
import { ConfirmDialog } from "./ConfirmDialog";
import {
  getEffectiveActions,
  BUILTIN_SITE_DEFAULT,
  type ActionKey,
} from "../utils/actionBar";
import { useRealtimeSync, type WsEvent } from "../hooks/useRealtimeSync";
import { useUserSettings } from "../hooks/useUserSettings";

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
    paddingLeft: "30px",
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
  claimedBadge: {
    display: "flex",
    alignItems: "center",
    gap: "2px",
    color: tokens.colorPaletteGreenForeground1,
    fontSize: "12px",
  },
  claimedAvatar: {
    width: "16px",
    height: "16px",
    borderRadius: "50%",
    objectFit: "cover" as const,
  },
  claimedFlyout: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px 14px",
    minWidth: "180px",
  },
  claimedFlyoutAvatar: {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    objectFit: "cover" as const,
    flexShrink: 0,
  },
  claimedFlyoutInfo: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "4px",
  },
  claimedFlyoutName: {
    fontWeight: "600",
    fontSize: "13px",
    color: tokens.colorNeutralForeground1,
  },
  claimedFlyoutSub: {
    fontSize: "11px",
    color: tokens.colorNeutralForeground3,
  },
  empty: {
    textAlign: "center" as const,
    padding: "48px 0",
    color: tokens.colorNeutralForeground4,
  },
  actionBar: {
    display: "flex",
    alignItems: "center",
    gap: "1px",
    flexShrink: 0,
    transition: "opacity 0.1s",
  },
  actionBarBtn: {
    minWidth: "20px",
    width: "20px",
    height: "20px",
    padding: "0",
  },
  insertInputRow: {
    display: "flex",
    gap: "8px",
    padding: "2px 0",
    alignItems: "center",
  },
});

// ─── Component ───────────────────────────────────────────────────────────────

export function TodoPage() {
  const styles = useStyles();
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const { t } = useI18n();
  const navigate = useNavigate();

  // Derive selected space/set/view from the URL
  const matchSettings = useMatch("/:spaceId/settings");
  const matchSet = useMatch("/:spaceId/:setId");
  const matchSpace = useMatch("/:spaceId");
  const selectedSpaceId =
    matchSettings?.params.spaceId ??
    matchSet?.params.spaceId ??
    matchSpace?.params.spaceId ??
    "";
  const showSettings = !!matchSettings;
  const selectedSetId = showSettings ? "" : (matchSet?.params.setId ?? "");

  const selectSpace = useCallback(
    (id: string) => {
      navigate(`/${id}`);
    },
    [navigate],
  );

  const spaces: TodoSpace[] = useMemo(
    () =>
      user
        ? [
            {
              id: `personal:${user.id}`,
              name: user.displayName || user.username,
              kind: "personal",
              role: "owner",
              avatarUrl: user.avatarUrl,
            },
            ...user.teams.map((team) => ({
              id: team.id,
              name: team.name,
              kind: "team" as const,
              role: team.role,
              avatarUrl: team.avatarUrl,
            })),
          ]
        : [],
    [user],
  );
  const [sets, setSets] = useState<TodoSet[]>([]);
  const [teamRole, setTeamRole] = useState<TeamRole | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loadingSets, setLoadingSets] = useState(false);
  const [loadingTodos, setLoadingTodos] = useState(false);
  const fetchSetsAbort = useRef<AbortController | null>(null);
  const fetchTodosAbort = useRef<AbortController | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [switchingSpace, setSwitchingSpace] = useState(false);
  const [siteName, setSiteName] = useState("Glint");
  const [siteLogo, setSiteLogo] = useState("");
  const [perms, setPerms] = useState<Record<string, boolean>>({});
  const [defaultTimezone, setDefaultTimezone] = useState("UTC");

  const selectedSpace = spaces.find((space) => space.id === selectedSpaceId);

  // Todo UI state
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);
  const [subTitle, setSubTitle] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [commentTodoId, setCommentTodoId] = useState<string | null>(null);
  // Per-set UI state: whether the completed section is collapsed for a given set
  const [completedCollapsed, setCompletedCollapsed] = useState<
    Record<string, boolean>
  >({});

  // Drag state (root todos)
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragCounter = useRef(0);
  const rootDragActive = useRef(false);

  // Drag state (subtodos)
  const [subDragParentId, setSubDragParentId] = useState<string | null>(null);
  const [subDragIndex, setSubDragIndex] = useState<number | null>(null);
  const [subDragOverIndex, setSubDragOverIndex] = useState<number | null>(null);
  const subDragCounter = useRef(0);
  const subDragParentIdRef = useRef<string | null>(null);
  const subDragActive = useRef(false);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Inline insert state
  const [insertingAt, setInsertingAt] = useState<{
    id: string;
    position: "before" | "after";
  } | null>(null);
  const [insertTitle, setInsertTitle] = useState("");

  // Action bar
  const [shiftHeld, setShiftHeld] = useState(false);
  const [hoveredTodoId, setHoveredTodoId] = useState<string | null>(null);
  const [siteDefaultActions, setSiteDefaultActions] =
    useState<ActionKey[]>(BUILTIN_SITE_DEFAULT);
  const [actionBarActions, setActionBarActions] = useState<ActionKey[]>(() =>
    getEffectiveActions("", BUILTIN_SITE_DEFAULT),
  );

  // Import dialog
  const [transferMode, setTransferMode] = useState<"import" | "export">(
    "import",
  );
  const [transferOpen, setTransferOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    message: string;
    action: () => void;
  } | null>(null);

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
    const down = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShiftHeld(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShiftHeld(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    fetch("/api/init/config")
      .then((r) => r.json())
      .then((data: { config?: { action_bar_defaults?: string[] } }) => {
        const raw = data.config?.action_bar_defaults;
        if (Array.isArray(raw) && raw.length > 0) {
          setSiteDefaultActions(raw as ActionKey[]);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setActionBarActions(
      getEffectiveActions(selectedSpaceId, siteDefaultActions),
    );
  }, [selectedSpaceId, siteDefaultActions]);

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
    if (spaces.length === 0) return;
    if (!selectedSpaceId || !spaces.some((s) => s.id === selectedSpaceId)) {
      navigate(`/${spaces[0].id}`, { replace: true });
    }
  }, [spaces, selectedSpaceId, navigate]);

  useEffect(() => {
    if (selectedSpace?.kind !== "team" && showSettings) {
      navigate(`/${selectedSpaceId}`, { replace: true });
    }
  }, [selectedSpace?.kind, showSettings, selectedSpaceId, navigate]);

  useEffect(() => {
    if (!selectedSpaceId) return;
    if (selectedSpace?.kind !== "team") {
      setSiteName("Glint");
      setSiteLogo("");
      setDefaultTimezone("UTC");
      return;
    }
    fetch(`/api/teams/${selectedSpaceId}/settings`)
      .then((r) => r.json())
      .then(
        (data: {
          settings: {
            site_name: string;
            site_logo_url: string;
            default_timezone?: string;
          };
        }) => {
          setSiteName(data.settings.site_name || "Glint");
          setSiteLogo(data.settings.site_logo_url || "");
          setDefaultTimezone(data.settings.default_timezone || "UTC");
        },
      )
      .catch(() => {});
  }, [selectedSpaceId, selectedSpace?.kind]);

  const fetchSets = useCallback(async () => {
    if (!selectedSpaceId) return;
    fetchSetsAbort.current?.abort();
    const ctrl = new AbortController();
    fetchSetsAbort.current = ctrl;
    setLoadingSets(true);
    try {
      const res = await fetch(`/api/teams/${selectedSpaceId}/sets`, {
        signal: ctrl.signal,
      });
      if (res.status === 403 || res.status === 404) {
        navigate("/not-authorized", { replace: true });
        return;
      }
      if (res.ok) {
        const data: { sets: TodoSet[]; role: TeamRole } = await res.json();
        setSets(data.sets);
        setTeamRole(data.role);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    } finally {
      if (!ctrl.signal.aborted) setLoadingSets(false);
    }
  }, [selectedSpaceId, navigate]);

  useEffect(() => {
    fetchSets();
  }, [fetchSets]);

  // After sets load, auto-navigate to a valid set if the URL has none or an invalid one
  useEffect(() => {
    if (loadingSets || !selectedSpaceId || sets.length === 0 || showSettings)
      return;
    const validSetId = sets.some((s) => s.id === selectedSetId)
      ? selectedSetId
      : sets[0].id;
    if (validSetId !== selectedSetId) {
      navigate(`/${selectedSpaceId}/${validSetId}`, { replace: true });
    }
  }, [
    sets,
    selectedSpaceId,
    selectedSetId,
    showSettings,
    loadingSets,
    navigate,
  ]);

  const fetchTodos = useCallback(async () => {
    if (!selectedSpaceId || !selectedSetId) return;
    fetchTodosAbort.current?.abort();
    const ctrl = new AbortController();
    fetchTodosAbort.current = ctrl;
    setLoadingTodos(true);
    try {
      const res = await fetch(
        `/api/teams/${selectedSpaceId}/sets/${selectedSetId}/todos`,
        { signal: ctrl.signal },
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
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    } finally {
      if (!ctrl.signal.aborted) setLoadingTodos(false);
    }
  }, [selectedSpaceId, selectedSetId]);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  const { settings: userSettings, update: updateUserSettings } =
    useUserSettings();

  useRealtimeSync({
    teamId: selectedSpaceId,
    setId: selectedSetId ?? "",
    enabled: !!selectedSpaceId && !!selectedSetId,
    transport: userSettings.realtime_transport ?? "auto",
    onEvent: useCallback(
      (event: WsEvent) => {
        if (event.setId !== selectedSetId) return;
        setTodos((prev) => {
          switch (event.type) {
            case "todo:created":
              if (prev.some((t) => t.id === event.todo.id)) return prev;
              return [...prev, event.todo];
            case "todo:updated":
              return prev.map((t) =>
                t.id === event.todo.id ? { ...t, ...event.todo } : t,
              );
            case "todo:deleted":
              return prev.filter(
                (t) => t.id !== event.id && t.parentId !== event.id,
              );
            case "todo:reordered": {
              const orderMap = new Map(
                event.items.map(({ id, sortOrder }) => [id, sortOrder]),
              );
              return prev.map((t) =>
                orderMap.has(t.id)
                  ? { ...t, sortOrder: orderMap.get(t.id)! }
                  : t,
              );
            }
            case "todo:claimed":
              return prev.map((t) =>
                t.id === event.id
                  ? {
                      ...t,
                      claimedBy: event.claimedBy,
                      claimedByName: event.claimedByName,
                      claimedByAvatar: event.claimedByAvatar,
                    }
                  : t,
              );
            default:
              return prev;
          }
        });
      },
      [selectedSetId],
    ),
  });

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const hasPerm = (key: string) =>
    teamRole === "owner" || teamRole === "co-owner" || (perms[key] ?? false);
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

  // Split lists when set is configured to show completed separately
  const splitCompleted = selectedSet?.splitCompleted ?? false;
  const incompleteRootTodos = rootTodos.filter((t) => !t.completed);
  const completedRootTodos = rootTodos.filter((t) => t.completed);

  // ─── Actions ─────────────────────────────────────────────────────────────

  const addTodo = async (parentId?: string) => {
    const title = parentId ? subTitle : newTitle;
    if (!title.trim() || adding || !selectedSpaceId || !selectedSetId) return;
    setAdding(true);
    const res = await fetch(
      `/api/teams/${selectedSpaceId}/sets/${selectedSetId}/todos`,
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
    await fetch(`/api/teams/${selectedSpaceId}/todos/${todo.id}`, {
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
    await fetch(`/api/teams/${selectedSpaceId}/todos/${id}`, {
      method: "DELETE",
    });
  };

  const claimTodo = async (todo: Todo) => {
    const unclaiming = todo.claimedBy === user?.id;
    const newClaimed = unclaiming ? null : (user?.id ?? null);
    const newName = unclaiming
      ? null
      : user?.displayName || user?.username || null;
    const newAvatar = unclaiming ? null : user?.avatarUrl || null;
    setTodos((prev) =>
      prev.map((t) =>
        t.id === todo.id
          ? {
              ...t,
              claimedBy: newClaimed,
              claimedByName: newName,
              claimedByAvatar: newAvatar,
            }
          : t,
      ),
    );
    await fetch(`/api/teams/${selectedSpaceId}/todos/${todo.id}/claim`, {
      method: "POST",
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
    await fetch(`/api/teams/${selectedSpaceId}/todos/${todoId}`, {
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
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
        fetch(`/api/teams/${selectedSpaceId}/todos/${id}`, {
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
        fetch(`/api/teams/${selectedSpaceId}/todos/${id}`, {
          method: "DELETE",
        }),
      ),
    );
  };

  // ─── Drag ────────────────────────────────────────────────────────────────

  const handleDragStart = (i: number) => {
    rootDragActive.current = true;
    setDragIndex(i);
  };
  const handleDragEnter = (i: number) => {
    if (subDragActive.current) return;
    dragCounter.current++;
    setDragOverIndex(i);
  };
  const handleDragLeave = () => {
    if (subDragActive.current) return;
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
    await fetch(`/api/teams/${selectedSpaceId}/todos/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, setId: selectedSetId }),
    });
  };
  const handleDragEnd = () => {
    rootDragActive.current = false;
    setDragIndex(null);
    setDragOverIndex(null);
    dragCounter.current = 0;
  };

  const handleSubDragStart = (parentId: string, i: number) => {
    subDragActive.current = true;
    subDragParentIdRef.current = parentId;
    setSubDragParentId(parentId);
    setSubDragIndex(i);
  };
  const handleSubDragEnter = (parentId: string, i: number) => {
    if (rootDragActive.current) return;
    if (subDragParentIdRef.current !== parentId) return;
    subDragCounter.current++;
    setSubDragOverIndex(i);
  };
  const handleSubDragLeave = () => {
    if (rootDragActive.current) return;
    subDragCounter.current--;
    if (subDragCounter.current === 0) setSubDragOverIndex(null);
  };
  const handleSubDrop = async (parentId: string, dropIndex: number) => {
    subDragCounter.current = 0;
    setSubDragOverIndex(null);
    if (
      subDragParentIdRef.current !== parentId ||
      subDragIndex === null ||
      subDragIndex === dropIndex
    ) {
      subDragActive.current = false;
      subDragParentIdRef.current = null;
      setSubDragIndex(null);
      setSubDragParentId(null);
      return;
    }
    const siblings = getChildren(parentId);
    const reordered = [...siblings];
    const [moved] = reordered.splice(subDragIndex, 1);
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
    subDragActive.current = false;
    subDragParentIdRef.current = null;
    setSubDragIndex(null);
    setSubDragParentId(null);
    await fetch(`/api/teams/${selectedSpaceId}/todos/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, setId: selectedSetId }),
    });
  };
  const handleSubDragEnd = () => {
    subDragActive.current = false;
    subDragParentIdRef.current = null;
    setSubDragIndex(null);
    setSubDragParentId(null);
    setSubDragOverIndex(null);
    subDragCounter.current = 0;
  };

  // ─── Insert before / after ───────────────────────────────────────────────

  const addTodoAt = async (refTodoId: string, position: "before" | "after") => {
    const title = insertTitle.trim();
    if (!title || !selectedSpaceId || !selectedSetId) return;
    const refTodo = todos.find((t) => t.id === refTodoId);
    if (!refTodo) return;

    const siblings = (
      refTodo.parentId
        ? todos.filter((t) => t.parentId === refTodo.parentId)
        : todos.filter((t) => t.parentId === null)
    ).sort((a, b) => a.sortOrder - b.sortOrder);

    const refIdx = siblings.findIndex((t) => t.id === refTodoId);
    const insertIdx = position === "after" ? refIdx + 1 : refIdx;

    setInsertingAt(null);
    setInsertTitle("");

    const res = await fetch(
      `/api/teams/${selectedSpaceId}/sets/${selectedSetId}/todos`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          parentId: refTodo.parentId ?? undefined,
        }),
      },
    );
    if (!res.ok) return;
    const data: { todo: Todo } = await res.json();
    const newTodo = data.todo;

    const withNew = [...siblings];
    withNew.splice(insertIdx, 0, newTodo);
    const items = withNew.map((t, i) => ({ id: t.id, sortOrder: i + 1 }));
    const orderMap = Object.fromEntries(
      items.map((it) => [it.id, it.sortOrder]),
    );
    setTodos((prev) => {
      const updated = [...prev, newTodo];
      return updated.map((t) =>
        orderMap[t.id] != null ? { ...t, sortOrder: orderMap[t.id] } : t,
      );
    });
    await fetch(`/api/teams/${selectedSpaceId}/todos/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, setId: selectedSetId }),
    });
  };

  // ─── Sidebar callbacks ───────────────────────────────────────────────────

  const handleAddSet = async (name: string) => {
    const res = await fetch(`/api/teams/${selectedSpaceId}/sets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const data: { set: TodoSet } = await res.json();
      setSets((prev) => [...prev, data.set]);
      navigate(`/${selectedSpaceId}/${data.set.id}`);
    }
  };

  const handleDeleteSet = async (setId: string) => {
    setSets((prev) => prev.filter((s) => s.id !== setId));
    if (selectedSetId === setId) {
      const remaining = sets.filter((s) => s.id !== setId);
      navigate(
        remaining.length > 0
          ? `/${selectedSpaceId}/${remaining[0].id}`
          : `/${selectedSpaceId}`,
      );
    }
    await fetch(`/api/teams/${selectedSpaceId}/sets/${setId}`, {
      method: "DELETE",
    });
  };

  const handleRenameSet = async (setId: string, name: string) => {
    setSets((prev) => prev.map((s) => (s.id === setId ? { ...s, name } : s)));
    await fetch(`/api/teams/${selectedSpaceId}/sets/${setId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  };

  const handleUpdateSet = async (setId: string, patch: Partial<TodoSet>) => {
    setSets((prev) =>
      prev.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
    );
    await fetch(`/api/teams/${selectedSpaceId}/sets/${setId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
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
    await fetch(`/api/teams/${selectedSpaceId}/sets/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
  };

  const refreshBranding = () => {
    fetch(`/api/teams/${selectedSpaceId}/settings`)
      .then((r) => r.json())
      .then(
        (data: {
          settings: {
            site_name: string;
            site_logo_url: string;
            default_timezone?: string;
          };
        }) => {
          setSiteName(data.settings.site_name || "Glint");
          setSiteLogo(data.settings.site_logo_url || "");
          setDefaultTimezone(data.settings.default_timezone || "UTC");
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
      <MenuItem
        icon={<ArrowUp24Regular />}
        onClick={() => {
          setInsertingAt({ id: todo.id, position: "before" });
          setInsertTitle("");
        }}
      >
        {t.actionAddBefore}
      </MenuItem>
      <MenuItem
        icon={<ArrowDown24Regular />}
        onClick={() => {
          setInsertingAt({ id: todo.id, position: "after" });
          setInsertTitle("");
        }}
      >
        {t.actionAddAfter}
      </MenuItem>
      {hasPerm("add_subtodos") && (
        <MenuItem
          icon={<AddCircle24Regular />}
          onClick={() => {
            setAddingSubFor(todo.id);
            setSubTitle("");
          }}
        >
          {t.actionAddSubTodo}
        </MenuItem>
      )}
      {hasPerm("comment") && (
        <MenuItem
          icon={<Comment24Regular />}
          onClick={() => setCommentTodoId(todo.id)}
        >
          {t.actionComments}{" "}
          {todo.commentCount > 0 ? `(${todo.commentCount})` : ""}
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
          {selected.has(todo.id) ? t.actionDeselect : t.actionSelect}
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
          {t.edit}
        </MenuItem>
      )}
      {hasPerm("claim_todos") &&
        (!todo.claimedBy || todo.claimedBy === user?.id) && (
          <MenuItem
            icon={
              todo.claimedBy === user?.id ? (
                <PersonDelete24Regular />
              ) : (
                <PersonAvailable24Regular />
              )
            }
            onClick={() => claimTodo(todo)}
          >
            {todo.claimedBy === user?.id ? t.actionUnclaim : t.actionClaim}
          </MenuItem>
        )}
      {(todo.userId === user?.id || hasPerm("complete_any_todo")) && (
        <MenuItem
          icon={
            todo.completed ? <Circle24Regular /> : <CheckmarkCircle24Regular />
          }
          onClick={() => toggleTodo(todo)}
        >
          {todo.completed ? t.actionMarkIncomplete : t.actionMarkComplete}
        </MenuItem>
      )}
      {canDeleteTodo(todo) && (
        <MenuItem
          icon={<Delete24Regular />}
          onClick={() =>
            setConfirmAction({
              message: t.confirmDeleteTodo,
              action: () => deleteTodo(todo.id),
            })
          }
        >
          {t.delete}
        </MenuItem>
      )}
    </MenuList>
  );

  // ─── Action bar item renderer ─────────────────────────────────────────────

  function renderActionBarItem(key: ActionKey, todo: Todo) {
    switch (key) {
      case "add_before":
        if (!hasPerm("create_todos")) return null;
        return (
          <Tooltip key={key} content={t.actionAddBefore} relationship="label">
            <Button
              appearance="transparent"
              size="small"
              className={styles.actionBarBtn}
              icon={<ArrowUp24Regular />}
              onClick={(e) => {
                e.stopPropagation();
                setInsertingAt({ id: todo.id, position: "before" });
                setInsertTitle("");
              }}
            />
          </Tooltip>
        );
      case "add_after":
        if (!hasPerm("create_todos")) return null;
        return (
          <Tooltip key={key} content={t.actionAddAfter} relationship="label">
            <Button
              appearance="transparent"
              size="small"
              className={styles.actionBarBtn}
              icon={<ArrowDown24Regular />}
              onClick={(e) => {
                e.stopPropagation();
                setInsertingAt({ id: todo.id, position: "after" });
                setInsertTitle("");
              }}
            />
          </Tooltip>
        );
      case "add_subtodo":
        if (!hasPerm("add_subtodos")) return null;
        return (
          <Tooltip key={key} content={t.actionAddSubTodo} relationship="label">
            <Button
              appearance="transparent"
              size="small"
              className={styles.actionBarBtn}
              icon={<AddCircle24Regular />}
              onClick={(e) => {
                e.stopPropagation();
                setAddingSubFor(todo.id);
                setSubTitle("");
              }}
            />
          </Tooltip>
        );
      case "edit":
        if (!canModify(todo)) return null;
        return (
          <Tooltip key={key} content={t.edit} relationship="label">
            <Button
              appearance="transparent"
              size="small"
              className={styles.actionBarBtn}
              icon={<Edit24Regular />}
              onClick={(e) => {
                e.stopPropagation();
                setEditingId(todo.id);
                setEditTitle(todo.title);
              }}
            />
          </Tooltip>
        );
      case "complete":
        if (todo.userId !== user?.id && !hasPerm("complete_any_todo"))
          return null;
        return (
          <Tooltip
            key={key}
            content={
              todo.completed ? t.actionMarkIncomplete : t.actionMarkComplete
            }
            relationship="label"
          >
            <Button
              appearance="transparent"
              size="small"
              className={styles.actionBarBtn}
              icon={
                todo.completed ? (
                  <Circle24Regular />
                ) : (
                  <CheckmarkCircle24Regular />
                )
              }
              onClick={(e) => {
                e.stopPropagation();
                toggleTodo(todo);
              }}
            />
          </Tooltip>
        );
      case "claim":
        if (
          !hasPerm("claim_todos") ||
          (todo.claimedBy && todo.claimedBy !== user?.id)
        )
          return null;
        return (
          <Tooltip
            key={key}
            content={
              todo.claimedBy === user?.id ? t.actionUnclaim : t.actionClaim
            }
            relationship="label"
          >
            <Button
              appearance="transparent"
              size="small"
              className={styles.actionBarBtn}
              icon={
                todo.claimedBy === user?.id ? (
                  <PersonDelete24Regular />
                ) : (
                  <PersonAvailable24Regular />
                )
              }
              onClick={(e) => {
                e.stopPropagation();
                claimTodo(todo);
              }}
            />
          </Tooltip>
        );
      case "comment":
        if (!hasPerm("comment")) return null;
        return (
          <Tooltip key={key} content={t.actionComments} relationship="label">
            <Button
              appearance="transparent"
              size="small"
              className={styles.actionBarBtn}
              icon={<Comment24Regular />}
              onClick={(e) => {
                e.stopPropagation();
                setCommentTodoId(todo.id);
              }}
            />
          </Tooltip>
        );
      case "delete":
        if (!canDeleteTodo(todo)) return null;
        return (
          <Tooltip key={key} content={t.delete} relationship="label">
            <Button
              appearance="transparent"
              size="small"
              className={styles.actionBarBtn}
              icon={<Delete24Regular />}
              onClick={(e) => {
                e.stopPropagation();
                setConfirmAction({
                  message: t.confirmDeleteTodo,
                  action: () => deleteTodo(todo.id),
                });
              }}
            />
          </Tooltip>
        );
      default:
        return null;
    }
  }

  // ─── Render todo item ────────────────────────────────────────────────────

  function renderTodo(todo: Todo, index: number, root: boolean): ReactNode {
    const children = getChildren(todo.id);
    const hasChildren = children.length > 0;
    const isExpanded = expanded.has(todo.id);
    const isEditing = editingId === todo.id;

    const isDraggingThis =
      canDrag &&
      (root
        ? dragIndex === index
        : subDragParentId === todo.parentId && subDragIndex === index);
    const isDragOverThis =
      canDrag &&
      (root
        ? dragOverIndex === index && dragIndex !== index
        : subDragParentId === todo.parentId &&
          subDragOverIndex === index &&
          subDragIndex !== index);

    const isActionBarVisible = hoveredTodoId === todo.id || shiftHeld;

    return (
      <div key={todo.id}>
        {insertingAt?.id === todo.id && insertingAt.position === "before" && (
          <div className={styles.insertInputRow}>
            <Input
              className={styles.inputFlex}
              size="small"
              placeholder={t.todoInsertPlaceholder}
              value={insertTitle}
              onChange={(_, d) => setInsertTitle(d.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addTodoAt(todo.id, "before");
                if (e.key === "Escape") setInsertingAt(null);
              }}
              autoFocus
            />
            <Button
              appearance="primary"
              size="small"
              icon={<Add24Regular />}
              onClick={() => addTodoAt(todo.id, "before")}
              disabled={!insertTitle.trim()}
            >
              {isMobile ? undefined : t.add}
            </Button>
            <Button
              appearance="subtle"
              size="small"
              icon={<Dismiss24Regular />}
              onClick={() => setInsertingAt(null)}
            />
          </div>
        )}
        <div
          className={
            "fui-todo-row " +
            mergeClasses(
              styles.todoItem,
              isMobile && styles.todoItemMobile,
              selected.has(todo.id) && styles.todoItemSelected,
              isDraggingThis && styles.todoItemDragging,
              isDragOverThis && styles.todoItemDragOver,
            )
          }
          onMouseEnter={() => setHoveredTodoId(todo.id)}
          onMouseLeave={() => setHoveredTodoId(null)}
          draggable={canDrag}
          onDragStart={
            canDrag
              ? () =>
                  root
                    ? handleDragStart(index)
                    : handleSubDragStart(todo.parentId!, index)
              : undefined
          }
          onDragEnter={
            canDrag
              ? () =>
                  root
                    ? handleDragEnter(index)
                    : handleSubDragEnter(todo.parentId!, index)
              : undefined
          }
          onDragLeave={
            canDrag ? (root ? handleDragLeave : handleSubDragLeave) : undefined
          }
          onDragOver={canDrag ? handleDragOver : undefined}
          onDrop={
            canDrag
              ? () =>
                  root
                    ? handleDrop(index)
                    : handleSubDrop(todo.parentId!, index)
              : undefined
          }
          onDragEnd={
            canDrag ? (root ? handleDragEnd : handleSubDragEnd) : undefined
          }
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
          {canDrag && (
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
                  if (n.has(todo.id)) n.delete(todo.id);
                  else n.add(todo.id);
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
                {todo.claimedBy &&
                  (() => {
                    const claimer =
                      todo.claimedByName ||
                      (todo.claimedBy === user?.id
                        ? user?.displayName || user?.username
                        : null);
                    const isMe = todo.claimedBy === user?.id;
                    return (
                      <Popover trapFocus={false} withArrow size="small">
                        <PopoverTrigger disableButtonEnhancement>
                          <span
                            className={styles.claimedBadge}
                            style={{ cursor: "pointer" }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {todo.claimedByAvatar ? (
                              <img
                                src={todo.claimedByAvatar}
                                alt=""
                                className={styles.claimedAvatar}
                              />
                            ) : (
                              <PersonAvailable24Regular
                                style={{ fontSize: 14 }}
                              />
                            )}
                          </span>
                        </PopoverTrigger>
                        <PopoverSurface>
                          <div className={styles.claimedFlyout}>
                            {todo.claimedByAvatar ? (
                              <img
                                src={todo.claimedByAvatar}
                                alt=""
                                className={styles.claimedFlyoutAvatar}
                              />
                            ) : (
                              <PersonAvailable24Regular
                                style={{
                                  fontSize: 28,
                                  color: tokens.colorPaletteGreenForeground1,
                                }}
                              />
                            )}
                            <div className={styles.claimedFlyoutInfo}>
                              <span className={styles.claimedFlyoutName}>
                                {claimer ?? "Unknown user"}
                              </span>
                              <span className={styles.claimedFlyoutSub}>
                                {t.actionClaimedStatus}
                              </span>
                              {isMe && (
                                <Button
                                  size="small"
                                  appearance="subtle"
                                  style={{
                                    marginTop: 4,
                                    padding: "2px 6px",
                                    minWidth: 0,
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    claimTodo(todo);
                                  }}
                                >
                                  {t.actionUnclaim}
                                </Button>
                              )}
                            </div>
                          </div>
                        </PopoverSurface>
                      </Popover>
                    );
                  })()}
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
            <div
              className={styles.actionBar}
              style={{
                opacity: isActionBarVisible ? 1 : 0,
                pointerEvents: isActionBarVisible ? "auto" : "none",
              }}
            >
              {actionBarActions.map((key) => renderActionBarItem(key, todo))}
            </div>
          )}

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

        {insertingAt?.id === todo.id && insertingAt.position === "after" && (
          <div className={styles.insertInputRow}>
            <Input
              className={styles.inputFlex}
              size="small"
              placeholder={t.todoInsertPlaceholder}
              value={insertTitle}
              onChange={(_, d) => setInsertTitle(d.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addTodoAt(todo.id, "after");
                if (e.key === "Escape") setInsertingAt(null);
              }}
              autoFocus
            />
            <Button
              appearance="primary"
              size="small"
              icon={<Add24Regular />}
              onClick={() => addTodoAt(todo.id, "after")}
              disabled={!insertTitle.trim()}
            >
              {isMobile ? undefined : t.add}
            </Button>
            <Button
              appearance="subtle"
              size="small"
              icon={<Dismiss24Regular />}
              onClick={() => setInsertingAt(null)}
            />
          </div>
        )}

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

  // ─── Settings page ───────────────────────────────────────────────────────

  if (showSettings && selectedSpace?.kind === "team") {
    return (
      <SettingsPage
        teamId={selectedSpaceId}
        onBack={() => {
          navigate(`/${selectedSpaceId}`);
          refreshBranding();
        }}
        userSettings={userSettings}
        onUpdateUserSettings={updateUserSettings}
      />
    );
  }

  // ─── No spaces ───────────────────────────────────────────────────────────

  if (spaces.length === 0) {
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
            <Subtitle2>{t.todoNoTeams}</Subtitle2>
            <br />
            <Body1>{t.todoNoTeamsDesc}</Body1>
            <br />
            <Button
              appearance="secondary"
              onClick={logout}
              style={{ marginTop: 12 }}
            >
              {t.signOut}
            </Button>
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

  if (switchingSpace) {
    return (
      <SelectSpacePage
        spaces={spaces}
        selectedSpaceId={selectedSpaceId}
        user={
          user
            ? {
                displayName: user.displayName,
                username: user.username,
                avatarUrl: user.avatarUrl,
              }
            : null
        }
        onSelect={(id) => {
          navigate(`/${id}`);
          setSwitchingSpace(false);
        }}
        onCancel={() => setSwitchingSpace(false)}
      />
    );
  }

  return (
    <>
      <div className={styles.layout}>
        <Sidebar
          isMobile={isMobile}
          drawerOpen={drawerOpen}
          onDrawerChange={setDrawerOpen}
          spaces={spaces}
          selectedSpaceId={selectedSpaceId}
          onSpaceChange={selectSpace}
          onSwitchSpace={() => setSwitchingSpace(true)}
          sets={sets}
          selectedSetId={selectedSetId}
          onSetSelect={(id) => navigate(`/${selectedSpaceId}/${id}`)}
          loadingSets={loadingSets}
          siteName={siteName}
          siteLogo={siteLogo}
          canManageSettings={selectedSpace?.kind === "team"}
          canManageSets={hasPerm("manage_sets")}
          onOpenSettings={() => navigate(`/${selectedSpaceId}/settings`)}
          onAddSet={handleAddSet}
          onImportSet={(set) => {
            setSets((prev) =>
              [...prev, set].sort((a, b) => a.sortOrder - b.sortOrder),
            );
            navigate(`/${selectedSpaceId}/${set.id}`);
          }}
          onDeleteSet={(setId) =>
            setConfirmAction({
              message: t.confirmDeleteSet,
              action: () => handleDeleteSet(setId),
            })
          }
          onRenameSet={handleRenameSet}
          onUpdateSet={handleUpdateSet}
          onReorderSets={handleReorderSets}
          defaultTimezone={defaultTimezone}
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
                  {rootTodos.length === 1
                    ? t.todoItemCount
                        .split(" | ")[0]
                        .replace("{count}", String(rootTodos.length))
                    : (
                        t.todoItemCount.split(" | ")[1] ?? t.todoItemCount
                      ).replace("{count}", String(rootTodos.length))}
                </Caption1>
              </div>

              {selected.size > 0 && (
                <SelectionBar
                  count={selected.size}
                  isMobile={isMobile}
                  onSelectAll={selectAll}
                  onMarkCompleted={() => bulkMarkCompleted(true)}
                  onMarkIncomplete={() => bulkMarkCompleted(false)}
                  onDelete={() =>
                    setConfirmAction({
                      message: t.confirmBulkDelete.replace(
                        "{count}",
                        String(selected.size),
                      ),
                      action: bulkDelete,
                    })
                  }
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
                  {hasPerm("create_todos") && (
                    <Button
                      appearance="subtle"
                      icon={<ArrowImport24Regular />}
                      onClick={() => {
                        setTransferMode("import");
                        setTransferOpen(true);
                      }}
                      title={t.todoImport}
                    >
                      {isMobile ? undefined : t.todoImport}
                    </Button>
                  )}
                  {hasPerm("view_todos") && (
                    <Button
                      appearance="subtle"
                      icon={<ArrowExport24Regular />}
                      onClick={() => {
                        setTransferMode("export");
                        setTransferOpen(true);
                      }}
                      title={t.todoExport}
                    >
                      {isMobile ? undefined : t.todoExport}
                    </Button>
                  )}
                </div>

                {loadingTodos ? (
                  <div className={styles.empty}>
                    <Spinner size="medium" label={t.todoLoadingTodos} />
                  </div>
                ) : rootTodos.length === 0 ? (
                  <div className={styles.empty}>
                    <Body1>{t.todoEmpty}</Body1>
                  </div>
                ) : (
                  (() => {
                    if (!splitCompleted) {
                      return rootTodos.map((todo, index) =>
                        renderTodo(todo, index, true),
                      );
                    }

                    // When splitCompleted is enabled, render incomplete first, then a header and completed
                    const displayOrder = [
                      ...incompleteRootTodos,
                      ...completedRootTodos,
                    ];
                    const completedCount = completedRootTodos.length;
                    const collapsed = selectedSetId
                      ? (completedCollapsed[selectedSetId] ?? false)
                      : false;

                    return displayOrder.map((todo, i) => {
                      // original index among rootTodos (used for drag indices)
                      const origIndex = rootTodos.findIndex(
                        (t) => t.id === todo.id,
                      );

                      // insert header before first completed item
                      const insertHeader =
                        todo.completed &&
                        (i === 0 || !displayOrder[i - 1].completed);

                      const elems: any[] = [];
                      if (insertHeader) {
                        elems.push(
                          <div
                            key={`completed-header-${todo.id}`}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              marginTop: 8,
                              marginBottom: 8,
                            }}
                          >
                            <Caption1>
                              {t.completedSection.replace(
                                "{count}",
                                String(completedCount),
                              )}
                            </Caption1>
                            <Button
                              appearance="transparent"
                              size="small"
                              className={styles.expandBtn}
                              icon={
                                collapsed ? (
                                  <ChevronRight20Regular />
                                ) : (
                                  <ChevronDown20Regular />
                                )
                              }
                              onClick={() => {
                                if (!selectedSetId) return;
                                setCompletedCollapsed((p) => ({
                                  ...p,
                                  [selectedSetId]: !collapsed,
                                }));
                              }}
                            />
                          </div>,
                        );
                      }

                      if (!todo.completed || !collapsed) {
                        elems.push(
                          <div key={todo.id}>
                            {renderTodo(todo, origIndex, true)}
                          </div>,
                        );
                      }

                      return <>{elems}</>;
                    });
                  })()
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
                  {sets.length === 0 ? t.todoCreateSet : t.todoSelectSet}
                </Subtitle2>
                {isMobile && (
                  <Button
                    appearance="primary"
                    style={{ marginTop: 16 }}
                    onClick={() => setDrawerOpen(true)}
                  >
                    {t.todoOpenSets}
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
        teamId={selectedSpaceId}
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

      <SetTransferDialog
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        mode={transferMode}
        teamId={selectedSpaceId}
        setId={selectedSetId}
        setName={selectedSet?.name}
        onImported={fetchTodos}
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
          onAddBefore={() => {
            setInsertingAt({ id: contextTodo.id, position: "before" });
            setInsertTitle("");
          }}
          onAddAfter={() => {
            setInsertingAt({ id: contextTodo.id, position: "after" });
            setInsertTitle("");
          }}
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
          onClaim={() => claimTodo(contextTodo)}
          isClaimed={contextTodo.claimedBy !== null}
          isClaimedByMe={contextTodo.claimedBy === user?.id}
          onDelete={() =>
            setConfirmAction({
              message: t.confirmDeleteTodo,
              action: () => deleteTodo(contextTodo.id),
            })
          }
          rootCount={rootTodos.length}
        />
      )}
      <ConfirmDialog
        open={confirmAction !== null}
        message={confirmAction?.message ?? ""}
        onConfirm={() => {
          confirmAction?.action();
          setConfirmAction(null);
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  );
}
