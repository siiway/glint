export class TodoSync {
  private state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      const upgrade = request.headers.get("Upgrade");
      if (upgrade !== "websocket") {
        return new Response("Expected WebSocket upgrade", { status: 426 });
      }
      const setId = url.searchParams.get("setId") ?? "all";
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.state.acceptWebSocket(server, [setId]);
      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === "/broadcast" && request.method === "POST") {
      const event = (await request.json()) as { setId?: string };
      const msg = JSON.stringify(event);
      const sockets = event.setId
        ? this.state.getWebSockets(event.setId)
        : this.state.getWebSockets();
      for (const ws of sockets) {
        try {
          ws.send(msg);
        } catch {
          // ignore closed sockets
        }
      }
      return new Response("ok");
    }

    return new Response("Not found", { status: 404 });
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
