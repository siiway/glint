import { Hono } from "hono";
import type { Bindings, Variables } from "../types";
import { requireAuth, getTeamRole } from "../auth";
import { handleSse, handleWsUpgrade } from "../realtime";

const ws = new Hono<{ Bindings: Bindings; Variables: Variables }>();

ws.all("/api/teams/:teamId/sets/:setId/ws", requireAuth, async (c) => {
  const role = getTeamRole(c.get("session"), c.req.param("teamId")!);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);
  return handleWsUpgrade(c);
});

ws.get("/api/teams/:teamId/sets/:setId/sse", requireAuth, async (c) => {
  const role = getTeamRole(c.get("session"), c.req.param("teamId")!);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);
  return handleSse(c);
});

export default ws;
