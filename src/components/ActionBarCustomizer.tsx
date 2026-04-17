import { useState, type ReactElement } from "react";
import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogContent,
  DialogActions,
  Button,
  Checkbox,
  Divider,
  Text,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import {
  ArrowUp24Regular,
  ArrowDown24Regular,
  AddCircle24Regular,
  Edit24Regular,
  CheckmarkCircle24Regular,
  PersonAvailable24Regular,
  Comment24Regular,
  Delete24Regular,
} from "@fluentui/react-icons";
import type { Translations } from "../i18n";

// ─── Constants ───────────────────────────────────────────────────────────────

export const ALL_ACTION_KEYS = [
  "add_before",
  "add_after",
  "add_subtodo",
  "edit",
  "complete",
  "claim",
  "comment",
  "delete",
] as const;

export type ActionKey = (typeof ALL_ACTION_KEYS)[number];

export const BUILTIN_SITE_DEFAULT: ActionKey[] = [
  "add_after",
  "edit",
  "complete",
  "delete",
];

// ─── localStorage helpers ─────────────────────────────────────────────────────

export function loadUserActionBar(): ActionKey[] | null {
  try {
    const v = localStorage.getItem("glint_action_bar_user");
    if (v) return JSON.parse(v);
  } catch {}
  return null;
}

export function loadWorkspaceActionBar(spaceId: string): ActionKey[] | null {
  try {
    const v = localStorage.getItem(`glint_action_bar_ws_${spaceId}`);
    if (v) return JSON.parse(v);
  } catch {}
  return null;
}

export function getEffectiveActions(
  spaceId: string,
  siteDefault: ActionKey[] = BUILTIN_SITE_DEFAULT,
): ActionKey[] {
  return loadUserActionBar() ?? loadWorkspaceActionBar(spaceId) ?? siteDefault;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const useStyles = makeStyles({
  section: {
    marginBottom: "16px",
  },
  sectionTitle: {
    fontWeight: "600",
    marginBottom: "8px",
    display: "block",
    color: tokens.colorNeutralForeground1,
  },
  actionRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "3px 0",
  },
  actionIcon: {
    color: tokens.colorNeutralForeground3,
    display: "flex",
    alignItems: "center",
    fontSize: "16px",
  },
  hint: {
    fontSize: "12px",
    color: tokens.colorNeutralForeground4,
    marginTop: "4px",
    display: "block",
  },
  saveRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap" as const,
    marginTop: "10px",
  },
  siteDefault: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "6px",
    marginTop: "6px",
  },
  siteChip: {
    padding: "2px 8px",
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground3,
    fontSize: "12px",
    color: tokens.colorNeutralForeground2,
  },
});

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  open: boolean;
  onClose: () => void;
  spaceId: string;
  isOwner: boolean;
  siteDefault: ActionKey[];
  t: Translations;
  onSaved: () => void;
};

// ─── Component ───────────────────────────────────────────────────────────────

