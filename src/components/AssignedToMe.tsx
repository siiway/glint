import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Checkbox,
  Body2,
  Caption1,
  Title2,
  Spinner,
  Tooltip,
  makeStyles,
  tokens,
  mergeClasses,
} from "@fluentui/react-components";
import {
  ChevronRight20Regular,
  ChevronDown20Regular,
  Navigation24Regular,
  ChevronDoubleRight20Regular,
  Mail24Regular,
  CheckmarkCircle24Regular,
} from "@fluentui/react-icons";
import { useI18n } from "../i18n";
import { useIsMobile } from "../hooks/useIsMobile";
import { EmptyState } from "./EmptyState";

const useStyles = makeStyles({
  header: {
    padding: "16px 24px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
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
  group: {
    marginBottom: "8px",
  },
  groupHeader: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px 4px",
    cursor: "pointer",
    borderRadius: tokens.borderRadiusMedium,
    userSelect: "none" as const,
    "&:hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  groupName: {
    fontWeight: 600,
  },
  groupCount: {
    color: tokens.colorNeutralForeground4,
  },
  todoItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 8px 6px 26px",
    borderRadius: tokens.borderRadiusMedium,
    "&:hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  todoTitle: {
    flex: 1,
    minWidth: 0,
    wordBreak: "break-word",
  },
  setLink: {
    color: tokens.colorBrandForeground1,
    cursor: "pointer",
    fontSize: "11px",
    flexShrink: 0,
    "&:hover": {
      textDecoration: "underline",
    },
  },
  expandBtn: {
    minWidth: "20px",
    width: "20px",
    height: "20px",
    padding: "0",
  },
  empty: {
    textAlign: "center" as const,
    padding: "48px 0",
    color: tokens.colorNeutralForeground4,
  },
});

type AssignedTodo = {
  id: string;
  setId: string;
  parentId: string | null;
  title: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
};

type AssignedGroup = {
  setId: string;
  setName: string | null;
  todos: AssignedTodo[];
};

type Props = {
  teamId: string;
  sidebarCollapsed: boolean;
  onExpandSidebar: () => void;
  onOpenDrawer: () => void;
  onOpenSet: (setId: string) => void;
};

export function AssignedToMe({
  teamId,
  sidebarCollapsed,
  onExpandSidebar,
  onOpenDrawer,
  onOpenSet,
}: Props) {
  const styles = useStyles();
  const { t } = useI18n();
  const isMobile = useIsMobile();

  const [groups, setGroups] = useState<AssignedGroup[]>([]);
  const [expand, setExpand] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/assigned-to-me`);
      if (res.ok) {
        const data: {
          groups: AssignedGroup[];
          expand: Record<string, boolean>;
        } = await res.json();
        setGroups(data.groups);
        setExpand(data.expand ?? {});
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchData();
    });
  }, [fetchData]);

  // A list is expanded unless explicitly collapsed (MS To Do default-open).
  const isExpanded = (setId: string) => expand[setId] !== false;

  const toggleGroup = (setId: string) => {
    const next = !isExpanded(setId);
    setExpand((prev) => ({ ...prev, [setId]: next }));
    // Record the new state in the background via a beacon.
    try {
      const blob = new Blob([JSON.stringify({ setId, expanded: next })], {
        type: "application/json",
      });
      navigator.sendBeacon(`/api/teams/${teamId}/assigned-expand`, blob);
    } catch {
      // Beacon unsupported / blocked — non-critical.
    }
  };

  const completeTodo = async (todo: AssignedTodo) => {
    // Completing keeps the assignment but hides the todo from this view.
    setGroups((prev) =>
      prev
        .map((g) =>
          g.setId === todo.setId
            ? { ...g, todos: g.todos.filter((tt) => tt.id !== todo.id) }
            : g,
        )
        .filter((g) => g.todos.length > 0),
    );
    await fetch(`/api/teams/${teamId}/todos/${todo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    });
  };

  const totalCount = groups.reduce((n, g) => n + g.todos.length, 0);

  return (
    <>
      <div
        className={mergeClasses(styles.header, isMobile && styles.headerMobile)}
      >
        {isMobile && (
          <Button
            appearance="transparent"
            icon={<Navigation24Regular />}
            onClick={onOpenDrawer}
          />
        )}
        {!isMobile && sidebarCollapsed && (
          <Tooltip content={t.expandSidebar} relationship="label">
            <Button
              appearance="transparent"
              icon={<ChevronDoubleRight20Regular />}
              onClick={onExpandSidebar}
            />
          </Tooltip>
        )}
        <Mail24Regular />
        <Title2 style={isMobile ? { fontSize: "18px" } : undefined}>
          {t.assignedToMe}
        </Title2>
        <Caption1 style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>
          {t.assignedToMeCount.replace("{count}", String(totalCount))}
        </Caption1>
      </div>

      <div
        className={mergeClasses(
          styles.content,
          isMobile && styles.contentMobile,
        )}
      >
        {loading ? (
          <div className={styles.empty}>
            <Spinner size="medium" label={t.todoLoadingTodos} />
          </div>
        ) : totalCount === 0 ? (
          <EmptyState
            icon={<CheckmarkCircle24Regular />}
            title={t.assignedToMeEmpty}
            description={t.assignedToMeEmptyDesc}
          />
        ) : (
          groups.map((group) => {
            const open = isExpanded(group.setId);
            return (
              <div key={group.setId} className={styles.group}>
                <div
                  className={styles.groupHeader}
                  onClick={() => toggleGroup(group.setId)}
                >
                  <Button
                    appearance="transparent"
                    size="small"
                    className={styles.expandBtn}
                    icon={
                      open ? (
                        <ChevronDown20Regular />
                      ) : (
                        <ChevronRight20Regular />
                      )
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleGroup(group.setId);
                    }}
                  />
                  <Body2 className={styles.groupName}>
                    {group.setName || t.assignedToMeUnknownList}
                  </Body2>
                  <Caption1 className={styles.groupCount}>
                    {group.todos.length}
                  </Caption1>
                  <span
                    className={styles.setLink}
                    style={{ marginLeft: "auto" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenSet(group.setId);
                    }}
                  >
                    {t.assignedToMeOpenList}
                  </span>
                </div>
                {open &&
                  group.todos.map((todo) => (
                    <div key={todo.id} className={styles.todoItem}>
                      <Checkbox
                        checked={false}
                        onChange={() => completeTodo(todo)}
                      />
                      <Body2 className={styles.todoTitle}>{todo.title}</Body2>
                    </div>
                  ))}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
