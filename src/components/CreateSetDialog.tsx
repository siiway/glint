import { useEffect, useState } from "react";
import {
  Button,
  Input,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@fluentui/react-components";
import { Dismiss24Regular } from "@fluentui/react-icons";
import { useI18n } from "../i18n";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
};

export function CreateSetDialog({ open, onClose, onCreate }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setBusy(false);
  }, [open]);

  const handleCreate = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    await onCreate(name.trim());
    setBusy(false);
    setName("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
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
            {t.sidebarNewSet}
          </DialogTitle>
          <DialogContent>
            <Input
              value={name}
              onChange={(_, d) => setName(d.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") onClose();
              }}
              placeholder={t.sidebarSetPlaceholder}
              autoFocus
              style={{ width: "100%" }}
              disabled={busy}
            />
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onClose}>
              {t.cancel}
            </Button>
            <Button
              appearance="primary"
              disabled={!name.trim() || busy}
              onClick={handleCreate}
            >
              {busy ? t.saving : t.sidebarNewSet}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