export function ActionBarCustomizer({
  open,
  onClose,
  spaceId,
  isOwner,
  siteDefault,
  t,
  onSaved,
}: Props) {
  const styles = useStyles();

  const [editUser, setEditUser] = useState<ActionKey[]>(
    () => loadUserActionBar() ?? loadWorkspaceActionBar(spaceId) ?? siteDefault,
  );
  const [editWs, setEditWs] = useState<ActionKey[]>(
    () => loadWorkspaceActionBar(spaceId) ?? siteDefault,
  );

  const toggle = (
    list: ActionKey[],
    set: (v: ActionKey[]) => void,
    key: ActionKey,
  ) => {
    set(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  };

  const saveUser = () => {
    localStorage.setItem("glint_action_bar_user", JSON.stringify(editUser));
    onSaved();
    onClose();
  };

  const resetUser = () => {
    localStorage.removeItem("glint_action_bar_user");
    setEditUser(loadWorkspaceActionBar(spaceId) ?? siteDefault);
    onSaved();
  };

  const saveWs = () => {
    localStorage.setItem(
      `glint_action_bar_ws_${spaceId}`,
      JSON.stringify(editWs),
    );
    onSaved();
  };

  const resetWs = () => {
    localStorage.removeItem(`glint_action_bar_ws_${spaceId}`);
    setEditWs(siteDefault);
    onSaved();
  };

  const label = (key: ActionKey) => {
    const map: Record<ActionKey, string> = {
      add_before: t.actionAddBefore,
      add_after: t.actionAddAfter,
      add_subtodo: t.actionAddSubTodo,
      edit: t.edit,
      complete: t.actionMarkComplete,
      claim: t.actionClaim,
      comment: t.actionComments,
      delete: t.delete,
    };
    return map[key];
  };

  const icon = (key: ActionKey) => {
    const s = { fontSize: 16 };
    const map: Record<ActionKey, ReactElement> = {
      add_before: <ArrowUp24Regular style={s} />,
      add_after: <ArrowDown24Regular style={s} />,
      add_subtodo: <AddCircle24Regular style={s} />,
      edit: <Edit24Regular style={s} />,
      complete: <CheckmarkCircle24Regular style={s} />,
      claim: <PersonAvailable24Regular style={s} />,
      comment: <Comment24Regular style={s} />,
      delete: <Delete24Regular style={s} />,
    };
    return map[key];
  };

  const hasUserPref = loadUserActionBar() !== null;
  const hasWsPref = loadWorkspaceActionBar(spaceId) !== null;

  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{t.actionBarTitle}</DialogTitle>
          <DialogContent>
            {/* User-level */}
            <div className={styles.section}>
              <Text className={styles.sectionTitle}>
                {t.actionBarUserLevel}
              </Text>
              {ALL_ACTION_KEYS.map((key) => (
                <div key={key} className={styles.actionRow}>
                  <span className={styles.actionIcon}>{icon(key)}</span>
                  <Checkbox
                    label={label(key)}
                    checked={editUser.includes(key)}
                    onChange={() => toggle(editUser, setEditUser, key)}
                  />
                </div>
              ))}
              <div className={styles.saveRow}>
                <Button size="small" appearance="primary" onClick={saveUser}>
                  {t.actionBarSaveUser}
                </Button>
                {hasUserPref && (
                  <Button size="small" appearance="subtle" onClick={resetUser}>
                    {t.actionBarResetUser}
                  </Button>
                )}
              </div>
            </div>

            {/* Workspace-level (owners only) */}
            {isOwner && (
              <>
                <Divider />
                <div className={styles.section} style={{ marginTop: "16px" }}>
                  <Text className={styles.sectionTitle}>
                    {t.actionBarWorkspaceLevel}
                  </Text>
                  {ALL_ACTION_KEYS.map((key) => (
                    <div key={key} className={styles.actionRow}>
                      <span className={styles.actionIcon}>{icon(key)}</span>
                      <Checkbox
                        label={label(key)}
                        checked={editWs.includes(key)}
                        onChange={() => toggle(editWs, setEditWs, key)}
                      />
                    </div>
                  ))}
                  <div className={styles.saveRow}>
                    <Button size="small" appearance="primary" onClick={saveWs}>
                      {t.actionBarSaveWorkspace}
                    </Button>
                    {hasWsPref && (
                      <Button
                        size="small"
                        appearance="subtle"
                        onClick={resetWs}
                      >
                        {t.actionBarResetUser}
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Site default (read-only) */}
            <Divider style={{ marginTop: 16, marginBottom: 12 }} />
            <Text className={styles.sectionTitle}>{t.actionBarSiteLevel}</Text>
            <div className={styles.siteDefault}>
              {siteDefault.map((key) => (
                <span key={key} className={styles.siteChip}>
                  {label(key)}
                </span>
              ))}
            </div>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onClose}>
              {t.close}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
