import { useMemo, useState } from "react";
import {
  Button,
  Checkbox,
  Switch,
  Select,
  Body2,
  Caption1,
  Textarea,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { Dismiss24Regular } from "@fluentui/react-icons";
import { parse as parseYaml } from "yaml";
import { useI18n } from "../i18n";
import {
  parseMarkdownChecklist,
  type MarkdownChecklistTodo,
} from "../../shared/markdownChecklist";

const useStyles = makeStyles({
  textarea: {
    width: "100%",
    "& textarea": {
      minHeight: "240px",
      fontFamily: "monospace",
      fontSize: "13px",
    },
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
    marginBottom: "12px",
  },
  stats: {
    display: "flex",
    gap: "12px",
    marginBottom: "8px",
    color: tokens.colorNeutralForeground3,
    fontSize: "12px",
  },
  preview: {
    marginTop: "8px",
    maxHeight: "260px",
    overflowY: "auto",
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: "8px 10px",
    backgroundColor: tokens.colorNeutralBackground2,
  },
  previewItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    padding: "6px 4px",
    borderRadius: tokens.borderRadiusSmall,
  },
  previewTitle: {
    lineHeight: "20px",
    wordBreak: "break-word",
  },
  previewCompleted: {
    textDecoration: "line-through",
    color: tokens.colorNeutralForeground3,
  },
  previewComments: {
    marginLeft: "28px",
    marginTop: "2px",
    marginBottom: "2px",
    color: tokens.colorNeutralForeground3,
  },
});

type TransferFormat = "md" | "json" | "yaml";

type TransferTodo = MarkdownChecklistTodo;

function normalizeParsedTodos(raw: unknown): TransferTodo[] {
  if (Array.isArray(raw)) return raw as TransferTodo[];
  if (
    raw &&
    typeof raw === "object" &&
    Array.isArray((raw as { todos?: unknown }).todos)
  ) {
    return (raw as { todos: TransferTodo[] }).todos;
  }
  return [];
}

function collectStats(nodes: TransferTodo[]) {
  let todoCount = 0;
  let commentCount = 0;

  const walk = (list: TransferTodo[], depth: number) => {
    for (const node of list) {
      todoCount++;
      commentCount += node.comments?.length ?? 0;
      void depth;
      if (node.children?.length) walk(node.children, depth + 1);
    }
  };

  walk(nodes, 0);
  return { todoCount, commentCount };
}

type Props = {
  open: boolean;
  onClose: () => void;
  mode: "import" | "export";
  teamId: string;
  setId: string;
  setName?: string;
  onImported: () => void;
};

