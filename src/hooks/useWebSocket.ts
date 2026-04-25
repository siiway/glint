import { useEffect } from "react";

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
  useEffect(() => {
    if (!enabled) return;

    let unmounted = false;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = 500;
    let socket: WebSocket | null = null;

    const connect = async () => {
      if (unmounted) return;

      try {
        const probe = await fetch(`/api/teams/${teamId}/sets/${setId}/ws`, {
          method: "GET",
          headers: { Upgrade: "websocket" },
        });
        if (probe.status === 503) return;
      } catch (error) {
        void error;
      }

      const proto = location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${proto}//${location.host}/api/teams/${teamId}/sets/${setId}/ws`;
      socket = new WebSocket(url);

      socket.onopen = () => {
        retryDelay = 500;
      };

      socket.onmessage = (ev) => {
        try {
          const event = JSON.parse(ev.data as string) as WsEvent;
          onEvent(event);
        } catch (error) {
          void error;
        }
      };

      socket.onclose = () => {
        if (unmounted) return;
        const delay = retryDelay;
        retryDelay = Math.min(delay * 2, 30000);
        retry = setTimeout(() => {
          void connect();
        }, delay);
      };

      socket.onerror = () => {
        socket?.close();
      };
    };

    void connect();

    return () => {
      unmounted = true;
      if (retry) clearTimeout(retry);
      socket?.close();
    };
  }, [teamId, setId, onEvent, enabled]);
}
