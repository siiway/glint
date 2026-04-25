/**
 * Realtime helpers — Durable-Object broadcast, WebSocket upgrade, and SSE.
 * Shared by both the regular routes and the cross-app routes.
 */

import type { Context } from "hono";
import type { Bindings, Variables } from "./types";

type Ctx = Context<{ Bindings: Bindings; Variables: Variables }>;

function getStub(env: Bindings, teamId: string) {
  if (!env.TODO_SYNC) return null;
  return env.TODO_SYNC.get(env.TODO_SYNC.idFromName(teamId));
}

/** Fire-and-forget broadcast to the team's Durable Object. */
export function broadcast(
  env: Bindings,
  teamId: string,
  event: Record<string, unknown>,
): void {
  const stub = getStub(env, teamId);
  if (!stub) return;
  try {
    void stub.fetch(
      new Request("https://do-internal/broadcast", {
        method: "POST",
        body: JSON.stringify(event),
        headers: { "Content-Type": "application/json" },
      }),
    );
  } catch (error) {
    void error;
  }
}

/** WebSocket upgrade handler. The caller is responsible for auth/role checks. */
export async function handleWsUpgrade(c: Ctx): Promise<Response> {
  const teamId = c.req.param("teamId")!;
  const setId = c.req.param("setId")!;
  const stub = getStub(c.env, teamId);
  if (!stub) {
    return c.json(
      { error: "Realtime sync is not available on this deployment" },
      503,
    );
  }

  if (c.req.method === "HEAD") {
    return new Response(null, { status: 200 });
  }

  if (c.req.header("Upgrade") !== "websocket") {
    return c.json({ error: "Expected WebSocket upgrade" }, 426);
  }

  const doUrl = new URL(c.req.url);
  doUrl.pathname = "/ws";
  doUrl.searchParams.set("setId", setId);
  return stub.fetch(new Request(doUrl.toString(), c.req.raw));
}

/** SSE subscription handler. The caller is responsible for auth/role checks. */
export async function handleSse(c: Ctx): Promise<Response> {
  const teamId = c.req.param("teamId")!;
  const setId = c.req.param("setId")!;
  const stub = getStub(c.env, teamId);
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
}
