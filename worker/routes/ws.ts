import { Hono } from "hono";
import type { Bindings, Variables } from "../types";
import { requireAuth, getTeamRole } from "../auth";

const ws = new Hono<{ Bindings: Bindings; Variables: Variables }>();

ws.get("/api/teams/:teamId/sets/:setId/ws", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const setId = c.req.param("setId");
  const session = c.get("session");

  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  if (!c.env.TODO_SYNC) {
    return c.json(
      { error: "Realtime sync is not available on this deployment" },
      503,
    );
  }

  const upgrade = c.req.header("Upgrade");
  if (upgrade !== "websocket") {
    return c.json({ error: "Expected WebSocket upgrade" }, 426);
  }

  const id = c.env.TODO_SYNC.idFromName(teamId);
  const stub = c.env.TODO_SYNC.get(id);

  const doUrl = new URL(c.req.url);
  doUrl.pathname = "/ws";
  doUrl.searchParams.set("setId", setId);

  return stub.fetch(new Request(doUrl.toString(), c.req.raw));
});

export default ws;
