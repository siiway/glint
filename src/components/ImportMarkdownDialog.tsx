import { useState } from "react";
import {
  Button,
  Body1,
  Caption1,
  Spinner,
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
import { useI18n } from "../i18n";

const useStyles = makeStyles({
  textarea: {
    width: "100%",
    "& textarea": {
      minHeight: "200px",
      fontFamily: "monospace",
      fontSize: "13px",
    },
  },
  preview: {
    maxHeight: "200px",
    overflowY: "auto",
    padding: "8px 12px",
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    fontSize: "13px",
    fontFamily: "monospace",
    whiteSpace: "pre",
  },
});

type ParsedItem = {
  title: string;
  completed: boolean;
  indent: number;
};

function parseMarkdownChecklist(md: string): ParsedItem[] {
  const lines = md.split("\n");
  const items: ParsedItem[] = [];

  for (const line of lines) {
    // Match lines like "  - [x] title" or "- [ ] title" or "* [x] title"
    const match = line.match(/^(\s*)[-*]\s+\[([xX ])\]\s+(.+)/);
    if (!match) continue;

    const [, spaces, check, title] = match;
    items.push({
      title: title.trim(),
      completed: check.toLowerCase() === "x",
      indent: spaces.length,
    });
  }

  return items;
}

type Props = {
  open: boolean;
  onClose: () => void;
  teamId: string;
  setId: string;
  onImported: () => void;
};

export function ImportMarkdownDialog({
  open,
  onClose,
  teamId,
  setId,
  onImported,
}: Props) {
  const styles = useStyles();
  const { t } = useI18n();

  const [markdown, setMarkdown] = useState("");
  const [importing, setImporting] = useState(false);

  const parsed = parseMarkdownChecklist(markdown);

  const handleImport = async () => {
    if (parsed.length === 0) return;
    setImporting(true);

    // Build tree structure from flat indent-based list.
    // We create items top-down so parents exist before children.
    // indentStack tracks: [indent, serverId] for ancestor resolution.
    const indentStack: { indent: number; id: string }[] = [];

    for (const item of parsed) {
      // Pop stack entries that are not ancestors of the current item
      while (
        indentStack.length > 0 &&
        indentStack[indentStack.length - 1].indent >= item.indent
      ) {
        indentStack.pop();
      }

      const parentId =
        indentStack.length > 0
          ? indentStack[indentStack.length - 1].id
          : undefined;

      const res = await fetch(`/api/teams/${teamId}/sets/${setId}/todos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: item.title,
          parentId,
        }),
      });

      if (!res.ok) continue;

      const data: { todo: { id: string } } = await res.json();

      // Mark as completed if checked
      if (item.completed) {
        await fetch(`/api/teams/${teamId}/todos/${data.todo.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed: true }),
        });
      }

      indentStack.push({ indent: item.indent, id: data.todo.id });
    }

    setImporting(false);
    setMarkdown("");
    onImported();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface style={{ maxWidth: 560 }}>
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
            {t.todoImportMarkdown}
          </DialogTitle>
          <DialogContent>
            <Body1
              style={{
                color: tokens.colorNeutralForeground4,
                marginBottom: 12,
              }}
            >
              {t.todoImportMarkdownDesc}
            </Body1>
            <Textarea
              className={styles.textarea}
              placeholder={t.todoImportMarkdownPlaceholder}
              value={markdown}
              onChange={(_, d) => setMarkdown(d.value)}
              disabled={importing}
            />
            {parsed.length > 0 && (
              <Caption1
                style={{
                  marginTop: 8,
                  color: tokens.colorNeutralForeground4,
                }}
              >
                {parsed.length} item(s)
              </Caption1>
            )}
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onClose}>
              {t.cancel}
            </Button>
            <Button
              appearance="primary"
              onClick={handleImport}
              disabled={parsed.length === 0 || importing}
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
