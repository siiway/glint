import { useEffect, useRef, useCallback } from "react";

export type WsEvent =
  | { type: "todo:created"; setId: string; todo: TodoPayload }
  | {
      type: "todo:updated";
      setId: string;
      todo: Partial<TodoPayload> & { id: string };
    }
  | { type: "todo:deleted"; setId: string; id: string }
  | {
      type: "todo:reordered";
      setId: string;
      items: { id: string; sortOrder: number }[];
    }
  | {
      type: "todo:claimed";
      setId: string;
      id: string;
      claimedBy: string | null;
      claimedByName: string | null;
      claimedByAvatar: string | null;
    };

export type TodoPayload = {
  id: string;
  userId: string;
  parentId: string | null;
  title: string;
  completed: boolean;
  sortOrder: number;
  commentCount: number;
  claimedBy: string | null;
  claimedByName: string | null;
  claimedByAvatar: string | null;
  createdAt: string;
  updatedAt: string;
};

type Options = {
  teamId: string;
  setId: string;
  onEvent: (event: WsEvent) => void;
  enabled?: boolean;
};

export function useWebSocket({
  teamId,
  setId,
  onEvent,
  enabled = true,
}: Options) {
  const wsRef = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelay = useRef(500);
  const unmounted = useRef(false);

  onEventRef.current = onEvent;

  const connect = useCallback(async () => {
    if (unmounted.current || !enabled) return;

    // Check availability before attempting upgrade; 503 means DOs not provisioned.
    try {
      const probe = await fetch(`/api/teams/${teamId}/sets/${setId}/ws`, {
        method: "GET",
        headers: { Upgrade: "websocket" },
      });
      if (probe.status === 503) return; // realtime not available, stop silently
    } catch {
      // network error during probe — fall through and attempt WS anyway
    }

    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${location.host}/api/teams/${teamId}/sets/${setId}/ws`;
    const socket = new WebSocket(url);
    wsRef.current = socket;

    socket.onopen = () => {
      retryDelay.current = 500;
    };

    socket.onmessage = (ev) => {
      try {
        const event = JSON.parse(ev.data as string) as WsEvent;
        onEventRef.current(event);
      } catch {}
    };

    socket.onclose = () => {
      if (unmounted.current) return;
      const delay = retryDelay.current;
      retryDelay.current = Math.min(delay * 2, 30000);
      retryRef.current = setTimeout(connect, delay);
    };

    socket.onerror = () => {
      socket.close();
    };
  }, [teamId, setId, enabled]);

  useEffect(() => {
    if (!enabled) return;
    unmounted.current = false;
    connect();
    return () => {
      unmounted.current = true;
      if (retryRef.current) clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, [connect, enabled]);
}
