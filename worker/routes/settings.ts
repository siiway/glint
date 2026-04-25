import { Hono } from "hono";
import type { Bindings, Variables, TeamSettings } from "../types";
import { getTeamSettings, setTeamSettings, setWorkbenchId } from "../config";
import { requireAuth, getTeamRole } from "../auth";
import { hasPermission } from "../permissions";

const settings = new Hono<{ Bindings: Bindings; Variables: Variables }>();

settings.get("/api/teams/:teamId/settings", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  const s = await getTeamSettings(c.env.KV, teamId);
  return c.json({ settings: s });
});

settings.patch("/api/teams/:teamId/settings", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  const canEdit = await hasPermission(
    c.env.DB,
    teamId,
    role,
    "manage_settings",
  );
  if (!canEdit)
    return c.json({ error: "No permission to manage settings" }, 403);

  const body = await c.req.json<Partial<TeamSettings>>();

  const allowed: (keyof TeamSettings)[] = [
    "site_name",
    "site_logo_url",
    "accent_color",
    "welcome_message",
    "default_set_name",
    "allow_member_create_sets",
    "default_timezone",
  ];

  const patch: Partial<TeamSettings> = {};
  for (const key of allowed) {
    if (key in body) {
      (patch as Record<string, unknown>)[key] = body[key];
    }
  }

  const s = await setTeamSettings(c.env.KV, teamId, patch);
  return c.json({ settings: s });
});

settings.put("/api/teams/:teamId/workbench-id", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  const canEdit = await hasPermission(c.env.DB, teamId, role, "manage_settings");
  if (!canEdit) return c.json({ error: "No permission to manage settings" }, 403);

  const body = await c.req.json<{ workbench_id: string }>();
  const newId = (body.workbench_id ?? "").trim();
  if (!newId) return c.json({ error: "workbench_id must not be empty" }, 400);

  await setWorkbenchId(c.env.KV, teamId, newId);
  return c.json({ workbench_id: newId });
});

export default settings;
