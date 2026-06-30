import { useMemo, useState } from "react";
import {
  Button,
  Dropdown,
  Option,
  Body1,
  Spinner,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  tokens,
} from "@fluentui/react-components";
import { Dismiss24Regular } from "@fluentui/react-icons";
import { useI18n } from "../i18n";
import type { TodoSet } from "../types";

/** dataTransfer MIME type used when dragging a todo onto a set in the sidebar. */
export const TODO_DND_MIME = "application/x-glint-todo";

type Props = {
  open: boolean;
  onClose: () => void;
  sets: TodoSet[];
  currentSetId: string;
  todoTitle?: string;
  onMove: (
    targetSetId: string,
    insertAt: "top" | "bottom",
  ) => Promise<{ ok: boolean; error?: string }>;
};

export function MoveTodoDialog({
  open,
  onClose,
  sets,
  currentSetId,
  todoTitle,
  onMove,
}: Props) {
  const { t } = useI18n();

  // Prefer the first list that isn't the current one, but allow the current
  // list too (repositioning to its top/bottom is still useful).
  const defaultSetId = useMemo(
    () => sets.find((s) => s.id !== currentSetId)?.id ?? sets[0]?.id ?? "",
    [sets, currentSetId],
  );

  const [targetSetId, setTargetSetId] = useState(defaultSetId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prevOpen, setPrevOpen] = useState(open);

  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setTargetSetId(defaultSetId);
      setError(null);
      setBusy(false);
    }
  }

  const targetName = sets.find((s) => s.id === targetSetId)?.name ?? "";

  const run = async (insertAt: "top" | "bottom") => {
    if (!targetSetId || busy) return;
    setBusy(true);
    setError(null);
    const result = await onMove(targetSetId, insertAt);
    setBusy(false);
    if (result.ok) {
      onClose();
    } else {
      setError(result.error || t.moveFailed);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && !busy && onClose()}>
      <DialogSurface style={{ maxWidth: 460 }}>
        <DialogBody>
          <DialogTitle
            action={
              <Button
                appearance="subtle"
                icon={<Dismiss24Regular />}
                onClick={onClose}
                disabled={busy}
              />
            }
          >
            {t.moveTodoTitle}
          </DialogTitle>
          <DialogContent>
            {todoTitle && (
              <Body1
                style={{
                  display: "block",
                  marginBottom: 12,
                  color: tokens.colorNeutralForeground3,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {todoTitle}
              </Body1>
            )}
            <Dropdown
              disabled={busy || sets.length === 0}
              selectedOptions={targetSetId ? [targetSetId] : []}
              value={targetName}
              onOptionSelect={(_, d) => setTargetSetId(d.optionValue ?? "")}
              style={{ width: "100%" }}
              placeholder={t.moveTodoSelectList}
            >
              {sets.map((s) => (
                <Option key={s.id} value={s.id} text={s.name}>
                  {s.id === currentSetId
                    ? `${s.name} (${t.moveCurrentList})`
                    : s.name}
                </Option>
              ))}
            </Dropdown>

            {error && (
              <div
                style={{
                  color: tokens.colorPaletteRedForeground1,
                  marginTop: 8,
                }}
              >
                {error}
              </div>
            )}
          </DialogContent>
          <DialogActions>
            <Button
              appearance="primary"
              onClick={() => run("top")}
              disabled={busy || !targetSetId}
              icon={busy ? <Spinner size="tiny" /> : undefined}
            >
              {t.transferInsertTop}
            </Button>
            <Button
              appearance="primary"
              onClick={() => run("bottom")}
              disabled={busy || !targetSetId}
              icon={busy ? <Spinner size="tiny" /> : undefined}
            >
              {t.transferInsertBottom}
            </Button>
            <Button appearance="secondary" onClick={onClose} disabled={busy}>
              {t.cancel}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
