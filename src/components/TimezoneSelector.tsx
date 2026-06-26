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

const tzOffsetCache = new Map<string, string>();

function computeOffset(tz: string): string {
  const cached = tzOffsetCache.get(tz);
  if (cached !== undefined) return cached;
  try {
    const now = new Date();
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    const partValues: Record<string, string> = {};
    for (const { type, value } of dtf.formatToParts(now)) {
      if (type !== "literal") partValues[type] = value;
    }
    const tzUtcMs = Date.UTC(
      Number(partValues.year),
      Number(partValues.month) - 1,
      Number(partValues.day),
      Number(partValues.hour),
      Number(partValues.minute),
      Number(partValues.second),
    );
    const offsetMinutes = Math.round((tzUtcMs - now.getTime()) / 60000);
    let result: string;
    if (offsetMinutes === 0) {
      result = "+0";
    } else {
      const sign = offsetMinutes > 0 ? "+" : "-";
      const abs = Math.abs(offsetMinutes);
      const h = Math.floor(abs / 60);
      const m = abs % 60;
      result =
        m > 0 ? `${sign}${h}:${String(m).padStart(2, "0")}` : `${sign}${h}`;
    }
    tzOffsetCache.set(tz, result);
    return result;
  } catch {
    return "";
  }
}

let tzListCache: TzEntry[] | null = null;

function getTzList(): TzEntry[] {
  if (tzListCache) return tzListCache;
  const zones: string[] =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : [];
  tzListCache = zones.map((tz) => ({ id: tz, offset: computeOffset(tz) }));
  return tzListCache;
}
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
    const allTz = getTzList();
    const q = filter.trim().toLowerCase();
    if (!q) return allTz;
    return allTz.filter(
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
