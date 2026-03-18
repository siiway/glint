import { useState, useEffect, useCallback } from "react";
import {
  Input,
  Button,
  Body1,
  Body2,
  Title2,
  Title3,
  Subtitle2,
  Spinner,
  Switch,
  Divider,
  Select,
  Tooltip,
  TabList,
  Tab,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import {
  ArrowLeft24Regular,
  Save24Regular,
  ArrowReset24Regular,
} from "@fluentui/react-icons";
import { Footer } from "./Footer";

// ─── Types ───────────────────────────────────────────────────────────────────

type AppConfig = {
  prism_base_url: string;
  prism_client_id: string;
  prism_client_secret: string;
  prism_redirect_uri: string;
  use_pkce: boolean;
  allowed_team_id: string;
};

type TeamSettings = {
  site_name: string;
  site_logo_url: string;
  accent_color: string;
  welcome_message: string;
  default_set_name: string;
  allow_member_create_sets: boolean;
};

type PermissionKey = string;

type PermissionsData = {
  keys: PermissionKey[];
  defaults: Record<string, Record<string, boolean>>;
  global: Record<string, Record<string, boolean>>;
  sets: Record<string, Record<string, Record<string, boolean>>>;
  role: string;
};

type TodoSet = {
  id: string;
  name: string;
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const useStyles = makeStyles({
  container: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "16px 24px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  content: {
    flex: 1,
    overflowY: "auto",
    padding: "24px",
  },
  section: {
    marginBottom: "32px",
  },
  sectionTitle: {
    marginBottom: "16px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    marginBottom: "16px",
  },
  fieldRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "12px",
  },
  fieldLabel: {
    minWidth: "160px",
    fontWeight: "600",
  },
  permTable: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "14px",
  },
  permTh: {
    padding: "8px 12px",
    textAlign: "left" as const,
    borderBottom: `2px solid ${tokens.colorNeutralStroke1}`,
    fontWeight: "600",
    whiteSpace: "nowrap",
  },
  permTd: {
    padding: "6px 12px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  permKey: {
    fontFamily: "monospace",
    fontSize: "13px",
  },
  saveBar: {
    display: "flex",
    gap: "8px",
    padding: "12px 24px",
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  scopeSelector: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    marginBottom: "16px",
  },
});

// ─── Friendly names ──────────────────────────────────────────────────────────

const PERM_LABELS: Record<string, { label: string; description: string }> = {
  manage_settings: {
    label: "Manage Settings",
    description: "Edit site name, logo, branding",
  },
  manage_permissions: {
    label: "Manage Permissions",
    description: "Edit permission rules",
  },
  manage_sets: {
    label: "Manage Sets",
    description: "Create, rename, delete, reorder todo sets",
  },
  create_todos: { label: "Create Todos", description: "Add new todos" },
  edit_own_todos: {
    label: "Edit Own Todos",
    description: "Edit todos they created",
  },
  edit_any_todo: {
    label: "Edit Any Todo",
    description: "Edit todos created by others",
  },
  delete_own_todos: {
    label: "Delete Own Todos",
    description: "Delete todos they created",
  },
  delete_any_todo: {
    label: "Delete Any Todo",
    description: "Delete todos created by others",
  },
  complete_any_todo: {
    label: "Complete Any Todo",
    description: "Toggle completion on others' todos",
  },
  add_subtodos: {
    label: "Add Sub-todos",
    description: "Create nested sub-todos",
  },
  reorder_todos: {
    label: "Reorder Todos",
    description: "Drag to reorder todos",
  },
  comment: { label: "Comment", description: "Add comments to todos" },
  delete_own_comments: {
    label: "Delete Own Comments",
    description: "Delete comments they posted",
  },
  delete_any_comment: {
    label: "Delete Any Comment",
    description: "Delete comments by others",
  },
  view_todos: { label: "View Todos", description: "View todos in a set" },
};

// ─── Component ───────────────────────────────────────────────────────────────

