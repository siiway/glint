import { Hono } from "hono";
import type { Bindings, Variables } from "../types";
import { requireAuth, getTeamRole } from "../auth";

const ws = new Hono<{ Bindings: Bindings; Variables: Variables }>();

async function getStub(
  c: { env: { TODO_SYNC?: DurableObjectNamespace } },
  teamId: string,
) {
  if (!c.env.TODO_SYNC) return null;
  return c.env.TODO_SYNC.get(c.env.TODO_SYNC.idFromName(teamId));
}

ws.get("/api/teams/:teamId/sets/:setId/ws", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const setId = c.req.param("setId");
  const session = c.get("session");

  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  const stub = await getStub(c, teamId);
  if (!stub) {
    return c.json(
      { error: "Realtime sync is not available on this deployment" },
      503,
    );
  }

  const upgrade = c.req.header("Upgrade");
  if (upgrade !== "websocket") {
    return c.json({ error: "Expected WebSocket upgrade" }, 426);
  }

  const doUrl = new URL(c.req.url);
  doUrl.pathname = "/ws";
  doUrl.searchParams.set("setId", setId);
  return stub.fetch(new Request(doUrl.toString(), c.req.raw));
});

ws.get("/api/teams/:teamId/sets/:setId/sse", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const setId = c.req.param("setId");
  const session = c.get("session");

  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  const stub = await getStub(c, teamId);
  if (!stub) {
    return c.json(
      { error: "Realtime sync is not available on this deployment" },
      503,
    );
  }

  const doUrl = new URL(c.req.url);
  doUrl.pathname = "/sse";
  doUrl.searchParams.set("setId", setId);
  return stub.fetch(
    new Request(doUrl.toString(), { signal: c.req.raw.signal }),
  );
});

export default ws;
