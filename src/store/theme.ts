/**
 * Lightweight theme mode store with localStorage persistence.
 * "system" means follow OS preference; "light"/"dark" override it.
 * The key is absent from localStorage when mode is "system" so fresh users share one state.
 */
import { useSyncExternalStore } from "react";

export type ThemeMode = "system" | "light" | "dark";

const STORAGE_KEY = "glint_theme_mode";

function readMode(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    // localStorage may be blocked
  }
  return "system";
}

function writeMode(mode: ThemeMode) {
  try {
    if (mode === "system") {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, mode);
    }
  } catch {
    // ignore
  }
}

// ── pub/sub ──────────────────────────────────────────────────────────────────

let mode = readMode();
const listeners = new Set<() => void>();

function emitChange() {
  for (const l of listeners) l();
}

export function getThemeMode(): ThemeMode {
  return mode;
}

export function setThemeMode(next: ThemeMode) {
  mode = next;
  writeMode(next);
  emitChange();
}

/** Resolve the effective light/dark boolean, respecting OS preference for "system". */
export function resolveDark(m: ThemeMode): boolean {
  if (m === "light") return false;
  if (m === "dark") return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// React hook
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useThemeMode(): ThemeMode {
  return useSyncExternalStore(subscribe, getThemeMode, getThemeMode);
}
