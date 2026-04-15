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
  Delete24Regular,
  Copy24Regular,
} from "@fluentui/react-icons";
import { Footer } from "./Footer";
import { useI18n } from "../i18n";
import type { ShareLink } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";

// ─── Types ───────────────────────────────────────────────────────────────────

type AppConfig = {
  prism_base_url: string;
  prism_client_id: string;
  prism_client_secret: string;
  prism_redirect_uri: string;
  use_pkce: boolean;
  allowed_team_id: string;
  session_ttl: number;
  allowed_team_id_from_env: boolean;
};

type TeamSettings = {
  site_name: string;
  site_logo_url: string;
  accent_color: string;
  welcome_message: string;
  default_set_name: string;
  allow_member_create_sets: boolean;
  default_timezone: string;
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

// ─── Component ───────────────────────────────────────────────────────────────

export function SettingsPage({
  teamId,
  onBack,
}: {
  teamId: string;
  onBack: () => void;
}) {
  const styles = useStyles();
  const { t } = useI18n();

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
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [deletingLinkId, setDeletingLinkId] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);


  const canManage =
    permsData?.role === "owner" || permsData?.role === "co-owner" || false;
  const canManagePerms =
    permsData?.role === "owner" ||
    permsData?.role === "co-owner" ||
    (permsData?.global?.[(permsData?.role as string) ?? ""]
      ?.manage_permissions ??
      false);

  // Fetch all data
  const fetchData = useCallback(async () => {
    setLoading(true);
    const [settingsRes, permsRes, setsRes, configRes, linksRes] =
      await Promise.all([
        fetch(`/api/teams/${teamId}/settings`),
        fetch(`/api/teams/${teamId}/permissions`),
        fetch(`/api/teams/${teamId}/sets`),
        fetch("/api/init/config"),
        fetch(`/api/teams/${teamId}/share-links`),
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
    if (linksRes.ok) {
      const data = (await linksRes.json()) as { links: ShareLink[] };
      setShareLinks(data.links);
    }
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchData();
    });
  }, [fetchData]);

  // When scope changes, load the right perms
  useEffect(() => {
    if (!permsData) return;
    queueMicrotask(() => {
      if (permScope === "global") {
        setEditPerms(permsData.global);
        return;
      }
      const setId = permScope;
      const overrides = permsData.sets[setId] ?? {};
      // Merge defaults with overrides
      const merged: Record<string, Record<string, boolean>> = {
        admin: { ...permsData.global.admin, ...overrides.admin },
        member: { ...permsData.global.member, ...overrides.member },
      };
      setEditPerms(merged);
    });
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
          <Spinner size="large" label={t.settingsLoadingSettings} />
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
        <Title2>{t.settingsTitle}</Title2>
      </div>

      <div className={styles.content}>
        <TabList
          selectedValue={activeTab}
          onTabSelect={(_, d) => setActiveTab(d.value as string)}
          style={{ marginBottom: 24 }}
        >
          <Tab value="branding">{t.settingsTabBranding}</Tab>
          <Tab value="permissions">{t.settingsTabPermissions}</Tab>
          <Tab value="sharelinks">{t.settingsTabShareLinks}</Tab>
          {canManage && <Tab value="appconfig">{t.settingsTabAppConfig}</Tab>}
        </TabList>

        {activeTab === "branding" && editSettings && (
          <div className={styles.section}>
            <Title3 className={styles.sectionTitle}>
              {t.brandingSiteTitle}
            </Title3>

            <div className={styles.field}>
              <Body2 className={styles.fieldLabel}>{t.brandingSiteName}</Body2>
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
              <Body2 className={styles.fieldLabel}>{t.brandingLogoUrl}</Body2>
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
              <Body2 className={styles.fieldLabel}>
                {t.brandingAccentColor}
              </Body2>
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

            <Title3 className={styles.sectionTitle}>
              {t.brandingDefaults}
            </Title3>

            <div className={styles.field}>
              <Body2 className={styles.fieldLabel}>
                {t.brandingDefaultSetName}
              </Body2>
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
              <Body2 className={styles.fieldLabel}>
                {t.brandingWelcomeMessage}
              </Body2>
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

            <div className={styles.field}>
              <Body2 className={styles.fieldLabel}>
                {t.settingsDefaultTimezone}
              </Body2>
              <Input
                value={editSettings.default_timezone}
                onChange={(_, d) =>
                  setEditSettings(
                    (s) => s && { ...s, default_timezone: d.value },
                  )
                }
                disabled={!canManage}
                placeholder="UTC"
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
                  {saving ? t.saving : t.brandingSaveSettings}
                </Button>
              </div>
            )}
          </div>
        )}

        {activeTab === "permissions" && permsData && (
          <div className={styles.section}>
            <Title3 className={styles.sectionTitle}>
              {t.permissionsTitle}
            </Title3>

            {!canManagePerms && (
              <Body1
                style={{
                  color: tokens.colorNeutralForeground4,
                  marginBottom: 16,
                }}
              >
                {t.permissionsViewOnly}
              </Body1>
            )}

            <div className={styles.scopeSelector}>
              <Body2 className={styles.fieldLabel}>{t.permissionsScope}</Body2>
              <Select
                value={permScope}
                onChange={(_, d) => setPermScope(d.value)}
                style={{ minWidth: 200 }}
              >
                <option value="global">{t.permissionsScopeGlobal}</option>
                {sets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {t.permissionsScopeSet.replace("{name}", s.name)}
                  </option>
                ))}
              </Select>
              {permScope !== "global" && (
                <Body1 style={{ color: tokens.colorNeutralForeground4 }}>
                  {t.permissionsSetOverrideHint}
                </Body1>
              )}
            </div>

            <Subtitle2 style={{ marginBottom: 8 }}>
              {t.permissionsOwnerNote}
            </Subtitle2>

            <table className={styles.permTable}>
              <thead>
                <tr>
                  <th className={styles.permTh}>
                    {t.permissionsHeaderPermission}
                  </th>
                  <th className={styles.permTh}>
                    {t.permissionsHeaderCoOwner}
                  </th>
                  <th className={styles.permTh}>{t.permissionsHeaderAdmin}</th>
                  <th className={styles.permTh}>{t.permissionsHeaderMember}</th>
                </tr>
              </thead>
              <tbody>
                {(permsData.keys as string[]).map((key) => {
                  const permLabel =
                    (t as Record<string, string>)[`permLabel_${key}`] ?? key;
                  const permDesc =
                    (t as Record<string, string>)[`permDesc_${key}`] ?? "";
                  return (
                    <tr key={key}>
                      <td className={styles.permTd}>
                        <Tooltip content={permDesc} relationship="description">
                          <span>
                            <Body2>{permLabel}</Body2>
                            <br />
                            <span className={styles.permKey}>{key}</span>
                          </span>
                        </Tooltip>
                      </td>
                      <td className={styles.permTd}>
                        <Switch
                          checked={editPerms["co-owner"]?.[key] ?? false}
                          onChange={() => togglePerm("co-owner", key)}
                          disabled={
                            !canManagePerms ||
                            (key === "manage_permissions" &&
                              permsData.role !== "owner" &&
                              permsData.role !== "co-owner")
                          }
                        />
                      </td>
                      <td className={styles.permTd}>
                        <Switch
                          checked={editPerms.admin?.[key] ?? false}
                          onChange={() => togglePerm("admin", key)}
                          disabled={
                            !canManagePerms ||
                            (key === "manage_permissions" &&
                              permsData.role !== "owner" &&
                              permsData.role !== "co-owner")
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
                              permsData.role !== "owner" &&
                              permsData.role !== "co-owner")
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
                  {saving ? t.saving : t.permissionsSave}
                </Button>
                <Button
                  appearance="secondary"
                  icon={<ArrowReset24Regular />}
                  onClick={() => setShowResetConfirm(true)}
                  disabled={saving}
                >
                  {t.permissionsReset}
                </Button>
              </div>
            )}
          </div>
        )}

        {activeTab === "sharelinks" && (
          <div className={styles.section}>
            <Title3 className={styles.sectionTitle}>
              {t.settingsShareLinksTitle}
            </Title3>
            <Body1
              style={{
                color: tokens.colorNeutralForeground4,
                marginBottom: 16,
              }}
            >
              {t.settingsShareLinksDesc}
            </Body1>

            {shareLinks.length === 0 ? (
              <Body1 style={{ color: tokens.colorNeutralForeground4 }}>
                {t.linksEmpty}
              </Body1>
            ) : (
              <table className={styles.permTable}>
                <thead>
                  <tr>
                    <th className={styles.permTh}>{t.settingsShareLinksSet}</th>
                    <th className={styles.permTh}>
                      {t.settingsShareLinksName}
                    </th>
                    <th className={styles.permTh}>
                      {t.settingsShareLinksPermissions}
                    </th>
                    <th className={styles.permTh} style={{ width: 80 }}>
                      {t.linksAllowedEmails}
                    </th>
                    <th className={styles.permTh} style={{ width: 100 }} />
                  </tr>
                </thead>
                <tbody>
                  {shareLinks.map((link) => {
                    const permList = [
                      link.canView && t.linksPermView,
                      link.canCreate && t.linksPermCreate,
                      link.canEdit && t.linksPermEdit,
                      link.canComplete && t.linksPermComplete,
                      link.canDelete && t.linksPermDelete,
                      link.canComment && t.linksPermComment,
                      link.canReorder && t.linksPermReorder,
                    ].filter(Boolean);

                    return (
                      <tr key={link.id}>
                        <td className={styles.permTd}>
                          <Body2>{link.setName ?? "—"}</Body2>
                        </td>
                        <td className={styles.permTd}>
                          <Body2>{link.name || "—"}</Body2>
                        </td>
                        <td className={styles.permTd}>
                          <span className={styles.permKey}>
                            {permList.join(", ") || "—"}
                          </span>
                        </td>
                        <td className={styles.permTd}>
                          <Body2>
                            {link.allowedEmails
                              ? t.settingsShareLinksRestricted
                              : t.settingsShareLinksPublic}
                          </Body2>
                        </td>
                        <td className={styles.permTd}>
                          <div style={{ display: "flex", gap: 4 }}>
                            <Tooltip
                              content={t.shareCopyLink}
                              relationship="label"
                            >
                              <Button
                                appearance="transparent"
                                size="small"
                                icon={<Copy24Regular />}
                                onClick={() => {
                                  navigator.clipboard.writeText(
                                    `${window.location.origin}/shared/${link.token}`,
                                  );
                                  setCopiedToken(link.token);
                                  setTimeout(() => setCopiedToken(null), 2000);
                                }}
                              >
                                {copiedToken === link.token
                                  ? t.shareCopied
                                  : undefined}
                              </Button>
                            </Tooltip>
                            {canManage && (
                              <Button
                                appearance="transparent"
                                size="small"
                                icon={<Delete24Regular />}
                                onClick={() => setDeletingLinkId(link.id)}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === "appconfig" && canManage && editAppConfig && (
          <div className={styles.section}>
            <Title3 className={styles.sectionTitle}>
              {t.appConfigPrismOAuth}
            </Title3>

            <div className={styles.field}>
              <Body2 className={styles.fieldLabel}>
                {t.appConfigPrismBaseUrl}
              </Body2>
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
              <Body2 className={styles.fieldLabel}>{t.appConfigClientId}</Body2>
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
                label={t.appConfigUsePkce}
                checked={editAppConfig.use_pkce}
                onChange={(_, d) =>
                  setEditAppConfig((c) => c && { ...c, use_pkce: d.checked })
                }
              />
              <Body1
                style={{ fontSize: 12, color: tokens.colorNeutralForeground4 }}
              >
                {t.appConfigUsePkceHint}
              </Body1>
            </div>

            {!editAppConfig.use_pkce && (
              <div className={styles.field}>
                <Body2 className={styles.fieldLabel}>
                  {t.appConfigClientSecret}
                </Body2>
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
              <Body2 className={styles.fieldLabel}>
                {t.appConfigRedirectUri}
              </Body2>
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

            <Title3 className={styles.sectionTitle}>
              {t.appConfigAccessControl}
            </Title3>

            <div className={styles.field}>
              <Body2 className={styles.fieldLabel}>
                {t.appConfigAllowedTeamId}
              </Body2>
              <Input
                value={editAppConfig.allowed_team_id}
                onChange={(_, d) =>
                  setEditAppConfig(
                    (c) => c && { ...c, allowed_team_id: d.value },
                  )
                }
                placeholder={t.initAllowedTeamIdPlaceholder}
                disabled={editAppConfig.allowed_team_id_from_env}
              />
              <Body1
                style={{ fontSize: 12, color: tokens.colorNeutralForeground4 }}
              >
                {editAppConfig.allowed_team_id_from_env
                  ? t.appConfigAllowedTeamIdEnvHint
                  : t.appConfigAllowedTeamIdHint}
              </Body1>
            </div>

            <Divider style={{ margin: "16px 0" }} />

            <Title3 className={styles.sectionTitle}>
              {t.appConfigSessionTtl}
            </Title3>

            <div className={styles.field}>
              <Body2 className={styles.fieldLabel}>
                {t.appConfigSessionTtl}
              </Body2>
              <Input
                type="number"
                value={String(editAppConfig.session_ttl ?? 0)}
                onChange={(_, d) =>
                  setEditAppConfig(
                    (c) =>
                      c && {
                        ...c,
                        session_ttl: Math.max(0, parseInt(d.value) || 0),
                      },
                  )
                }
                placeholder="0"
                min="0"
              />
              <Body1
                style={{ fontSize: 12, color: tokens.colorNeutralForeground4 }}
              >
                {t.appConfigSessionTtlHint}
              </Body1>
            </div>

            <div className={styles.saveBar}>
              <Button
                appearance="primary"
                icon={<Save24Regular />}
                onClick={saveAppConfig}
                disabled={saving}
              >
                {saving ? t.saving : t.appConfigSave}
              </Button>
            </div>
          </div>
        )}
      </div>
      <Footer />
      <ConfirmDialog
        open={deletingLinkId !== null}
        message={t.linksDeleteConfirm}
        onConfirm={async () => {
          if (!deletingLinkId) return;
          await fetch(`/api/teams/${teamId}/share-links/${deletingLinkId}`, {
            method: "DELETE",
          });
          setShareLinks((prev) => prev.filter((l) => l.id !== deletingLinkId));
          setDeletingLinkId(null);
        }}
        onCancel={() => setDeletingLinkId(null)}
      />
      <ConfirmDialog
        open={showResetConfirm}
        message={t.confirmResetPermissions}
        confirmLabel={t.permissionsReset}
        onConfirm={() => {
          setShowResetConfirm(false);
          resetPermissions();
        }}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  );
}
