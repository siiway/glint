import { Hono } from "hono";
import type { Bindings, Variables } from "../types";
import { setWorkbenchId } from "../config";
import { requireAuth, getTeamRole } from "../auth";
import { hasPermission } from "../permissions";
import { getSettings, patchSettings } from "../handlers/settings";

const settings = new Hono<{ Bindings: Bindings; Variables: Variables }>();

settings.get("/api/teams/:teamId/settings", requireAuth, getSettings);
settings.patch("/api/teams/:teamId/settings", requireAuth, patchSettings);

settings.put("/api/teams/:teamId/workbench-id", requireAuth, async (c) => {
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

  const body = await c.req.json<{ workbench_id: string }>();
  const newId = (body.workbench_id ?? "").trim();
  if (!newId) return c.json({ error: "workbench_id must not be empty" }, 400);

  await setWorkbenchId(c.env.KV, teamId, newId);
  return c.json({ workbench_id: newId });
});

export default settings;
