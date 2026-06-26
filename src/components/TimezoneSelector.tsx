import { useState, useMemo, useRef, useEffect } from "react";
import {
  Button,
  Input,
  Popover,
  PopoverTrigger,
  PopoverSurface,
  Caption1,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { ChevronDown20Regular } from "@fluentui/react-icons";
import { useI18n } from "../i18n";

const useStyles = makeStyles({
  trigger: {
    minWidth: "260px",
    maxWidth: "100%",
    justifyContent: "space-between",
    fontWeight: 400,
  },
  surface: {
    padding: "8px",
    width: "320px",
    maxHeight: "360px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  list: {
    flex: 1,
    overflowY: "auto",
    maxHeight: "280px",
  },
  item: {
    padding: "6px 10px",
    borderRadius: tokens.borderRadiusSmall,
    cursor: "pointer",
    fontSize: "13px",
    "&:hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  itemSelected: {
    backgroundColor: tokens.colorNeutralBackground1Selected,
    fontWeight: 600,
  },
});

type TzEntry = { id: string; offset: string };

function computeOffset(tz: string): string {
  try {
    const now = new Date();
    const tzStr = now.toLocaleString("en-US", { timeZone: tz });
    const utcStr = now.toLocaleString("en-US", { timeZone: "UTC" });
    const diff = new Date(tzStr).getTime() - new Date(utcStr).getTime();
    if (diff === 0) return "+0";
    const sign = diff > 0 ? "+" : "-";
    const abs = Math.abs(diff);
    const h = Math.floor(abs / 3600000);
    const m = Math.floor((abs % 3600000) / 60000);
    return m > 0 ? `${sign}${h}:${String(m).padStart(2, "0")}` : `${sign}${h}`;
  } catch {
    return "";
  }
}

function buildTzList(): TzEntry[] {
  const zones: string[] =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : [];
  return zones.map((tz) => ({ id: tz, offset: computeOffset(tz) }));
}

const ALL_TZ: TzEntry[] = buildTzList();

type Props = {
  value: string;
  onChange: (tz: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function TimezoneSelector({
  value,
  onChange,
  placeholder,
  disabled,
}: Props) {
  const styles = useStyles();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      queueMicrotask(() => inputRef.current?.focus());
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return ALL_TZ;
    return ALL_TZ.filter(
      (e) =>
        e.id.toLowerCase().includes(q) || e.offset.toLowerCase().includes(q),
    );
  }, [filter]);

  const display = value || placeholder || "UTC";

  return (
    <Popover
      open={open}
      onOpenChange={(_, d) => {
        setOpen(d.open);
        if (!d.open) setFilter("");
      }}
      positioning={{ autoSize: true }}
    >
      <PopoverTrigger disableButtonEnhancement>
        <Button
          appearance="outline"
          className={styles.trigger}
          icon={<ChevronDown20Regular />}
          iconPosition="after"
          disabled={disabled}
        >
          {display}
        </Button>
      </PopoverTrigger>
      <PopoverSurface className={styles.surface}>
        <Input
          ref={inputRef}
          size="small"
          placeholder={t.tzSearchPlaceholder}
          value={filter}
          onChange={(_, d) => setFilter(d.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        />
        <div className={styles.list}>
          {filtered.length === 0 && (
            <Caption1
              style={{
                padding: "8px",
                color: tokens.colorNeutralForeground4,
                display: "block",
              }}
            >
              {t.tzNoMatch}
            </Caption1>
          )}
          {filtered.map((entry) => (
            <div
              key={entry.id}
              className={`${styles.item}${entry.id === value ? ` ${styles.itemSelected}` : ""}`}
              onClick={() => {
                onChange(entry.id);
                setOpen(false);
              }}
            >
              <span>{entry.id}</span>
              {entry.offset && (
                <Caption1
                  style={{
                    marginLeft: 8,
                    color: tokens.colorNeutralForeground3,
                  }}
                >
                  UTC{entry.offset}
                </Caption1>
              )}
            </div>
          ))}
        </div>
      </PopoverSurface>
    </Popover>
  );
}
