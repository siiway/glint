import { useState, useRef } from "react";
import {
  Input,
  Button,
  Body1,
  Body2,
  Title3,
  Spinner,
  Avatar,
  Badge,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  Select,
  Switch,
  Tooltip,
  OverlayDrawer,
  DrawerHeader,
  DrawerHeaderTitle,
  DrawerBody,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Caption1,
  makeStyles,
  tokens,
  mergeClasses,
} from "@fluentui/react-components";
import {
  Add24Regular,
  Delete24Regular,
  SignOut24Regular,
  Edit24Regular,
  Dismiss24Regular,
  Folder24Regular,
  MoreVertical24Regular,
  Settings24Regular,
  Link24Regular,
} from "@fluentui/react-icons";
import type { TodoSet } from "../types";
import { ROLE_COLORS } from "../types";
import type { TeamInfo } from "../auth";
import { Footer } from "./Footer";
import { useI18n } from "../i18n";
import { LocalLanguage24Regular } from "@fluentui/react-icons";
import { ManageLinksDialog } from "./ManageLinksDialog";

const useStyles = makeStyles({
  sidebar: {
    width: "260px",
    minWidth: "260px",
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
  },
  sidebarHeader: {
    padding: "16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  sidebarContent: {
    flex: 1,
    overflowY: "auto",
    padding: "8px",
  },
  sidebarFooter: {
    padding: "12px 16px",
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  setItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 12px",
    borderRadius: tokens.borderRadiusMedium,
    cursor: "pointer",
    userSelect: "none" as const,
    "&:hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  setItemActive: {
    backgroundColor: tokens.colorNeutralBackground1Selected,
    fontWeight: "600",
  },
  setItemDragging: {
    opacity: "0.5",
  },
  setItemDragOver: {
    borderBottom: `2px solid ${tokens.colorBrandForeground1}`,
  },
  setName: {
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  addSetRow: {
    display: "flex",
    gap: "4px",
    padding: "4px 8px",
  },
  teamSelect: {
    minWidth: "180px",
  },
  teamSelectMobile: {
    minWidth: "0",
    flex: 1,
  },
  empty: {
    textAlign: "center" as const,
    padding: "48px 0",
    color: tokens.colorNeutralForeground4,
  },
  drawerSets: {
    flex: 1,
    overflowY: "auto",
    padding: "8px",
  },
  drawerFooter: {
    padding: "12px 16px",
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
});

type Props = {
  isMobile: boolean;
  drawerOpen: boolean;
  onDrawerChange: (open: boolean) => void;
  teams: TeamInfo[];
  selectedTeamId: string;
  onTeamChange: (id: string) => void;
  sets: TodoSet[];
  selectedSetId: string;
  onSetSelect: (id: string) => void;
  loadingSets: boolean;
  siteName: string;
  siteLogo: string;
  canManageSettings: boolean;
  canManageSets: boolean;
  onOpenSettings: () => void;
  onAddSet: (name: string) => Promise<void>;
  onDeleteSet: (id: string) => void;
  onRenameSet: (id: string, name: string) => void;
  onUpdateSet: (id: string, patch: Partial<TodoSet>) => void;
  onReorderSets: (items: { id: string; sortOrder: number }[]) => void;
  defaultTimezone: string;
  user: { displayName?: string; username: string; avatarUrl?: string } | null;
  onLogout: () => void;
};

export function Sidebar({
  isMobile,
  drawerOpen,
  onDrawerChange,
  teams,
  selectedTeamId,
  onTeamChange,
  sets,
  selectedSetId,
  onSetSelect,
  loadingSets,
  siteName,
  siteLogo,
  canManageSettings,
  canManageSets,
  onOpenSettings,
  onAddSet,
  onDeleteSet,
  onRenameSet,
  onUpdateSet,
  onReorderSets,
  defaultTimezone,
  user,
  onLogout,
}: Props) {
  const styles = useStyles();
  const { t, locale, setLocale } = useI18n();
  const canDrag = !isMobile;

  const [newSetName, setNewSetName] = useState("");
  const [addingSet, setAddingSet] = useState(false);
  const [showAddSet, setShowAddSet] = useState(false);
  const [renameSetId, setRenameSetId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Set settings dialog
  const [settingsSetId, setSettingsSetId] = useState<string | null>(null);
  const settingsSet = settingsSetId
    ? sets.find((s) => s.id === settingsSetId)
    : null;

  // Manage links dialog
  const [linksSetId, setLinksSetId] = useState<string | null>(null);

  // Drag state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragCounter = useRef(0);

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
  const handleDrop = (dropIndex: number) => {
    dragCounter.current = 0;
    setDragOverIndex(null);
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      return;
    }
    const reordered = [...sets];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, moved);
    onReorderSets(reordered.map((s, i) => ({ id: s.id, sortOrder: i + 1 })));
    setDragIndex(null);
  };
  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
    dragCounter.current = 0;
  };

  const handleAddSet = async () => {
    if (!newSetName.trim() || addingSet) return;
    setAddingSet(true);
    await onAddSet(newSetName.trim());
    setNewSetName("");
    setShowAddSet(false);
    setAddingSet(false);
  };

  const selectedTeam = teams.find((t) => t.id === selectedTeamId);

  function renderSetsList() {
    return (
      <>
        {sets.map((s, i) => (
          <div
            key={s.id}
            className={mergeClasses(
              styles.setItem,
              selectedSetId === s.id && styles.setItemActive,
              canDrag && dragIndex === i && styles.setItemDragging,
              canDrag &&
                dragOverIndex === i &&
                dragIndex !== i &&
                styles.setItemDragOver,
            )}
            onClick={() => {
              onSetSelect(s.id);
              if (isMobile) onDrawerChange(false);
            }}
            draggable={canDrag}
            onDragStart={canDrag ? () => handleDragStart(i) : undefined}
            onDragEnter={canDrag ? () => handleDragEnter(i) : undefined}
            onDragLeave={canDrag ? handleDragLeave : undefined}
            onDragOver={canDrag ? handleDragOver : undefined}
            onDrop={canDrag ? () => handleDrop(i) : undefined}
            onDragEnd={canDrag ? handleDragEnd : undefined}
          >
            <Folder24Regular />
            <span className={styles.setName}>{s.name}</span>
            <Menu>
              <MenuTrigger disableButtonEnhancement>
                <Button
                  appearance="transparent"
                  size="small"
                  icon={<MoreVertical24Regular />}
                  onClick={(e) => e.stopPropagation()}
                />
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  <MenuItem
                    icon={<Edit24Regular />}
                    onClick={() => {
                      setRenameSetId(s.id);
                      setRenameValue(s.name);
                    }}
                  >
                    {t.rename}
                  </MenuItem>
                  <MenuItem
                    icon={<Settings24Regular />}
                    onClick={() => setSettingsSetId(s.id)}
                  >
                    {t.sidebarSetSettings}
                  </MenuItem>
                  <MenuItem
                    icon={<Link24Regular />}
                    onClick={() => setLinksSetId(s.id)}
                  >
                    {t.shareManageLinks}
                  </MenuItem>
                  <MenuItem
                    icon={<Delete24Regular />}
                    onClick={() => onDeleteSet(s.id)}
                  >
                    {t.delete}
                  </MenuItem>
                </MenuList>
              </MenuPopover>
            </Menu>
          </div>
        ))}

        {showAddSet ? (
          <div className={styles.addSetRow}>
            <Input
              size="small"
              placeholder={t.sidebarSetPlaceholder}
              value={newSetName}
              onChange={(_, d) => setNewSetName(d.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddSet();
                if (e.key === "Escape") setShowAddSet(false);
              }}
              autoFocus
              style={{ flex: 1 }}
            />
            <Button
              appearance="primary"
              size="small"
              icon={<Add24Regular />}
              onClick={handleAddSet}
              disabled={!newSetName.trim() || addingSet}
            />
          </div>
        ) : (
          <Button
            appearance="transparent"
            icon={<Add24Regular />}
            onClick={() => setShowAddSet(true)}
            style={{ width: "100%", justifyContent: "flex-start" }}
          >
            {t.sidebarNewSet}
          </Button>
        )}
      </>
    );
  }

  function renderUserFooter() {
    return (
      <>
        <div className={isMobile ? styles.drawerFooter : styles.sidebarFooter}>
          <Avatar
            name={user?.displayName || user?.username}
            image={user?.avatarUrl ? { src: user.avatarUrl } : undefined}
            size={24}
          />
          <Body2
            style={{
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {user?.displayName || user?.username}
          </Body2>
          {selectedTeam && (
            <Badge
              appearance="filled"
              size="small"
              color={ROLE_COLORS[selectedTeam.role]}
            >
              {selectedTeam.role}
            </Badge>
          )}
          <Tooltip
            content={locale === "en" ? "中文" : "English"}
            relationship="label"
          >
            <Button
              appearance="transparent"
              size="small"
              icon={<LocalLanguage24Regular />}
              onClick={() => setLocale(locale === "en" ? "zh" : "en")}
            />
          </Tooltip>
          <Tooltip content={t.signOut} relationship="label">
            <Button
              appearance="transparent"
              size="small"
              icon={<SignOut24Regular />}
              onClick={onLogout}
            />
          </Tooltip>
        </div>
        <Footer />
      </>
    );
  }

  function renderTeamSelector(className?: string) {
    if (teams.length <= 1) return null;
    return (
      <Select
        className={className ?? styles.teamSelect}
        size="small"
        value={selectedTeamId}
        onChange={(_, d) => onTeamChange(d.value)}
      >
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </Select>
    );
  }

  const renameDialog = (
    <Dialog
      open={renameSetId !== null}
      onOpenChange={(_, d) => {
        if (!d.open) setRenameSetId(null);
      }}
    >
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{t.sidebarRenameSet}</DialogTitle>
          <DialogContent>
            <Input
              value={renameValue}
              onChange={(_, d) => setRenameValue(d.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && renameValue.trim() && renameSetId) {
                  onRenameSet(renameSetId, renameValue.trim());
                  setRenameSetId(null);
                }
              }}
              placeholder={t.sidebarSetPlaceholder}
              autoFocus
              style={{ width: "100%" }}
            />
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="secondary">{t.cancel}</Button>
            </DialogTrigger>
            <Button
              appearance="primary"
              disabled={!renameValue.trim()}
              onClick={() => {
                if (renameSetId && renameValue.trim()) {
                  onRenameSet(renameSetId, renameValue.trim());
                  setRenameSetId(null);
                }
              }}
            >
              {t.rename}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );

  const setSettingsDialog = (
    <Dialog
      open={settingsSetId !== null}
      onOpenChange={(_, d) => {
        if (!d.open) setSettingsSetId(null);
      }}
    >
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{t.sidebarSetSettings}</DialogTitle>
          <DialogContent>
            {settingsSet && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                <div>
                  <Switch
                    label={t.setAutoRenew}
                    checked={settingsSet.autoRenew}
                    onChange={(_, d) =>
                      onUpdateSet(settingsSet.id, { autoRenew: d.checked })
                    }
                  />
                  <Caption1
                    style={{
                      color: tokens.colorNeutralForeground4,
                      display: "block",
                      marginTop: 4,
                    }}
                  >
                    {t.setAutoRenewHint}
                  </Caption1>
                </div>

                {settingsSet.autoRenew && (
                  <div>
                    <Body1 style={{ fontWeight: 600, marginBottom: 4 }}>
                      {t.setRenewTime}
                    </Body1>
                    <Input
                      type="time"
                      value={settingsSet.renewTime}
                      onChange={(_, d) =>
                        onUpdateSet(settingsSet.id, { renewTime: d.value })
                      }
                      style={{ width: 140 }}
                    />
                  </div>
                )}

                <div>
                  <Body1 style={{ fontWeight: 600, marginBottom: 4 }}>
                    {t.setTimezone}
                  </Body1>
                  <Input
                    value={settingsSet.timezone}
                    onChange={(_, d) =>
                      onUpdateSet(settingsSet.id, { timezone: d.value })
                    }
                    placeholder={defaultTimezone || "UTC"}
                  />
                  <Caption1
                    style={{
                      color: tokens.colorNeutralForeground4,
                      display: "block",
                      marginTop: 4,
                    }}
                  >
                    {t.setTimezoneHint}
                  </Caption1>
                </div>

                {settingsSet.lastRenewedAt && (
                  <div>
                    <Body1 style={{ fontWeight: 600, marginBottom: 4 }}>
                      {t.setLastRenewed}
                    </Body1>
                    <Body2>
                      {new Date(settingsSet.lastRenewedAt).toLocaleString()}
                    </Body2>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="secondary">{t.close}</Button>
            </DialogTrigger>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );

  const linksDialog = linksSetId ? (
    <ManageLinksDialog
      open
      onClose={() => setLinksSetId(null)}
      teamId={selectedTeamId}
      setId={linksSetId}
      setName={sets.find((s) => s.id === linksSetId)?.name ?? ""}
      canManage={canManageSets}
    />
  ) : null;

  if (isMobile) {
    return (
      <>
        <OverlayDrawer
          open={drawerOpen}
          onOpenChange={(_, d) => onDrawerChange(d.open)}
          position="start"
        >
          <DrawerHeader>
            <DrawerHeaderTitle
              action={
                <span style={{ display: "flex", gap: 4 }}>
                  {canManageSettings && (
                    <Button
                      appearance="subtle"
                      size="small"
                      icon={<Settings24Regular />}
                      onClick={() => {
                        onDrawerChange(false);
                        onOpenSettings();
                      }}
                    />
                  )}
                  <Button
                    appearance="subtle"
                    icon={<Dismiss24Regular />}
                    onClick={() => onDrawerChange(false)}
                  />
                </span>
              }
            >
              {siteLogo ? (
                <img
                  src={siteLogo}
                  alt={siteName}
                  style={{ maxHeight: 24, objectFit: "contain" }}
                />
              ) : (
                siteName
              )}
            </DrawerHeaderTitle>
          </DrawerHeader>
          <DrawerBody
            style={{
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              padding: 0,
            }}
          >
            {teams.length > 1 && (
              <div style={{ padding: "8px 16px" }}>
                {renderTeamSelector(styles.teamSelectMobile)}
              </div>
            )}
            <div className={styles.drawerSets}>
              {loadingSets ? (
                <div className={styles.empty}>
                  <Spinner size="small" />
                </div>
              ) : (
                renderSetsList()
              )}
            </div>
            {renderUserFooter()}
          </DrawerBody>
        </OverlayDrawer>
        {renameDialog}
        {setSettingsDialog}
        {linksDialog}
      </>
    );
  }

  return (
    <>
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          {siteLogo ? (
            <img
              src={siteLogo}
              alt={siteName}
              style={{ maxHeight: 28, objectFit: "contain" }}
            />
          ) : (
            <Title3>{siteName}</Title3>
          )}
          {canManageSettings && (
            <Tooltip content={t.sidebarSettings} relationship="label">
              <Button
                appearance="transparent"
                size="small"
                icon={<Settings24Regular />}
                onClick={onOpenSettings}
              />
            </Tooltip>
          )}
          {renderTeamSelector()}
        </div>
        <div className={styles.sidebarContent}>
          {loadingSets ? (
            <div className={styles.empty}>
              <Spinner size="small" />
            </div>
          ) : (
            renderSetsList()
          )}
        </div>
        {renderUserFooter()}
      </div>
      {renameDialog}
      {setSettingsDialog}
      {linksDialog}
    </>
  );
}