export function SettingsPage({
  teamId,
  onBack,
}: {
  teamId: string;
  onBack: () => void;
}) {
  const styles = useStyles();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [, setSettings] = useState<TeamSettings | null>(null);
  const [permsData, setPermsData] = useState<PermissionsData | null>(null);
  const [sets, setSets] = useState<TodoSet[]>([]);
  const [editAppConfig, setEditAppConfig] = useState<AppConfig | null>(null);

  // Editable state
  const [editSettings, setEditSettings] = useState<TeamSettings | null>(null);
  const [editPerms, setEditPerms] = useState<
    Record<string, Record<string, boolean>>
  >({});
  const [permScope, setPermScope] = useState("global");
  const [activeTab, setActiveTab] = useState<string>("branding");

  const canManage = permsData?.role === "owner" || false;
  const canManagePerms =
    permsData?.role === "owner" ||
    (permsData?.global?.[(permsData?.role as string) ?? ""]
      ?.manage_permissions ??
      false);

  // Fetch all data
  const fetchData = useCallback(async () => {
    setLoading(true);
    const [settingsRes, permsRes, setsRes, configRes] = await Promise.all([
      fetch(`/api/teams/${teamId}/settings`),
      fetch(`/api/teams/${teamId}/permissions`),
      fetch(`/api/teams/${teamId}/sets`),
      fetch("/api/init/config"),
    ]);

    if (settingsRes.ok) {
      const data = (await settingsRes.json()) as { settings: TeamSettings };
      setSettings(data.settings);
      setEditSettings(data.settings);
    }
    if (permsRes.ok) {
      const data = (await permsRes.json()) as PermissionsData;
      setPermsData(data);
      setEditPerms(data.global);
    }
    if (setsRes.ok) {
      const data = (await setsRes.json()) as {
        sets: Array<{ id: string; name: string }>;
      };
      setSets(data.sets);
    }
    if (configRes.ok) {
      const data = (await configRes.json()) as { config: AppConfig };
      setEditAppConfig(data.config);
    }
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // When scope changes, load the right perms
  useEffect(() => {
    if (!permsData) return;
    if (permScope === "global") {
      setEditPerms(permsData.global);
    } else {
      const setId = permScope;
      const overrides = permsData.sets[setId] ?? {};
      // Merge defaults with overrides
      const merged: Record<string, Record<string, boolean>> = {
        admin: { ...permsData.global.admin, ...overrides.admin },
        member: { ...permsData.global.member, ...overrides.member },
      };
      setEditPerms(merged);
    }
  }, [permScope, permsData]);

  const saveSettings = async () => {
    if (!editSettings) return;
    setSaving(true);
    await fetch(`/api/teams/${teamId}/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editSettings),
    });
    setSettings(editSettings);
    setSaving(false);
  };

  const savePermissions = async () => {
    setSaving(true);
    const scope = permScope === "global" ? "global" : `set:${permScope}`;
    const permissions: {
      role: string;
      permission: string;
      allowed: boolean;
    }[] = [];

    for (const role of ["admin", "member"] as const) {
      for (const key of permsData?.keys ?? []) {
        permissions.push({
          role,
          permission: key,
          allowed: editPerms[role]?.[key] ?? false,
        });
      }
    }

    await fetch(`/api/teams/${teamId}/permissions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, permissions }),
    });
    await fetchData();
    setSaving(false);
  };

  const resetPermissions = async () => {
    setSaving(true);
    const scope = permScope === "global" ? "global" : `set:${permScope}`;
    await fetch(`/api/teams/${teamId}/permissions?scope=${scope}`, {
      method: "DELETE",
    });
    await fetchData();
    setSaving(false);
  };

  const saveAppConfig = async () => {
    if (!editAppConfig) return;
    setSaving(true);
    await fetch("/api/init/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editAppConfig),
    });
    setSaving(false);
  };

  const togglePerm = (role: string, key: string) => {
    setEditPerms((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [key]: !prev[role]?.[key],
      },
    }));
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            flex: 1,
          }}
        >
          <Spinner size="large" label="Loading settings..." />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Button
          appearance="transparent"
          icon={<ArrowLeft24Regular />}
          onClick={onBack}
        />
        <Title2>Settings</Title2>
      </div>

      <div className={styles.content}>
        <TabList
          selectedValue={activeTab}
          onTabSelect={(_, d) => setActiveTab(d.value as string)}
          style={{ marginBottom: 24 }}
        >
          <Tab value="branding">Branding</Tab>
          <Tab value="permissions">Permissions</Tab>
          {canManage && <Tab value="appconfig">App Config</Tab>}
        </TabList>

        {activeTab === "branding" && editSettings && (
          <div className={styles.section}>
            <Title3 className={styles.sectionTitle}>Site Branding</Title3>

            <div className={styles.field}>
              <Body2 className={styles.fieldLabel}>Site Name</Body2>
              <Input
                value={editSettings.site_name}
                onChange={(_, d) =>
                  setEditSettings((s) => s && { ...s, site_name: d.value })
                }
                disabled={!canManage}
                placeholder="Glint"
              />
            </div>

            <div className={styles.field}>
              <Body2 className={styles.fieldLabel}>Logo URL</Body2>
              <Input
                value={editSettings.site_logo_url}
                onChange={(_, d) =>
                  setEditSettings((s) => s && { ...s, site_logo_url: d.value })
                }
                disabled={!canManage}
                placeholder="https://example.com/logo.png"
              />
              {editSettings.site_logo_url && (
                <img
                  src={editSettings.site_logo_url}
                  alt="Logo preview"
                  style={{
                    maxWidth: 120,
                    maxHeight: 40,
                    marginTop: 4,
                    objectFit: "contain",
                  }}
                />
              )}
            </div>

            <div className={styles.field}>
              <Body2 className={styles.fieldLabel}>Accent Color</Body2>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Input
                  value={editSettings.accent_color}
                  onChange={(_, d) =>
                    setEditSettings((s) => s && { ...s, accent_color: d.value })
                  }
                  disabled={!canManage}
                  placeholder="#0078d4"
                  style={{ width: 140 }}
                />
                {editSettings.accent_color && (
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 4,
                      backgroundColor: editSettings.accent_color,
                      border: `1px solid ${tokens.colorNeutralStroke1}`,
                    }}
                  />
                )}
              </div>
            </div>

            <Divider style={{ margin: "16px 0" }} />

            <Title3 className={styles.sectionTitle}>Defaults</Title3>

            <div className={styles.field}>
              <Body2 className={styles.fieldLabel}>Default Set Name</Body2>
              <Input
                value={editSettings.default_set_name}
                onChange={(_, d) =>
                  setEditSettings(
                    (s) => s && { ...s, default_set_name: d.value },
                  )
                }
                disabled={!canManage}
                placeholder="Not Grouped"
              />
            </div>

            <div className={styles.field}>
              <Body2 className={styles.fieldLabel}>Welcome Message</Body2>
              <Input
                value={editSettings.welcome_message}
                onChange={(_, d) =>
                  setEditSettings(
                    (s) => s && { ...s, welcome_message: d.value },
                  )
                }
                disabled={!canManage}
                placeholder="Welcome to our team workspace!"
              />
            </div>

            {canManage && (
              <div className={styles.saveBar}>
                <Button
                  appearance="primary"
                  icon={<Save24Regular />}
                  onClick={saveSettings}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            )}
          </div>
        )}

        {activeTab === "permissions" && permsData && (
          <div className={styles.section}>
            <Title3 className={styles.sectionTitle}>Permission Rules</Title3>

            {!canManagePerms && (
              <Body1
                style={{
                  color: tokens.colorNeutralForeground4,
                  marginBottom: 16,
                }}
              >
                You can view permissions but cannot edit them.
              </Body1>
            )}

            <div className={styles.scopeSelector}>
              <Body2 className={styles.fieldLabel}>Scope:</Body2>
              <Select
                value={permScope}
                onChange={(_, d) => setPermScope(d.value)}
                style={{ minWidth: 200 }}
              >
                <option value="global">Global (team-wide)</option>
                {sets.map((s) => (
                  <option key={s.id} value={s.id}>
                    Set: {s.name}
                  </option>
                ))}
              </Select>
              {permScope !== "global" && (
                <Body1 style={{ color: tokens.colorNeutralForeground4 }}>
                  Per-set overrides take priority over global rules.
                </Body1>
              )}
            </div>

            <Subtitle2 style={{ marginBottom: 8 }}>
              Owner always has full access (not shown).
            </Subtitle2>

            <table className={styles.permTable}>
              <thead>
                <tr>
                  <th className={styles.permTh}>Permission</th>
                  <th className={styles.permTh}>Admin</th>
                  <th className={styles.permTh}>Member</th>
                </tr>
              </thead>
              <tbody>
                {(permsData.keys as string[]).map((key) => {
                  const info = PERM_LABELS[key] ?? {
                    label: key,
                    description: "",
                  };
                  return (
                    <tr key={key}>
                      <td className={styles.permTd}>
                        <Tooltip
                          content={info.description}
                          relationship="description"
                        >
                          <span>
                            <Body2>{info.label}</Body2>
                            <br />
                            <span className={styles.permKey}>{key}</span>
                          </span>
                        </Tooltip>
                      </td>
                      <td className={styles.permTd}>
                        <Switch
                          checked={editPerms.admin?.[key] ?? false}
                          onChange={() => togglePerm("admin", key)}
                          disabled={
                            !canManagePerms ||
                            (key === "manage_permissions" &&
                              permsData.role !== "owner")
                          }
                        />
                      </td>
                      <td className={styles.permTd}>
                        <Switch
                          checked={editPerms.member?.[key] ?? false}
                          onChange={() => togglePerm("member", key)}
                          disabled={
                            !canManagePerms ||
                            (key === "manage_permissions" &&
                              permsData.role !== "owner")
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {canManagePerms && (
              <div className={styles.saveBar} style={{ marginTop: 16 }}>
                <Button
                  appearance="primary"
                  icon={<Save24Regular />}
                  onClick={savePermissions}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Permissions"}
                </Button>
                <Button
                  appearance="secondary"
                  icon={<ArrowReset24Regular />}
                  onClick={resetPermissions}
                  disabled={saving}
                >
                  Reset to Defaults
                </Button>
              </div>
            )}
          </div>
        )}

        {activeTab === "appconfig" && canManage && editAppConfig && (
          <div className={styles.section}>
            <Title3 className={styles.sectionTitle}>Prism OAuth</Title3>

            <div className={styles.field}>
              <Body2 className={styles.fieldLabel}>Prism Base URL</Body2>
              <Input
                value={editAppConfig.prism_base_url}
                onChange={(_, d) =>
                  setEditAppConfig(
                    (c) => c && { ...c, prism_base_url: d.value },
                  )
                }
                placeholder="https://prism.siiway.org"
              />
            </div>

            <div className={styles.field}>
              <Body2 className={styles.fieldLabel}>Client ID</Body2>
              <Input
                value={editAppConfig.prism_client_id}
                onChange={(_, d) =>
                  setEditAppConfig(
                    (c) => c && { ...c, prism_client_id: d.value },
                  )
                }
                placeholder="prism_xxxxx"
              />
            </div>

            <div className={styles.field}>
              <Switch
                label="Use PKCE (public client)"
                checked={editAppConfig.use_pkce}
                onChange={(_, d) =>
                  setEditAppConfig((c) => c && { ...c, use_pkce: d.checked })
                }
              />
              <Body1
                style={{ fontSize: 12, color: tokens.colorNeutralForeground4 }}
              >
                Enable for public clients (no secret). Disable for confidential
                clients.
              </Body1>
            </div>

            {!editAppConfig.use_pkce && (
              <div className={styles.field}>
                <Body2 className={styles.fieldLabel}>Client Secret</Body2>
                <Input
                  value={editAppConfig.prism_client_secret}
                  onChange={(_, d) =>
                    setEditAppConfig(
                      (c) => c && { ...c, prism_client_secret: d.value },
                    )
                  }
                  placeholder="your-client-secret"
                  type="password"
                />
              </div>
            )}

            <div className={styles.field}>
              <Body2 className={styles.fieldLabel}>Redirect URI</Body2>
              <Input
                value={editAppConfig.prism_redirect_uri}
                onChange={(_, d) =>
                  setEditAppConfig(
                    (c) => c && { ...c, prism_redirect_uri: d.value },
                  )
                }
                placeholder={`${window.location.origin}/callback`}
              />
            </div>

            <Divider style={{ margin: "16px 0" }} />

            <Title3 className={styles.sectionTitle}>Access Control</Title3>

            <div className={styles.field}>
              <Body2 className={styles.fieldLabel}>Allowed Team ID</Body2>
              <Input
                value={editAppConfig.allowed_team_id}
                onChange={(_, d) =>
                  setEditAppConfig(
                    (c) => c && { ...c, allowed_team_id: d.value },
                  )
                }
                placeholder="Leave empty to allow all teams"
              />
              <Body1
                style={{ fontSize: 12, color: tokens.colorNeutralForeground4 }}
              >
                If set, only members of this Prism team can sign in.
              </Body1>
            </div>

            <div className={styles.saveBar}>
              <Button
                appearance="primary"
                icon={<Save24Regular />}
                onClick={saveAppConfig}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save App Config"}
              </Button>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
