import { useMemo, useRef, useState } from "react";
import {
  Button,
  Checkbox,
  Dropdown,
  Option,
  Input,
  Body1,
  Body2,
  Caption1,
  Link,
  ProgressBar,
  Spinner,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import {
  Dismiss24Regular,
  ArrowUpload24Regular,
  CheckmarkCircle20Filled,
  ErrorCircle20Filled,
} from "@fluentui/react-icons";
import { useI18n } from "../i18n";
import type { TodoSet } from "../types";
import type { MarkdownChecklistTodo } from "../../shared/markdownChecklist";

const MS_TODO_EXPORT_URL = "https://ms-todo-export.azurewebsites.net/";
const MS_TODO_SOURCE_URL = "https://github.com/alan-null/ms-todo-export";

const useStyles = makeStyles({
  intro: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginBottom: "12px",
  },
  uploadRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },
  warning: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    padding: "8px 10px",
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorStatusWarningBackground1,
    color: tokens.colorStatusWarningForeground1,
    marginTop: "12px",
    fontSize: "13px",
  },
  errorText: {
    color: tokens.colorPaletteRedForeground1,
    marginTop: "8px",
  },
  lists: {
    marginTop: "12px",
    maxHeight: "320px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  listItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
    padding: "8px 10px",
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  listItemDisabled: {
    opacity: 0.55,
  },
  listName: {
    fontWeight: 600,
    wordBreak: "break-word",
  },
  listCount: {
    color: tokens.colorNeutralForeground3,
  },
  listControls: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
    flex: 1,
    minWidth: 0,
    justifyContent: "flex-end",
  },
  grow: {
    flex: 1,
    minWidth: 0,
  },
  statusIcon: {
    display: "flex",
    alignItems: "center",
  },
  progress: {
    marginTop: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  footerNote: {
    color: tokens.colorNeutralForeground3,
    fontSize: "12px",
  },
});

type TransferTodo = MarkdownChecklistTodo;

type MsTodoChecklistItem = {
  displayName?: string;
  isChecked?: boolean;
};

type MsTodoTask = {
  title?: string;
  status?: string;
  body?: { content?: string; contentType?: string };
  checklistItems?: MsTodoChecklistItem[];
  hasAttachments?: boolean;
  attachments?: unknown[];
  linkedResources?: unknown[];
};

type MsTodoList = {
  displayName?: string;
  wellknownListName?: string;
  tasks?: MsTodoTask[];
};

type ParsedList = {
  key: string;
  name: string;
  todoCount: number;
  todos: TransferTodo[];
  unsupportedCount: number;
};

type ListConfig = {
  selected: boolean;
  append: boolean;
  targetName: string;
  targetSetId: string;
  insertAt: "top" | "bottom";
};

type ListStatus = "pending" | "importing" | "done" | "error";

function taskHasUnsupported(task: MsTodoTask): boolean {
  return Boolean(
    task.hasAttachments ||
    (Array.isArray(task.attachments) && task.attachments.length > 0) ||
    (Array.isArray(task.linkedResources) && task.linkedResources.length > 0),
  );
}

function mapTask(task: MsTodoTask): TransferTodo {
  const title = (task.title ?? "").trim() || "(untitled)";
  const node: TransferTodo = {
    title,
    completed: task.status === "completed",
  };

  // Microsoft To Do "notes" (the task body) become a single comment.
  const body = task.body?.content?.trim();
  if (body) {
    node.comments = [body];
  }

  const children = (task.checklistItems ?? [])
    .map((item) => {
      const childTitle = (item.displayName ?? "").trim();
      if (!childTitle) return null;
      return {
        title: childTitle,
        completed: Boolean(item.isChecked),
      } as TransferTodo;
    })
    .filter((c): c is TransferTodo => c !== null);
  if (children.length > 0) {
    node.children = children;
  }

  return node;
}

function parseMsTodoBackup(raw: unknown): ParsedList[] {
  if (!Array.isArray(raw)) {
    throw new Error("not an array");
  }
  const lists = raw as MsTodoList[];
  return lists.map((list, index) => {
    const tasks = Array.isArray(list.tasks) ? list.tasks : [];
    let unsupportedCount = 0;
    for (const task of tasks) {
      if (taskHasUnsupported(task)) unsupportedCount++;
    }
    return {
      key: `${index}`,
      name: (list.displayName ?? "").trim() || `List ${index + 1}`,
      todoCount: tasks.length,
      todos: tasks.map(mapTask),
      unsupportedCount,
    };
  });
}

type Props = {
  open: boolean;
  onClose: () => void;
  teamId: string;
  sets: TodoSet[];
  onImported: (set: TodoSet) => void;
};

