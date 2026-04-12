import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Checkbox,
  Switch,
  Select,
  Input,
  Textarea,
  Body2,
  Caption1,
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
import type { TodoSet } from "../types";
import {
  parseMarkdownChecklist,
  type MarkdownChecklistTodo,
} from "../../shared/markdownChecklist";

const useStyles = makeStyles({
  textarea: {
    width: "100%",
    "& textarea": {
      minHeight: "220px",
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
    maxHeight: "240px",
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

type TransferPayload = {
  version?: number;
  set?: { id?: string; name?: string };
  todos?: TransferTodo[];
};

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

  const walk = (list: TransferTodo[]) => {
    for (const node of list) {
      todoCount++;
      commentCount += node.comments?.length ?? 0;
      if (node.children?.length) walk(node.children);
    }
  };

  walk(nodes);
  return { todoCount, commentCount };
}

type Props = {
  open: boolean;
  onClose: () => void;
  teamId: string;
  onImported: (set: TodoSet) => void;
};

export function ImportSetDialog({
  open,
  onClose,
  teamId,
  onImported,
}: Props) {
  const styles = useStyles();
  const { t } = useI18n();

  const [format, setFormat] = useState<TransferFormat>("json");
  const [includeComments, setIncludeComments] = useState(false);
  const [content, setContent] = useState("");
  const [generatedSetId, setGeneratedSetId] = useState(crypto.randomUUID());
  const [setId, setSetId] = useState("");
  const [setName, setSetName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const id = crypto.randomUUID();
    setGeneratedSetId(id);
    if (format === "md") setSetId(id);
  }, [open, format]);

  const parsed = useMemo(() => {
    if (!content.trim()) {
      return {
        parseError: null as string | null,
        todos: [] as TransferTodo[],
        parsedSetId: "",
        parsedSetName: "",
      };
    }

    try {
      if (format === "md") {
        return {
          parseError: null as string | null,
          todos: parseMarkdownChecklist(content),
          parsedSetId: generatedSetId,
          parsedSetName: "",
        };
      }

      if (format === "json") {
        const payload = JSON.parse(content) as TransferPayload;
        return {
          parseError: null as string | null,
          todos: normalizeParsedTodos(payload),
          parsedSetId: payload.set?.id ?? "",
          parsedSetName: payload.set?.name ?? "",
        };
      }

      const payload = parseYaml(content) as TransferPayload;
      return {
        parseError: null as string | null,
        todos: normalizeParsedTodos(payload),
        parsedSetId: payload.set?.id ?? "",
        parsedSetName: payload.set?.name ?? "",
      };
    } catch {
      return {
        parseError: t.transferParseError,
        todos: [] as TransferTodo[],
        parsedSetId: "",
        parsedSetName: "",
      };
    }
  }, [content, format, generatedSetId, t.transferParseError]);

  useEffect(() => {
    if (format === "md") {
      setSetId(generatedSetId);
      return;
    }
    setSetId(parsed.parsedSetId || generatedSetId);
  }, [format, parsed.parsedSetId, generatedSetId]);

  useEffect(() => {
    if (format === "md") return;
    setSetName(parsed.parsedSetName || "");
  }, [format, parsed.parsedSetName]);

  const stats = useMemo(() => collectStats(parsed.todos), [parsed.todos]);

  const runImport = async () => {
    if (!content.trim()) return;
    if (!setName.trim()) {
      setError(t.transferSetNameRequired);
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const res = await fetch(`/api/teams/${teamId}/sets/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          content,
          includeComments,
          setId,
          setName,
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

      const data = (await res.json()) as { set: TodoSet };
      setContent("");
      onImported(data.set);
      onClose();
    } catch {
      setError(t.transferImportFailed);
    } finally {
      setBusy(false);
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
            {t.sidebarImportSet}
          </DialogTitle>
          <DialogContent>
            <div className={styles.row}>
              <Select
                value={format}
                onChange={(_, d) => setFormat(d.value as TransferFormat)}
              >
                <option value="json">JSON</option>
                <option value="yaml">YAML</option>
                <option value="md">Markdown</option>
              </Select>
              <Switch
                label={t.transferIncludeComments}
                checked={includeComments}
                onChange={(_, d) => setIncludeComments(d.checked)}
              />
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

            {parsed.parseError && (
              <div
                style={{
                  color: tokens.colorPaletteRedForeground1,
                  marginBottom: 8,
                }}
              >
                {parsed.parseError}
              </div>
            )}

            <Textarea
              className={styles.textarea}
              value={content}
              onChange={(_, d) => setContent(d.value)}
              placeholder={t.transferImportPlaceholder}
              disabled={busy}
            />

            <div className={styles.row} style={{ marginTop: 12 }}>
              <Input
                value={setId}
                onChange={(_, d) => setSetId(d.value)}
                disabled
                style={{ flex: 1, minWidth: 220 }}
                placeholder={t.transferSetId}
              />
              <Input
                value={setName}
                onChange={(_, d) => setSetName(d.value)}
                style={{ flex: 1, minWidth: 220 }}
                placeholder={t.transferSetName}
              />
            </div>

            <div className={styles.stats}>
              <span>{t.transferTodosCount.replace("{count}", String(stats.todoCount))}</span>
              <span>
                {t.transferCommentsCount.replace(
                  "{count}",
                  String(stats.commentCount),
                )}
              </span>
            </div>

            <div className={styles.preview}>
              {stats.todoCount > 0
                ? renderPreviewTodos(parsed.todos)
                : t.transferPreviewPlaceholder}
            </div>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onClose}>
              {t.close}
            </Button>
            <Button
              appearance="primary"
              onClick={runImport}
              disabled={
                busy ||
                !content.trim() ||
                !!parsed.parseError ||
                stats.todoCount === 0 ||
                !setName.trim() ||
                !setId.trim()
              }
            >
              {busy ? t.saving : t.todoImport}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
