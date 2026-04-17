import { useEffect, useRef, useCallback } from "react";
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
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const cleanupRef = useRef<(() => void) | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelay = useRef(500);
  const unmounted = useRef(false);

  const connectSse = useCallback(() => {
    if (unmounted.current || !enabled) return;

    const url = `/api/teams/${teamId}/sets/${setId}/sse`;
    const es = new EventSource(url);

    es.onmessage = (ev) => {
      try {
        const event = JSON.parse(ev.data as string) as WsEvent;
        onEventRef.current(event);
      } catch {}
    };

    es.onerror = () => {
      es.close();
      if (unmounted.current) return;
      const delay = retryDelay.current;
      retryDelay.current = Math.min(delay * 2, 30000);
      retryRef.current = setTimeout(connectSse, delay);
    };

    es.onopen = () => {
      retryDelay.current = 500;
    };

    cleanupRef.current = () => es.close();
  }, [teamId, setId, enabled]);

  const connectWs = useCallback(
    async (fallbackToSse: boolean) => {
      if (unmounted.current || !enabled) return;

      // Probe before upgrading (503 = realtime not available, stop silently).
      try {
        const probe = await fetch(`/api/teams/${teamId}/sets/${setId}/ws`, {
          method: "GET",
          headers: { Upgrade: "websocket" },
        });
        if (probe.status === 503) return;
      } catch {}

      const proto = location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${proto}//${location.host}/api/teams/${teamId}/sets/${setId}/ws`;
      const socket = new WebSocket(url);

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
        if (fallbackToSse) {
          // WS failed on first attempt — fall back to SSE permanently for this session.
          connectSse();
          return;
        }
        const delay = retryDelay.current;
        retryDelay.current = Math.min(delay * 2, 30000);
        retryRef.current = setTimeout(() => connectWs(false), delay);
      };

      socket.onerror = () => socket.close();
      cleanupRef.current = () => socket.close();
    },
    [teamId, setId, enabled, connectSse],
  );

  useEffect(() => {
    if (!enabled) return;
    unmounted.current = false;
    retryDelay.current = 500;

    if (transport === "sse") {
      connectSse();
    } else if (transport === "ws") {
      void connectWs(false);
    } else {
      // "auto": try WS, fall back to SSE on first failure.
      void connectWs(true);
    }

    return () => {
      unmounted.current = true;
      if (retryRef.current) clearTimeout(retryRef.current);
      cleanupRef.current?.();
    };
  }, [transport, connectWs, connectSse, enabled]);
}