export function SetTransferDialog({
  open,
  onClose,
  mode,
  teamId,
  setId,
  setName,
  onImported,
}: Props) {
  const styles = useStyles();
  const { t } = useI18n();

  const [format, setFormat] = useState<TransferFormat>("md");
  const [includeComments, setIncludeComments] = useState(false);
  const [replaceSet, setReplaceSet] = useState(false);
  const [insertAt, setInsertAt] = useState<"top" | "bottom">("bottom");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const importPreview = useMemo(() => {
    if (mode !== "import")
      return { parseError: null as string | null, todos: [] as TransferTodo[] };
    if (!content.trim())
      return { parseError: null as string | null, todos: [] as TransferTodo[] };
    try {
      if (format === "md") {
        return {
          parseError: null as string | null,
          todos: parseMarkdownChecklist(content),
        };
      }
      if (format === "json") {
        const parsed = JSON.parse(content) as unknown;
        return {
          parseError: null as string | null,
          todos: normalizeParsedTodos(parsed),
        };
      }
      const parsed = parseYaml(content) as unknown;
      return {
        parseError: null as string | null,
        todos: normalizeParsedTodos(parsed),
      };
    } catch {
      return {
        parseError: t.transferParseError,
        todos: [] as TransferTodo[],
      };
    }
  }, [mode, format, content, t.transferParseError]);

  const stats = useMemo(
    () => collectStats(importPreview.todos),
    [importPreview.todos],
  );

  const loadExport = async () => {
    if (!teamId || !setId) return;

    setBusy(true);
    setCopied(false);
    setError(null);
    try {
      const res = await fetch(
        `/api/teams/${teamId}/sets/${setId}/export?format=${format}&includeComments=${includeComments ? "1" : "0"}`,
      );
      if (!res.ok) {
        setError(t.transferExportFailed);
        setBusy(false);
        return;
      }
      const data: { content: string } = await res.json();
      setContent(data.content);
    } catch {
      setError(t.transferExportFailed);
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    if (!content.trim() || !teamId || !setId) return;
    setBusy(true);
    setCopied(false);
    setError(null);
    try {
      const res = await fetch(`/api/teams/${teamId}/sets/${setId}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          content,
          includeComments,
          insertAt,
          mode: replaceSet ? "replace" : "append",
        }),
      });
      if (!res.ok) {
        const data = await res
          .json()
          .catch(() => ({ error: t.transferImportFailed }));
        setError((data as { error?: string }).error || t.transferImportFailed);
        setBusy(false);
        return;
      }
      setContent("");
      onImported();
      onClose();
    } catch {
      setError(t.transferImportFailed);
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${setName || "set"}.${format === "yaml" ? "yaml" : format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyExport = async () => {
    if (!content.trim()) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setError(t.transferCopyFailed);
    }
  };

  const renderPreviewTodos = (nodes: TransferTodo[], depth = 0) => {
    return nodes.map((node, index) => (
      <div key={`${depth}-${index}-${node.title}`}>
        <div
          className={styles.previewItem}
          style={{ paddingLeft: `${depth * 18 + 4}px` }}
        >
          <Checkbox checked={node.completed} disabled />
          <Body2
            className={
              node.completed
                ? `${styles.previewTitle} ${styles.previewCompleted}`
                : styles.previewTitle
            }
          >
            {node.title}
          </Body2>
          {node.claimedByName && (
            <Caption1
              style={{
                color: "var(--colorPaletteGreenForeground1)",
                whiteSpace: "nowrap",
              }}
            >
              ↩ {node.claimedByName}
            </Caption1>
          )}
        </div>
        {(node.comments ?? []).map((comment, ci) => (
          <Caption1
            key={`${depth}-${index}-c-${ci}`}
            className={styles.previewComments}
            style={{ paddingLeft: `${depth * 18 + 6}px` }}
          >
            {`> ${comment}`}
          </Caption1>
        ))}
        {node.children?.length
          ? renderPreviewTodos(node.children, depth + 1)
          : null}
      </div>
    ));
  };

  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface style={{ maxWidth: 700 }}>
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
            {mode === "import" ? t.transferImportTitle : t.transferExportTitle}
          </DialogTitle>
          <DialogContent>
            <div className={styles.row}>
              <Select
                value={format}
                onChange={(_, d) => setFormat(d.value as TransferFormat)}
              >
                <option value="md">Markdown</option>
                <option value="json">JSON</option>
                <option value="yaml">YAML</option>
              </Select>
              <Switch
                label={t.transferIncludeComments}
                checked={includeComments}
                onChange={(_, d) => setIncludeComments(d.checked)}
              />
              {mode === "import" && (
                <Switch
                  label={t.transferReplaceExisting}
                  checked={replaceSet}
                  onChange={(_, d) => setReplaceSet(d.checked)}
                />
              )}
              {mode === "import" && !replaceSet && (
                <Select
                  value={insertAt}
                  onChange={(_, d) => setInsertAt(d.value as "top" | "bottom")}
                >
                  <option value="bottom">{t.transferInsertBottom}</option>
                  <option value="top">{t.transferInsertTop}</option>
                </Select>
              )}
            </div>

            {error && (
              <div
                style={{
                  color: tokens.colorPaletteRedForeground1,
                  marginBottom: 8,
                }}
              >
                {error}
              </div>
            )}

            {mode === "import" && (
              <>
                {importPreview.parseError && (
                  <div
                    style={{
                      color: tokens.colorPaletteRedForeground1,
                      marginBottom: 8,
                    }}
                  >
                    {importPreview.parseError}
                  </div>
                )}
                <div className={styles.stats}>
                  <span>
                    {t.transferTodosCount.replace(
                      "{count}",
                      String(stats.todoCount),
                    )}
                  </span>
                  <span>
                    {t.transferCommentsCount.replace(
                      "{count}",
                      String(stats.commentCount),
                    )}
                  </span>
                </div>
                <div className={styles.preview}>
                  {stats.todoCount > 0
                    ? renderPreviewTodos(importPreview.todos)
                    : t.transferPreviewPlaceholder}
                </div>
              </>
            )}

            <Textarea
              className={styles.textarea}
              value={content}
              onChange={(_, d) => setContent(d.value)}
              placeholder={
                mode === "import"
                  ? t.transferImportPlaceholder
                  : t.transferExportPlaceholder
              }
              disabled={busy}
            />
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onClose}>
              {t.close}
            </Button>
            {mode === "export" ? (
              <>
                <Button
                  appearance="secondary"
                  onClick={loadExport}
                  disabled={busy || !teamId || !setId}
                >
                  {busy ? t.saving : t.transferGenerate}
                </Button>
                <Button
                  appearance="secondary"
                  onClick={copyExport}
                  disabled={!content.trim()}
                >
                  {copied ? t.transferCopied : t.transferCopy}
                </Button>
                <Button
                  appearance="primary"
                  onClick={download}
                  disabled={!content.trim()}
                >
                  {t.transferDownload}
                </Button>
              </>
            ) : (
              <Button
                appearance="primary"
                onClick={runImport}
                disabled={
                  busy ||
                  !content.trim() ||
                  !!importPreview.parseError ||
                  stats.todoCount === 0
                }
              >
                {busy ? t.saving : t.todoImport}
              </Button>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
