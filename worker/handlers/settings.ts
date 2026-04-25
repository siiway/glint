/**
 * Shared handlers for team settings endpoints.
 */

import type { Context } from "hono";
import type { Bindings, Variables, TeamSettings } from "../types";
import { getTeamRole } from "../auth";
import { getTeamSettings, setTeamSettings } from "../config";
import { hasPermission } from "../permissions";

type Ctx = Context<{ Bindings: Bindings; Variables: Variables }>;

const ALLOWED_SETTINGS_KEYS: (keyof TeamSettings)[] = [
  "site_name",
  "site_logo_url",
  "accent_color",
  "welcome_message",
  "default_set_name",
  "allow_member_create_sets",
  "default_timezone",
];

export const getSettings = async (c: Ctx): Promise<Response> => {
  const teamId = c.req.param("teamId")!;
  const role = getTeamRole(c.get("session"), teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  const s = await getTeamSettings(c.env.KV, teamId);
  return c.json({ settings: s });
};

export const patchSettings = async (c: Ctx): Promise<Response> => {
  const teamId = c.req.param("teamId")!;
  const role = getTeamRole(c.get("session"), teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  if (!(await hasPermission(c.env.DB, teamId, role, "manage_settings"))) {
    return c.json({ error: "No permission to manage settings" }, 403);
  }

  const body = await c.req.json<Partial<TeamSettings>>();
  const patch: Partial<TeamSettings> = {};
  for (const key of ALLOWED_SETTINGS_KEYS) {
    if (key in body) {
      (patch as Record<string, unknown>)[key] = body[key];
    }
  }

  const s = await setTeamSettings(c.env.KV, teamId, patch);
  return c.json({ settings: s });
};
