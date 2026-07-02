import { useEffect, useMemo, useRef, useState } from "react";
import {
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Input,
  Avatar,
  Spinner,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { Checkmark16Regular, Search16Regular } from "@fluentui/react-icons";
import type { Assignee, TeamMember } from "../types";
import { useI18n } from "../i18n";

const useStyles = makeStyles({
  surface: {
    padding: 0,
    width: "280px",
    maxWidth: "90vw",
  },
  header: {
    padding: "8px 12px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    fontSize: "12px",
    fontWeight: 600,
    color: tokens.colorNeutralForeground3,
  },
  searchRow: {
    padding: "8px 10px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  list: {
    maxHeight: "260px",
    overflowY: "auto",
    padding: "4px",
  },
  item: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 8px",
    borderRadius: tokens.borderRadiusMedium,
    cursor: "pointer",
    border: "none",
    background: "none",
    width: "100%",
    textAlign: "left" as const,
    "&:hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  check: {
    width: "16px",
    flexShrink: 0,
    color: tokens.colorCompoundBrandForeground1,
  },
  info: {
    display: "flex",
    flexDirection: "column" as const,
    minWidth: 0,
    flex: 1,
  },
  name: {
    fontSize: "13px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  username: {
    fontSize: "11px",
    color: tokens.colorNeutralForeground4,
    fontFamily: "'Cascadia Code', 'Cascadia Mono', Consolas, monospace",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  empty: {
    padding: "16px",
    textAlign: "center" as const,
    color: tokens.colorNeutralForeground4,
    fontSize: "12px",
  },
});

type Props = {
  teamId: string;
  todoId: string;
  assignees: Assignee[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: (assignees: Assignee[]) => void;
  children: React.ReactElement;
};

// A github-style assignee picker: search box + checkable member list. Currently
// assigned members show a check; toggling applies immediately (PUT full set).
export function AssigneePicker({
  teamId,
  todoId,
  assignees,
  open,
  onOpenChange,
  onChanged,
  children,
}: Props) {
  const styles = useStyles();
  const { t } = useI18n();
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const membersCache = useRef<TeamMember[] | null>(null);

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    queueMicrotask(() => {
      if (ctrl.signal.aborted) return;
      setQuery("");
      if (membersCache.current) {
        setMembers(membersCache.current);
        return;
      }
      setLoading(true);
      fetch(`/api/teams/${teamId}/members`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { members: [] }))
        .then((data: { members: TeamMember[] }) => {
          membersCache.current = data.members;
          setMembers(data.members);
        })
        .catch(() => setMembers([]))
        .finally(() => setLoading(false));
    });
    return () => ctrl.abort();
  }, [open, teamId]);

  const assignedIds = useMemo(
    () => new Set(assignees.map((a) => a.userId)),
    [assignees],
  );

  // Merge members with anyone already assigned but missing from the roster
  // (e.g. a user who has since left the team).
  const rows = useMemo(() => {
    const base: TeamMember[] = members ? [...members] : [];
    const known = new Set(base.map((m) => m.userId));
    for (const a of assignees) {
      if (!known.has(a.userId)) {
        base.push({
          userId: a.userId,
          name: a.name || a.username || a.userId,
          username: a.username || "",
          avatarUrl: a.avatarUrl,
        });
      }
    }
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.username.toLowerCase().includes(q),
    );
  }, [members, assignees, query]);

  const commit = async (nextIds: string[]) => {
    // Optimistic: build assignee objects from known member/assignee data.
    const lookup = new Map<string, Assignee>();
    for (const a of assignees) lookup.set(a.userId, a);
    for (const m of membersCache.current ?? []) {
      lookup.set(m.userId, {
        userId: m.userId,
        name: m.name,
        username: m.username,
        avatarUrl: m.avatarUrl,
      });
    }
    const optimistic = nextIds.map(
      (id) =>
        lookup.get(id) ?? {
          userId: id,
          name: null,
          username: null,
          avatarUrl: null,
        },
    );
    onChanged(optimistic);
    try {
      const res = await fetch(
        `/api/teams/${teamId}/todos/${todoId}/assignees`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userIds: nextIds }),
        },
      );
      if (res.ok) {
        const data: { assignees: Assignee[] } = await res.json();
        onChanged(data.assignees);
      }
    } catch {
      // Leave the optimistic state in place on network error.
    }
  };

  const toggle = (userId: string) => {
    const next = new Set(assignedIds);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);
    void commit([...next]);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(_, d) => onOpenChange(d.open)}
      positioning="below-start"
      trapFocus
    >
      <PopoverTrigger disableButtonEnhancement>{children}</PopoverTrigger>
      <PopoverSurface className={styles.surface}>
        <div className={styles.header}>{t.assignTitle}</div>
        <div className={styles.searchRow}>
          <Input
            size="small"
            contentBefore={<Search16Regular />}
            placeholder={t.assignSearchPlaceholder}
            value={query}
            onChange={(_, d) => setQuery(d.value)}
            style={{ width: "100%" }}
            autoFocus
          />
        </div>
        <div className={styles.list}>
          {loading ? (
            <div className={styles.empty}>
              <Spinner size="tiny" />
            </div>
          ) : rows.length === 0 ? (
            <div className={styles.empty}>{t.assignNoMembers}</div>
          ) : (
            rows.map((m) => {
              const checked = assignedIds.has(m.userId);
              return (
                <button
                  key={m.userId}
                  className={styles.item}
                  onClick={() => toggle(m.userId)}
                >
                  <span className={styles.check}>
                    {checked ? <Checkmark16Regular /> : null}
                  </span>
                  <Avatar
                    name={m.name}
                    image={m.avatarUrl ? { src: m.avatarUrl } : undefined}
                    size={24}
                  />
                  <span className={styles.info}>
                    <span className={styles.name}>{m.name}</span>
                    {m.username && (
                      <span className={styles.username}>@{m.username}</span>
                    )}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </PopoverSurface>
    </Popover>
  );
}
