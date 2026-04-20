type SseWriter = WritableStreamDefaultWriter<Uint8Array>;

export class TodoSync {
  private state: DurableObjectState;
  private enc = new TextEncoder();
  // setId → set of active SSE writers (not hibernatable; kept alive by open connections)
  private sseClients = new Map<string, Set<SseWriter>>();

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const setId = url.searchParams.get("setId") ?? "all";

    if (url.pathname === "/ws") {
      const upgrade = request.headers.get("Upgrade");
      if (upgrade !== "websocket") {
        return new Response("Expected WebSocket upgrade", { status: 426 });
      }
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.state.acceptWebSocket(server, [setId]);
      // Initial message so clients/devtools can confirm the stream is alive.
      try {
        server.send(JSON.stringify({ type: "realtime:ready", setId }));
      } catch {}
      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === "/sse") {
      const { readable, writable } = new TransformStream<
        Uint8Array,
        Uint8Array
      >();
      const writer = writable.getWriter();

      if (!this.sseClients.has(setId)) this.sseClients.set(setId, new Set());
      this.sseClients.get(setId)!.add(writer);

      // Initial ping so the browser EventSource confirms the connection.
      writer.write(this.enc.encode(": ping\n\n")).catch(() => {});

      // Remove the writer when the client disconnects (stream closed from client side).
      const cleanup = () => {
        this.sseClients.get(setId)?.delete(writer);
        writer.close().catch(() => {});
      };
      request.signal?.addEventListener("abort", cleanup);

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no",
        },
      });
    }

    if (url.pathname === "/broadcast" && request.method === "POST") {
      const event = (await request.json()) as { setId?: string };
      const msg = JSON.stringify(event);

      // WebSocket broadcast (hibernated sockets resume automatically).
      const wsSockets = event.setId
        ? this.state.getWebSockets(event.setId)
        : this.state.getWebSockets();
      for (const ws of wsSockets) {
        try {
          ws.send(msg);
        } catch {}
      }

      // SSE broadcast.
      await this.broadcastSse(event.setId, this.enc.encode(`data: ${msg}\n\n`));

      return new Response("ok");
    }

    return new Response("Not found", { status: 404 });
  }

  private async broadcastSse(
    setId: string | undefined,
    chunk: Uint8Array,
  ): Promise<void> {
    const targets: [string, SseWriter][] = [];

    if (setId) {
      for (const w of this.sseClients.get(setId) ?? [])
        targets.push([setId, w]);
    } else {
      for (const [id, writers] of this.sseClients) {
        for (const w of writers) targets.push([id, w]);
      }
    }

    const dead: [string, SseWriter][] = [];
    await Promise.all(
      targets.map(async ([id, w]) => {
        try {
          await w.write(chunk);
        } catch {
          dead.push([id, w]);
        }
      }),
    );
    for (const [id, w] of dead) this.sseClients.get(id)?.delete(w);
  }

  webSocketMessage(_ws: WebSocket, _msg: string | ArrayBuffer): void {}

  webSocketClose(ws: WebSocket): void {
    try {
      ws.close();
    } catch {}
  }

  webSocketError(ws: WebSocket): void {
    try {
      ws.close();
    } catch {}
  }
}
