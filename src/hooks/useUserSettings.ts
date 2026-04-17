import { useState, useEffect, useCallback } from "react";

export type UserSettings = {
  action_bar?: string[] | null;
  realtime_transport?: "ws" | "sse" | "auto";
};

const LS_KEY = "glint_user_settings_cache";

function readCache(): UserSettings {
  try {
    const v = localStorage.getItem(LS_KEY);
    if (v) return JSON.parse(v) as UserSettings;
  } catch {}
  return {};
}

function writeCache(s: UserSettings) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {}
}

export function useUserSettings() {
  const [settings, setSettings] = useState<UserSettings>(readCache);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/user/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { settings: UserSettings } | null) => {
        if (data) {
          setSettings(data.settings);
          writeCache(data.settings);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const update = useCallback(async (patch: Partial<UserSettings>) => {
    // Optimistic local update.
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      writeCache(next);
      return next;
    });
    await fetch("/api/user/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }, []);

  return { settings, loading, update };
}
