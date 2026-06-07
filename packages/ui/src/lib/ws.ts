import { useEffect, useRef, useState, useCallback } from "react";

const WS_BASE = import.meta.env["VITE_WS_URL"] ?? "ws://localhost:3000";

export interface LiveEvent {
  eventType: string;
  tenantId: string;
  payload: Record<string, unknown>;
  occurredAt: string;
}

export function useWebSocket(path: string) {
  const [messages, setMessages] = useState<LiveEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const intentionalClose = useRef(false);

  const connect = useCallback(() => {
    const token = localStorage.getItem("dacc_token");
    const url = `${WS_BASE}${path}${token !== null ? `?token=${encodeURIComponent(token)}` : ""}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onmessage = (e: MessageEvent<string>) => {
      try {
        const data = JSON.parse(e.data) as LiveEvent;
        setMessages((prev) => [...prev.slice(-49), data]);
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = () => {
      setConnected(false);
      if (!intentionalClose.current) {
        setTimeout(connect, 3000);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [path]);

  useEffect(() => {
    intentionalClose.current = false;
    connect();

    return () => {
      intentionalClose.current = true;
      wsRef.current?.close();
    };
  }, [connect]);

  const clearMessages = useCallback(() => setMessages([]), []);

  return { messages, connected, clearMessages };
}
