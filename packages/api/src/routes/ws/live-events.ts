import type { FastifyPluginAsync } from "fastify";
import type { SocketStream } from "@fastify/websocket";

const tenantConnections = new Map<string, Set<SocketStream>>();

export const liveEventsRoute: FastifyPluginAsync = async (app) => {
  app.get(
    "/live",
    { websocket: true },
    (socket: SocketStream, request) => {
      const tenantId = request.tenantCtx?.tenantId;
      if (!tenantId) {
        socket.socket.close(1008, "Unauthorized");
        return;
      }

      if (!tenantConnections.has(tenantId)) {
        tenantConnections.set(tenantId, new Set());
      }
      tenantConnections.get(tenantId)!.add(socket);

      socket.on("close", () => {
        tenantConnections.get(tenantId)?.delete(socket);
      });

      socket.on("error", () => {
        tenantConnections.get(tenantId)?.delete(socket);
      });
    }
  );
};

export function broadcastToTenant(tenantId: string, data: unknown): void {
  const sockets = tenantConnections.get(tenantId);
  if (!sockets) return;
  const message = JSON.stringify(data);
  for (const socketStream of sockets) {
    const ws = socketStream.socket;
    if (ws.readyState === ws.OPEN) {
      ws.send(message);
    }
  }
}