export function ImportMsTodoDialog({
  open,
  onClose,
  teamId,
  sets,
  onImported,
}: Props) {
  const styles = useStyles();
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [parsedLists, setParsedLists] = useState<ParsedList[]>([]);
  const [configs, setConfigs] = useState<Record<string, ListConfig>>({});
  const [fileError, setFileError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    name: string;
  } | null>(null);
  const [statuses, setStatuses] = useState<
    Record<string, { status: ListStatus; error?: string }>
  >({});

  const reset = () => {
    setParsedLists([]);
    setConfigs({});
    setFileError(null);
    setImporting(false);
    setProgress(null);
    setStatuses({});
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => {
    if (importing) return;
    reset();
    onClose();
  };

  const handleFile = async (file: File) => {
    setFileError(null);
    setStatuses({});
    setProgress(null);
    try {
      const text = await file.text();
      const lists = parseMsTodoBackup(JSON.parse(text));
      if (lists.length === 0) {
        setParsedLists([]);
        setConfigs({});
        setFileError(t.msTodoNoLists);
        return;
      }
      const nextConfigs: Record<string, ListConfig> = {};
      for (const list of lists) {
        nextConfigs[list.key] = {
          selected: true,
          append: false,
          targetName: list.name,
          targetSetId: sets[0]?.id ?? "",
          insertAt: "bottom",
        };
      }
      setParsedLists(lists);
      setConfigs(nextConfigs);
    } catch {
      setParsedLists([]);
      setConfigs({});
      setFileError(t.msTodoParseError);
    }
  };

  const updateConfig = (key: string, patch: Partial<ListConfig>) => {
    setConfigs((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const totalUnsupported = useMemo(
    () => parsedLists.reduce((sum, l) => sum + l.unsupportedCount, 0),
    [parsedLists],
  );

  const selectedLists = parsedLists.filter((l) => configs[l.key]?.selected);

  const importList = async (
    list: ParsedList,
    config: ListConfig,
  ): Promise<TodoSet | null> => {
    const content = JSON.stringify({
      version: 1,
      set: { name: list.name },
      todos: list.todos,
    });

    if (config.append) {
      const res = await fetch(
        `/api/teams/${teamId}/sets/${config.targetSetId}/import`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            format: "json",
            content,
            mode: "append",
            includeComments: true,
            insertAt: config.insertAt,
          }),
        },
      );
      if (!res.ok) {
        const data = await res
          .json()
          .catch(() => ({ error: t.transferImportFailed }));
        throw new Error(
          (data as { error?: string }).error || t.transferImportFailed,
        );
      }
      return null;
    }

    const res = await fetch(`/api/teams/${teamId}/sets/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        format: "json",
        content,
        includeComments: true,
        setName: config.targetName.trim() || list.name,
      }),
    });
    if (!res.ok) {
      const data = await res
        .json()
        .catch(() => ({ error: t.transferImportFailed }));
      throw new Error(
        (data as { error?: string }).error || t.transferImportFailed,
      );
    }
    const data = (await res.json()) as { set: TodoSet };
    return data.set;
  };

  const runImport = async () => {
    if (selectedLists.length === 0) return;
    setImporting(true);
    setStatuses({});

    let hadError = false;
    for (let i = 0; i < selectedLists.length; i++) {
      const list = selectedLists[i];
      const config = configs[list.key];
      setProgress({
        current: i + 1,
        total: selectedLists.length,
        name: list.name,
      });
      setStatuses((prev) => ({
        ...prev,
        [list.key]: { status: "importing" },
      }));
      try {
        const created = await importList(list, config);
        if (created) onImported(created);
        setStatuses((prev) => ({
          ...prev,
          [list.key]: { status: "done" },
        }));
      } catch (e) {
        hadError = true;
        setStatuses((prev) => ({
          ...prev,
          [list.key]: {
            status: "error",
            error: e instanceof Error ? e.message : t.transferImportFailed,
          },
        }));
      }
    }

    setImporting(false);
    setProgress(null);
    if (!hadError) {
      reset();
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && handleClose()}>
      <DialogSurface style={{ maxWidth: 720 }}>
        <DialogBody>
          <DialogTitle
            action={
              <Button
                appearance="subtle"
                icon={<Dismiss24Regular />}
                onClick={handleClose}
                disabled={importing}
              />
            }
          >
            {t.msTodoTitle}
          </DialogTitle>
          <DialogContent>
            <div className={styles.intro}>
              <Body1>
                {t.msTodoStep1}{" "}
                <Link
                  href={MS_TODO_EXPORT_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {MS_TODO_EXPORT_URL}
                </Link>
              </Body1>
              <Body2 style={{ color: tokens.colorNeutralForeground3 }}>
                {t.msTodoStep2}
              </Body2>
            </div>

            <div className={styles.uploadRow}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                }}
              />
              <Button
                appearance="secondary"
                icon={<ArrowUpload24Regular />}
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
              >
                {t.msTodoSelectFile}
              </Button>
              {parsedLists.length > 0 && (
                <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                  {t.msTodoListsFound.replace(
                    "{count}",
                    String(parsedLists.length),
                  )}
                </Caption1>
              )}
            </div>

            {fileError && <div className={styles.errorText}>{fileError}</div>}

            {totalUnsupported > 0 && (
              <div className={styles.warning}>
                <ErrorCircle20Filled />
                <span>
                  {t.msTodoUnsupportedWarning.replace(
                    "{count}",
                    String(totalUnsupported),
                  )}
                </span>
              </div>
            )}

            {parsedLists.length > 0 && (
              <div className={styles.lists}>
                {parsedLists.map((list) => {
                  const config = configs[list.key];
                  if (!config) return null;
                  const status = statuses[list.key];
                  return (
                    <div
                      key={list.key}
                      className={
                        config.selected
                          ? styles.listItem
                          : `${styles.listItem} ${styles.listItemDisabled}`
                      }
                    >
                      <Checkbox
                        checked={config.selected}
                        disabled={importing}
                        onChange={(_, d) =>
                          updateConfig(list.key, { selected: !!d.checked })
                        }
                      />
                      <span className={styles.listName}>{list.name}</span>
                      <Caption1 className={styles.listCount}>
                        {t.msTodoItemsCount.replace(
                          "{count}",
                          String(list.todoCount),
                        )}
                      </Caption1>

                      <div className={styles.listControls}>
                        <Checkbox
                          label={t.msTodoAppend}
                          checked={config.append}
                          disabled={
                            importing || !config.selected || sets.length === 0
                          }
                          onChange={(_, d) =>
                            updateConfig(list.key, { append: !!d.checked })
                          }
                        />
                        {config.append ? (
                          <>
                            <Dropdown
                              disabled={importing || !config.selected}
                              selectedOptions={
                                config.targetSetId ? [config.targetSetId] : []
                              }
                              value={
                                sets.find((s) => s.id === config.targetSetId)
                                  ?.name ?? ""
                              }
                              onOptionSelect={(_, d) =>
                                updateConfig(list.key, {
                                  targetSetId: d.optionValue ?? "",
                                })
                              }
                              style={{ minWidth: 140 }}
                            >
                              {sets.map((s) => (
                                <Option key={s.id} value={s.id} text={s.name}>
                                  {s.name}
                                </Option>
                              ))}
                            </Dropdown>
                            <Dropdown
                              disabled={importing || !config.selected}
                              selectedOptions={[config.insertAt]}
                              value={
                                config.insertAt === "top"
                                  ? t.transferInsertTop
                                  : t.transferInsertBottom
                              }
                              onOptionSelect={(_, d) =>
                                updateConfig(list.key, {
                                  insertAt:
                                    (d.optionValue as "top" | "bottom") ??
                                    "bottom",
                                })
                              }
                              style={{ minWidth: 120 }}
                            >
                              <Option value="top" text={t.transferInsertTop}>
                                {t.transferInsertTop}
                              </Option>
                              <Option
                                value="bottom"
                                text={t.transferInsertBottom}
                              >
                                {t.transferInsertBottom}
                              </Option>
                            </Dropdown>
                          </>
                        ) : (
                          <Input
                            className={styles.grow}
                            value={config.targetName}
                            disabled={importing || !config.selected}
                            placeholder={t.msTodoTargetName}
                            onChange={(_, d) =>
                              updateConfig(list.key, { targetName: d.value })
                            }
                            style={{ minWidth: 160 }}
                          />
                        )}
                        {status?.status === "done" && (
                          <span
                            className={styles.statusIcon}
                            style={{
                              color: tokens.colorPaletteGreenForeground1,
                            }}
                          >
                            <CheckmarkCircle20Filled />
                          </span>
                        )}
                        {status?.status === "importing" && (
                          <Spinner size="tiny" />
                        )}
                        {status?.status === "error" && (
                          <span
                            className={styles.statusIcon}
                            style={{ color: tokens.colorPaletteRedForeground1 }}
                            title={status.error}
                          >
                            <ErrorCircle20Filled />
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {progress && (
              <div className={styles.progress}>
                <ProgressBar
                  value={progress.current}
                  max={progress.total}
                  thickness="large"
                />
                <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                  {t.msTodoImporting
                    .replace("{current}", String(progress.current))
                    .replace("{total}", String(progress.total))
                    .replace("{name}", progress.name)}
                </Caption1>
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <Caption1 className={styles.footerNote}>
                {t.msTodoSourceNote}{" "}
                <Link
                  href={MS_TODO_SOURCE_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {MS_TODO_SOURCE_URL}
                </Link>
              </Caption1>
            </div>
          </DialogContent>
          <DialogActions>
            <Button
              appearance="secondary"
              onClick={handleClose}
              disabled={importing}
            >
              {t.close}
            </Button>
            <Button
              appearance="primary"
              onClick={runImport}
              disabled={importing || selectedLists.length === 0}
              icon={importing ? <Spinner size="tiny" /> : undefined}
            >
              {importing ? t.todoImporting : t.todoImport}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
