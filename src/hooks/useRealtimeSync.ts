import { useEffect } from "react";
import type { WsEvent } from "./useWebSocket";

export type { WsEvent };

type Transport = "ws" | "sse" | "auto";

type Options = {
  teamId: string;
  setId: string;
  onEvent: (event: WsEvent) => void;
  enabled?: boolean;
  transport?: Transport;
};

export function useRealtimeSync({
  teamId,
  setId,
  onEvent,
  enabled = true,
  transport = "auto",
}: Options) {
  useEffect(() => {
    if (!enabled) return;

    let unmounted = false;
    let cleanup: (() => void) | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = 500;

    const scheduleRetry = (fn: () => void) => {
      const delay = retryDelay;
      retryDelay = Math.min(delay * 2, 30000);
      retry = setTimeout(fn, delay);
    };

    const connectSse = () => {
      if (unmounted) return;

      const url = `/api/teams/${teamId}/sets/${setId}/sse`;
      const es = new EventSource(url);

      es.onmessage = (ev) => {
        try {
          const event = JSON.parse(ev.data as string) as WsEvent;
          onEvent(event);
        } catch (error) {
          void error;
        }
      };

      es.onopen = () => {
        retryDelay = 500;
      };

      es.onerror = () => {
        es.close();
        if (unmounted) return;
        scheduleRetry(connectSse);
      };

      cleanup = () => es.close();
    };

    const connectWs = async (fallbackToSse: boolean) => {
      if (unmounted) return;

      try {
        const probe = await fetch(`/api/teams/${teamId}/sets/${setId}/ws`, {
          method: "HEAD",
        });
        if (probe.status === 503) return;
      } catch (error) {
        void error;
      }

      const proto = location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${proto}//${location.host}/api/teams/${teamId}/sets/${setId}/ws`;
      const socket = new WebSocket(url);

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
        if (fallbackToSse) {
          connectSse();
          return;
        }
        scheduleRetry(() => {
          void connectWs(false);
        });
      };

      socket.onerror = () => socket.close();
      cleanup = () => socket.close();
    };

    if (transport === "sse") {
      connectSse();
    } else if (transport === "ws") {
      void connectWs(false);
    } else {
      void connectWs(true);
    }

    return () => {
      unmounted = true;
      if (retry) clearTimeout(retry);
      cleanup?.();
    };
  }, [teamId, setId, onEvent, enabled, transport]);
}
