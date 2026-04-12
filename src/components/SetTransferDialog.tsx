import { useMemo, useState } from "react";
import {
  Button,
  Switch,
  Select,
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
    maxHeight: "180px",
    overflowY: "auto",
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: "8px 10px",
    backgroundColor: tokens.colorNeutralBackground2,
    fontFamily: "monospace",
    fontSize: "12px",
    whiteSpace: "pre-wrap",
  },
});

type TransferFormat = "md" | "json" | "yaml";

type TransferTodo = {
  title: string;
  completed: boolean;
  comments?: string[];
  children?: TransferTodo[];
};

function parseMarkdownChecklist(md: string): TransferTodo[] {
  const lines = md.split("\n");
  const roots: TransferTodo[] = [];
  const stack: Array<{ indent: number; node: TransferTodo }> = [];

  for (const raw of lines) {
    const item = raw.match(/^(\s*)[-*]\s+\[([xX ])]\s+(.+)$/);
    if (item) {
      const [, spaces, check, title] = item;
      const node: TransferTodo = {
        title: title.trim(),
        completed: check.toLowerCase() === "x",
      };
      const indent = spaces.length;
      while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }
      const parent = stack[stack.length - 1]?.node;
      if (parent) {
        parent.children ??= [];
        parent.children.push(node);
      } else {
        roots.push(node);
      }
      stack.push({ indent, node });
      continue;
    }

    const comment = raw.match(/^\s*>\s?(.*)$/);
    if (comment && stack.length > 0) {
      const current = stack[stack.length - 1].node;
      current.comments ??= [];
      current.comments.push(comment[1]);
    }
  }

  return roots;
}

function normalizeParsedTodos(raw: unknown): TransferTodo[] {
  if (Array.isArray(raw)) return raw as TransferTodo[];
  if (raw && typeof raw === "object" && Array.isArray((raw as { todos?: unknown }).todos)) {
    return (raw as { todos: TransferTodo[] }).todos;
  }
  return [];
}

function collectStats(nodes: TransferTodo[]) {
  let todoCount = 0;
  let commentCount = 0;
  const lines: string[] = [];

  const walk = (list: TransferTodo[], depth: number) => {
    for (const node of list) {
      todoCount++;
      commentCount += node.comments?.length ?? 0;
      lines.push(`${"  ".repeat(depth)}- [${node.completed ? "x" : " "}] ${node.title}`);
      if (node.comments?.length) {
        for (const c of node.comments) {
          lines.push(`${"  ".repeat(depth + 1)}> ${c}`);
        }
      }
      if (node.children?.length) walk(node.children, depth + 1);
    }
  };

  walk(nodes, 0);
  return { todoCount, commentCount, previewLines: lines.slice(0, 200) };
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
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const importPreview = useMemo(() => {
    if (mode !== "import") return { parseError: null as string | null, todos: [] as TransferTodo[] };
    if (!content.trim()) return { parseError: null as string | null, todos: [] as TransferTodo[] };
    try {
      if (format === "md") {
        return { parseError: null as string | null, todos: parseMarkdownChecklist(content) };
      }
      if (format === "json") {
        const parsed = JSON.parse(content) as unknown;
        return { parseError: null as string | null, todos: normalizeParsedTodos(parsed) };
      }
      const parsed = parseYaml(content) as unknown;
      return { parseError: null as string | null, todos: normalizeParsedTodos(parsed) };
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
    setBusy(true);
    setCopied(false);
    setError(null);
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
    setBusy(false);
  };

  const runImport = async () => {
    if (!content.trim()) return;
    setBusy(true);
    setCopied(false);
    setError(null);
    const res = await fetch(`/api/teams/${teamId}/sets/${setId}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        format,
        content,
        includeComments,
        mode: replaceSet ? "replace" : "append",
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: t.transferImportFailed }));
      setError((data as { error?: string }).error || t.transferImportFailed);
      setBusy(false);
      return;
    }
    setBusy(false);
    setContent("");
    onImported();
    onClose();
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
            </div>

            {error && (
              <div style={{ color: tokens.colorPaletteRedForeground1, marginBottom: 8 }}>
                {error}
              </div>
            )}

            {mode === "import" && (
              <>
                {importPreview.parseError && (
                  <div style={{ color: tokens.colorPaletteRedForeground1, marginBottom: 8 }}>
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
                  {stats.previewLines.length > 0
                    ? stats.previewLines.join("\n")
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
                <Button appearance="secondary" onClick={loadExport} disabled={busy}>
                  {busy ? t.saving : t.transferGenerate}
                </Button>
                <Button
                  appearance="secondary"
                  onClick={copyExport}
                  disabled={!content.trim()}
                >
                  {copied ? t.transferCopied : t.transferCopy}
                </Button>
                <Button appearance="primary" onClick={download} disabled={!content.trim()}>
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


