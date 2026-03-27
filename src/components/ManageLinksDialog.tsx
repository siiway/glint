import { useState, useEffect, useCallback } from "react";
import {
  Input,
  Button,
  Body1,
  Body2,
  Caption1,
  Spinner,
  Switch,
  Divider,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  Select,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import {
  Add24Regular,
  Delete24Regular,
  Copy24Regular,
  Dismiss24Regular,
  Link24Regular,
  Image24Regular,
  TaskListSquareLtr24Regular,
} from "@fluentui/react-icons";
import type { ShareLink } from "../types";
import { useI18n } from "../i18n";
import { ConfirmDialog } from "./ConfirmDialog";

const useStyles = makeStyles({
  content: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    maxHeight: "70vh",
    overflowY: "auto",
  },
  linkCard: {
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  linkHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
  },
  linkUrl: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 10px",
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    fontSize: "12px",
    fontFamily: "monospace",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  permRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    alignItems: "center",
  },
  permItem: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    minWidth: "100px",
  },
  fieldRow: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },
  fieldLabel: {
    minWidth: "100px",
    fontWeight: "600",
  },
  fieldInput: {
    flex: 1,
  },
  badgeSection: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "12px",
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
  },
  badgePreview: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "8px",
  },
  badgeRow: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  actions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
});

type Props = {
  open: boolean;
  onClose: () => void;
  teamId: string;
  setId: string;
  setName: string;
  canManage: boolean;
};

type PermPreset = "readonly" | "full" | "custom";

function getPreset(link: ShareLink): PermPreset {
  if (
    link.canView &&
    !link.canCreate &&
    !link.canEdit &&
    !link.canComplete &&
    !link.canDelete &&
    !link.canComment &&
    !link.canReorder
  )
    return "readonly";
  if (
    link.canView &&
    link.canCreate &&
    link.canEdit &&
    link.canComplete &&
    link.canDelete &&
    link.canComment &&
    link.canReorder
  )
    return "full";
  return "custom";
}

