import type { UserSettings } from "../hooks/useUserSettings";

export const ALL_ACTION_KEYS = [
  "add_before",
  "add_after",
  "add_subtodo",
  "edit",
  "complete",
  "claim",
  "comment",
  "delete",
] as const;

export type ActionKey = (typeof ALL_ACTION_KEYS)[number];

export const BUILTIN_SITE_DEFAULT: ActionKey[] = [
  "add_after",
  "edit",
  "complete",
  "delete",
];

export function loadUserActionBar(): ActionKey[] | null {
  try {
    const cache = localStorage.getItem("glint_user_settings_cache");
    if (cache) {
      const parsed = JSON.parse(cache) as UserSettings;
      if (Array.isArray(parsed.action_bar))
        return parsed.action_bar as ActionKey[];
      if (parsed.action_bar === null) return null;
    }
    const v = localStorage.getItem("glint_action_bar_user");
    if (v) return JSON.parse(v);
  } catch (error) {
    void error;
  }
  return null;
}

export function loadWorkspaceActionBar(spaceId: string): ActionKey[] | null {
  try {
    const v = localStorage.getItem(`glint_action_bar_ws_${spaceId}`);
    if (v) return JSON.parse(v);
  } catch (error) {
    void error;
  }
  return null;
}

export function getEffectiveActions(
  spaceId: string,
  siteDefault: ActionKey[] = BUILTIN_SITE_DEFAULT,
): ActionKey[] {
  return loadUserActionBar() ?? loadWorkspaceActionBar(spaceId) ?? siteDefault;
}