export function ManageLinksDialog({
  open,
  onClose,
  teamId,
  setId,
  setName,
  canManage,
}: Props) {
  const styles = useStyles();
  const { t } = useI18n();

  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [expandedEmbed, setExpandedEmbed] = useState<string | null>(null);
  const [deletingLinkId, setDeletingLinkId] = useState<string | null>(null);

  // Badge customization per link
  const [badgeOpts, setBadgeOpts] = useState<
    Record<
      string,
      {
        style: string;
        label: string;
        color: string;
        labelColor: string;
      }
    >
  >({});

  // Todo-list customization per link
  const [listOpts, setListOpts] = useState<
    Record<
      string,
      {
        theme: string;
        width: string;
        fontSize: string;
        maxItems: string;
        showProgress: boolean;
        bgColor: string;
        textColor: string;
        checkColor: string;
        borderColor: string;
        title: string;
      }
    >
  >({});

  const fetchLinks = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/teams/${teamId}/sets/${setId}/share-links`);
    if (res.ok) {
      const data: { links: ShareLink[] } = await res.json();
      setLinks(data.links);
    }
    setLoading(false);
  }, [teamId, setId]);

  useEffect(() => {
    if (open) fetchLinks();
  }, [open, fetchLinks]);

  const createLink = async () => {
    setSaving("new");
    const res = await fetch(`/api/teams/${teamId}/sets/${setId}/share-links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "", canView: true }),
    });
    if (res.ok) {
      const data: { link: ShareLink } = await res.json();
      setLinks((prev) => [...prev, data.link]);
    }
    setSaving(null);
  };

  const updateLink = async (linkId: string, updates: Partial<ShareLink>) => {
    setSaving(linkId);
    await fetch(`/api/teams/${teamId}/share-links/${linkId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    setLinks((prev) =>
      prev.map((l) => (l.id === linkId ? { ...l, ...updates } : l)),
    );
    setSaving(null);
  };

  const deleteLink = async (linkId: string) => {
    await fetch(`/api/teams/${teamId}/share-links/${linkId}`, {
      method: "DELETE",
    });
    setLinks((prev) => prev.filter((l) => l.id !== linkId));
    setDeletingLinkId(null);
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/shared/${token}`;
    navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  };

  const applyPreset = (link: ShareLink, preset: PermPreset) => {
    const perms =
      preset === "readonly"
        ? {
            canView: true,
            canCreate: false,
            canEdit: false,
            canComplete: false,
            canDelete: false,
            canComment: false,
            canReorder: false,
          }
        : preset === "full"
          ? {
              canView: true,
              canCreate: true,
              canEdit: true,
              canComplete: true,
              canDelete: true,
              canComment: true,
              canReorder: true,
            }
          : {};

    if (Object.keys(perms).length > 0) {
      updateLink(link.id, perms);
    }
  };

  const getBadgeUrl = (token: string) => {
    const opts = badgeOpts[token];
    const base = `${window.location.origin}/api/shared/${token}/badge.svg`;
    if (!opts) return base;
    const params = new URLSearchParams();
    if (opts.style && opts.style !== "flat") params.set("style", opts.style);
    if (opts.label) params.set("label", opts.label);
    if (opts.color) params.set("color", opts.color);
    if (opts.labelColor) params.set("labelColor", opts.labelColor);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  };

  const getBadgeMarkdown = (token: string) => {
    const imgUrl = getBadgeUrl(token);
    const linkUrl = `${window.location.origin}/shared/${token}`;
    return `[![${setName}](${imgUrl})](${linkUrl})`;
  };

  const getTodoListUrl = (token: string) => {
    const lo = listOpts[token];
    const base = `${window.location.origin}/api/shared/${token}/todo-list.svg`;
    if (!lo) return base;
    const params = new URLSearchParams();
    if (lo.theme && lo.theme !== "light") params.set("theme", lo.theme);
    if (lo.width) params.set("width", lo.width);
    if (lo.fontSize) params.set("fontSize", lo.fontSize);
    if (lo.maxItems) params.set("maxItems", lo.maxItems);
    if (!lo.showProgress) params.set("showProgress", "false");
    if (lo.bgColor) params.set("bgColor", lo.bgColor);
    if (lo.textColor) params.set("textColor", lo.textColor);
    if (lo.checkColor) params.set("checkColor", lo.checkColor);
    if (lo.borderColor) params.set("borderColor", lo.borderColor);
    if (lo.title) params.set("title", lo.title);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  };

  const getTodoListMarkdown = (token: string) => {
    const imgUrl = getTodoListUrl(token);
    const linkUrl = `${window.location.origin}/shared/${token}`;
    return `[![${setName}](${imgUrl})](${linkUrl})`;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(_, d) => !d.open && onClose()}>
        <DialogSurface style={{ maxWidth: 640 }}>
          <DialogBody>
            <DialogTitle
              action={
                <Button
                  appearance="subtle"
                  icon={<Dismiss24Regular />}
                  onClick={onClose}
                />
              }
            >
              {t.linksDialogTitle} — {setName}
            </DialogTitle>
            <DialogContent>
              <Body1
                style={{
                  color: tokens.colorNeutralForeground4,
                  marginBottom: 12,
                }}
              >
                {t.linksDialogDesc}
              </Body1>

              {loading ? (
                <Spinner size="small" />
              ) : (
                <div className={styles.content}>
                  {links.length === 0 && (
                    <Body1 style={{ color: tokens.colorNeutralForeground4 }}>
                      {t.linksEmpty}
                    </Body1>
                  )}

                  {links.map((link) => {
                    const preset = getPreset(link);
                    const isSaving = saving === link.id;
                    const opts = badgeOpts[link.token] ?? {
                      style: "flat",
                      label: "",
                      color: "",
                      labelColor: "",
                    };

                    return (
                      <div key={link.id} className={styles.linkCard}>
                        <div className={styles.linkHeader}>
                          <div style={{ flex: 1 }}>
                            <Input
                              size="small"
                              placeholder={t.linksLinkNamePlaceholder}
                              value={link.name}
                              onChange={(_, d) =>
                                setLinks((prev) =>
                                  prev.map((l) =>
                                    l.id === link.id
                                      ? { ...l, name: d.value }
                                      : l,
                                  ),
                                )
                              }
                              onBlur={() =>
                                updateLink(link.id, { name: link.name })
                              }
                              disabled={!canManage}
                              style={{ width: "100%" }}
                            />
                          </div>
                          {canManage && (
                            <Button
                              appearance="subtle"
                              size="small"
                              icon={<Delete24Regular />}
                              onClick={() => setDeletingLinkId(link.id)}
                            />
                          )}
                        </div>

                        <div className={styles.linkUrl}>
                          <Link24Regular
                            style={{ flexShrink: 0, fontSize: 16 }}
                          />
                          <span
                            style={{
                              flex: 1,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {window.location.origin}/shared/{link.token}
                          </span>
                          <Button
                            appearance="transparent"
                            size="small"
                            icon={<Copy24Regular />}
                            onClick={() => copyLink(link.token)}
                          >
                            {copied === link.token
                              ? t.shareCopied
                              : t.shareCopyLink}
                          </Button>
                        </div>

                        {/* Preset selector */}
                        {canManage && (
                          <>
                            <div className={styles.fieldRow}>
                              <Body2 className={styles.fieldLabel}>
                                {t.settingsShareLinksPermissions}
                              </Body2>
                              <Select
                                size="small"
                                value={preset}
                                onChange={(_, d) =>
                                  applyPreset(link, d.value as PermPreset)
                                }
                                style={{ minWidth: 140 }}
                              >
                                <option value="readonly">
                                  {t.linksReadOnly}
                                </option>
                                <option value="full">
                                  {t.linksFullAccess}
                                </option>
                                <option value="custom">{t.linksCustom}</option>
                              </Select>
                            </div>

                            {/* Individual permission toggles */}
                            <div className={styles.permRow}>
                              {(
                                [
                                  ["canView", t.linksPermView],
                                  ["canCreate", t.linksPermCreate],
                                  ["canEdit", t.linksPermEdit],
                                  ["canComplete", t.linksPermComplete],
                                  ["canDelete", t.linksPermDelete],
                                  ["canComment", t.linksPermComment],
                                  ["canReorder", t.linksPermReorder],
                                ] as const
                              ).map(([key, label]) => (
                                <div key={key} className={styles.permItem}>
                                  <Switch
                                    checked={link[key] as boolean}
                                    onChange={(_, d) =>
                                      updateLink(link.id, {
                                        [key]: d.checked,
                                      })
                                    }
                                    label={label}
                                    disabled={isSaving}
                                  />
                                </div>
                              ))}
                            </div>

                            {/* Email restrictions */}
                            <div className={styles.fieldRow}>
                              <Body2 className={styles.fieldLabel}>
                                {t.linksAllowedEmails}
                              </Body2>
                              <Input
                                size="small"
                                className={styles.fieldInput}
                                placeholder={t.linksAllowedEmailsPlaceholder}
                                value={link.allowedEmails}
                                onChange={(_, d) =>
                                  setLinks((prev) =>
                                    prev.map((l) =>
                                      l.id === link.id
                                        ? {
                                            ...l,
                                            allowedEmails: d.value,
                                          }
                                        : l,
                                    ),
                                  )
                                }
                                onBlur={() =>
                                  updateLink(link.id, {
                                    allowedEmails: link.allowedEmails,
                                  })
                                }
                              />
                            </div>
                            {link.allowedEmails && (
                              <Caption1
                                style={{
                                  color: tokens.colorNeutralForeground4,
                                }}
                              >
                                {t.settingsShareLinksRestricted}:{" "}
                                {
                                  link.allowedEmails.split(",").filter(Boolean)
                                    .length
                                }{" "}
                                email(s)
                              </Caption1>
                            )}
                          </>
                        )}

                        {!canManage && (
                          <div className={styles.permRow}>
                            <Caption1>
                              {preset === "readonly"
                                ? t.linksReadOnly
                                : preset === "full"
                                  ? t.linksFullAccess
                                  : t.linksCustom}
                            </Caption1>
                            {link.allowedEmails && (
                              <Caption1>
                                {" "}
                                ({t.settingsShareLinksRestricted})
                              </Caption1>
                            )}
                          </div>
                        )}

                        {/* Embed sections */}
                        <Divider />
                        <div
                          style={{ display: "flex", gap: 4, flexWrap: "wrap" }}
                        >
                          <Button
                            appearance={
                              expandedEmbed === `badge-${link.token}`
                                ? "outline"
                                : "subtle"
                            }
                            size="small"
                            icon={<Image24Regular />}
                            onClick={() =>
                              setExpandedEmbed(
                                expandedEmbed === `badge-${link.token}`
                                  ? null
                                  : `badge-${link.token}`,
                              )
                            }
                          >
                            {t.shareBadge}
                          </Button>
                          <Button
                            appearance={
                              expandedEmbed === `list-${link.token}`
                                ? "outline"
                                : "subtle"
                            }
                            size="small"
                            icon={<TaskListSquareLtr24Regular />}
                            onClick={() =>
                              setExpandedEmbed(
                                expandedEmbed === `list-${link.token}`
                                  ? null
                                  : `list-${link.token}`,
                              )
                            }
                          >
                            {t.shareTodoList}
                          </Button>
                        </div>

                        {/* Badge embed */}
                        {expandedEmbed === `badge-${link.token}` && (
                          <div className={styles.badgeSection}>
                            <Caption1>{t.shareBadgeDesc}</Caption1>
                            <div className={styles.badgePreview}>
                              <img
                                src={getBadgeUrl(link.token)}
                                alt="badge"
                                key={JSON.stringify(opts)}
                              />
                            </div>
                            <div className={styles.badgeRow}>
                              <Body2>{t.shareBadgeStyle}</Body2>
                              <Select
                                size="small"
                                value={opts.style}
                                onChange={(_, d) =>
                                  setBadgeOpts((p) => ({
                                    ...p,
                                    [link.token]: { ...opts, style: d.value },
                                  }))
                                }
                                style={{ width: 120 }}
                              >
                                <option value="flat">flat</option>
                                <option value="flat-square">flat-square</option>
                              </Select>
                            </div>
                            <div className={styles.badgeRow}>
                              <Body2>{t.shareBadgeLabel}</Body2>
                              <Input
                                size="small"
                                value={opts.label}
                                onChange={(_, d) =>
                                  setBadgeOpts((p) => ({
                                    ...p,
                                    [link.token]: { ...opts, label: d.value },
                                  }))
                                }
                                placeholder={setName}
                                style={{ width: 120 }}
                              />
                            </div>
                            <div className={styles.badgeRow}>
                              <Body2>{t.shareBadgeColor}</Body2>
                              <Input
                                size="small"
                                value={opts.color}
                                onChange={(_, d) =>
                                  setBadgeOpts((p) => ({
                                    ...p,
                                    [link.token]: { ...opts, color: d.value },
                                  }))
                                }
                                placeholder={t.shareBadgeAutoColor}
                                style={{ width: 120 }}
                              />
                            </div>
                            <div className={styles.badgeRow}>
                              <Body2>{t.shareBadgeLabelColor}</Body2>
                              <Input
                                size="small"
                                value={opts.labelColor}
                                onChange={(_, d) =>
                                  setBadgeOpts((p) => ({
                                    ...p,
                                    [link.token]: {
                                      ...opts,
                                      labelColor: d.value,
                                    },
                                  }))
                                }
                                placeholder="#555"
                                style={{ width: 120 }}
                              />
                            </div>
                            <div className={styles.actions}>
                              <Button
                                size="small"
                                icon={<Copy24Regular />}
                                onClick={() => {
                                  navigator.clipboard.writeText(
                                    getBadgeMarkdown(link.token),
                                  );
                                  setCopied(`bmd-${link.token}`);
                                  setTimeout(() => setCopied(null), 2000);
                                }}
                              >
                                {copied === `bmd-${link.token}`
                                  ? t.shareCopied
                                  : t.shareBadgeCopyMarkdown}
                              </Button>
                              <Button
                                size="small"
                                icon={<Copy24Regular />}
                                onClick={() => {
                                  navigator.clipboard.writeText(
                                    getBadgeUrl(link.token),
                                  );
                                  setCopied(`burl-${link.token}`);
                                  setTimeout(() => setCopied(null), 2000);
                                }}
                              >
                                {copied === `burl-${link.token}`
                                  ? t.shareCopied
                                  : t.shareBadgeCopyUrl}
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Todo List embed */}
                        {expandedEmbed === `list-${link.token}` &&
                          (() => {
                            const lo = listOpts[link.token] ?? {
                              theme: "light",
                              width: "",
                              fontSize: "",
                              maxItems: "",
                              showProgress: true,
                              bgColor: "",
                              textColor: "",
                              checkColor: "",
                              borderColor: "",
                              title: "",
                            };
                            const setLo = (patch: Partial<typeof lo>) =>
                              setListOpts((p) => ({
                                ...p,
                                [link.token]: { ...lo, ...patch },
                              }));
                            return (
                              <div className={styles.badgeSection}>
                                <Caption1>{t.shareTodoListDesc}</Caption1>
                                <div className={styles.badgePreview}>
                                  <img
                                    src={getTodoListUrl(link.token)}
                                    alt="todo list"
                                    key={JSON.stringify(lo)}
                                    style={{ maxWidth: "100%" }}
                                  />
                                </div>
                                <div className={styles.badgeRow}>
                                  <Body2>{t.shareTodoListTheme}</Body2>
                                  <Select
                                    size="small"
                                    value={lo.theme}
                                    onChange={(_, d) =>
                                      setLo({ theme: d.value })
                                    }
                                    style={{ width: 120 }}
                                  >
                                    <option value="light">Light</option>
                                    <option value="dark">Dark</option>
                                  </Select>
                                </div>
                                <div className={styles.badgeRow}>
                                  <Body2>{t.shareTodoListTitle}</Body2>
                                  <Input
                                    size="small"
                                    value={lo.title}
                                    onChange={(_, d) =>
                                      setLo({ title: d.value })
                                    }
                                    placeholder={setName}
                                    style={{ width: 140 }}
                                  />
                                </div>
                                <div className={styles.badgeRow}>
                                  <Body2>{t.shareTodoListWidth}</Body2>
                                  <Input
                                    size="small"
                                    value={lo.width}
                                    onChange={(_, d) =>
                                      setLo({ width: d.value })
                                    }
                                    placeholder="400"
                                    style={{ width: 80 }}
                                  />
                                  <Body2>{t.shareTodoListFontSize}</Body2>
                                  <Input
                                    size="small"
                                    value={lo.fontSize}
                                    onChange={(_, d) =>
                                      setLo({ fontSize: d.value })
                                    }
                                    placeholder="14"
                                    style={{ width: 60 }}
                                  />
                                  <Body2>{t.shareTodoListMaxItems}</Body2>
                                  <Input
                                    size="small"
                                    value={lo.maxItems}
                                    onChange={(_, d) =>
                                      setLo({ maxItems: d.value })
                                    }
                                    placeholder="50"
                                    style={{ width: 60 }}
                                  />
                                </div>
                                <div className={styles.badgeRow}>
                                  <Switch
                                    checked={lo.showProgress}
                                    onChange={(_, d) =>
                                      setLo({ showProgress: d.checked })
                                    }
                                    label={t.shareTodoListShowProgress}
                                  />
                                </div>
                                <div className={styles.badgeRow}>
                                  <Body2>{t.shareTodoListBgColor}</Body2>
                                  <Input
                                    size="small"
                                    value={lo.bgColor}
                                    onChange={(_, d) =>
                                      setLo({ bgColor: d.value })
                                    }
                                    placeholder="auto"
                                    style={{ width: 90 }}
                                  />
                                  <Body2>{t.shareTodoListTextColor}</Body2>
                                  <Input
                                    size="small"
                                    value={lo.textColor}
                                    onChange={(_, d) =>
                                      setLo({ textColor: d.value })
                                    }
                                    placeholder="auto"
                                    style={{ width: 90 }}
                                  />
                                </div>
                                <div className={styles.badgeRow}>
                                  <Body2>{t.shareTodoListCheckColor}</Body2>
                                  <Input
                                    size="small"
                                    value={lo.checkColor}
                                    onChange={(_, d) =>
                                      setLo({ checkColor: d.value })
                                    }
                                    placeholder="#1a7f37"
                                    style={{ width: 90 }}
                                  />
                                  <Body2>{t.shareTodoListBorderColor}</Body2>
                                  <Input
                                    size="small"
                                    value={lo.borderColor}
                                    onChange={(_, d) =>
                                      setLo({ borderColor: d.value })
                                    }
                                    placeholder="auto"
                                    style={{ width: 90 }}
                                  />
                                </div>
                                <div className={styles.actions}>
                                  <Button
                                    size="small"
                                    icon={<Copy24Regular />}
                                    onClick={() => {
                                      navigator.clipboard.writeText(
                                        getTodoListMarkdown(link.token),
                                      );
                                      setCopied(`lmd-${link.token}`);
                                      setTimeout(() => setCopied(null), 2000);
                                    }}
                                  >
                                    {copied === `lmd-${link.token}`
                                      ? t.shareCopied
                                      : t.shareBadgeCopyMarkdown}
                                  </Button>
                                  <Button
                                    size="small"
                                    icon={<Copy24Regular />}
                                    onClick={() => {
                                      navigator.clipboard.writeText(
                                        getTodoListUrl(link.token),
                                      );
                                      setCopied(`lurl-${link.token}`);
                                      setTimeout(() => setCopied(null), 2000);
                                    }}
                                  >
                                    {copied === `lurl-${link.token}`
                                      ? t.shareCopied
                                      : t.shareBadgeCopyUrl}
                                  </Button>
                                </div>
                              </div>
                            );
                          })()}
                      </div>
                    );
                  })}

                  {canManage && (
                    <Button
                      appearance="primary"
                      icon={<Add24Regular />}
                      onClick={createLink}
                      disabled={saving === "new"}
                    >
                      {t.linksCreateNew}
                    </Button>
                  )}
                </div>
              )}
            </DialogContent>
          </DialogBody>
        </DialogSurface>
      </Dialog>
      <ConfirmDialog
        open={deletingLinkId !== null}
        message={t.linksDeleteConfirm}
        onConfirm={() => deletingLinkId && deleteLink(deletingLinkId)}
        onCancel={() => setDeletingLinkId(null)}
      />
    </>
  );
}
