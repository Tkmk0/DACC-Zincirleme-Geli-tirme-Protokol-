import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import { env, createLogger } from "@dacc/core";

import { authPlugin } from "./plugins/auth.plugin.js";
import { prismaPlugin } from "./plugins/prisma.plugin.js";
import { redisPlugin } from "./plugins/redis.plugin.js";
import { tenantScopeHook } from "./middleware/tenant-scope.js";

import { tenantsRoutes } from "./routes/tenants/index.js";
import { assetsRoutes } from "./routes/assets/index.js";
import { auditsRoutes } from "./routes/audits/index.js";
import { riskRoutes } from "./routes/risk/index.js";
import { authRoutes } from "./routes/auth/index.js";
import { brandRoutes } from "./routes/brand/index.js";
import { liveEventsRoute } from "./routes/ws/live-events.js";
import { debugRoutes } from "./routes/debug/index.js";
import { maintenanceRoutes } from "./routes/maintenance/index.js";
import { sandboxRoutes } from "./routes/sandbox/index.js";

import { startAlertBroadcastWorker } from "./workers/alert-broadcast.worker.js";
import { startEventLogWorker } from "./workers/event-log.worker.js";

const log = createLogger("server");

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    trustProxy: true,
  });

  // ─── Core plugins ─────────────────────────────────────────────────────
  await app.register(cors, { origin: true });
  await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });
  await app.register(jwt, { secret: env.JWT_SECRET });
  await app.register(websocket);

  // ─── DACC plugins ─────────────────────────────────────────────────────
  await app.register(prismaPlugin);
  await app.register(redisPlugin);
  await app.register(authPlugin);

  // ─── Global hooks ─────────────────────────────────────────────────────
  app.addHook("onRequest", tenantScopeHook);

  // ─── Error handler ────────────────────────────────────────────────────
  app.setErrorHandler((error, _request, reply) => {
    log.error({ err: error }, "Request error");
    const statusCode = "statusCode" in error ? (error.statusCode as number) : 500;
    reply.status(statusCode).send({
      error: error.message,
      code: "code" in error ? error.code : "INTERNAL_ERROR",
    });
  });

  // ─── Routes ───────────────────────────────────────────────────────────
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(tenantsRoutes, { prefix: "/tenants" });
  await app.register(assetsRoutes, { prefix: "/assets" });
  await app.register(auditsRoutes, { prefix: "/audits" });
  await app.register(riskRoutes, { prefix: "/risk" });
  await app.register(brandRoutes, { prefix: "/brand" });
  await app.register(liveEventsRoute, { prefix: "/ws" });
  await app.register(debugRoutes, { prefix: "/debug" });
  await app.register(maintenanceRoutes, { prefix: "/maintenance" });
  await app.register(sandboxRoutes, { prefix: "/sandbox" });

  // Health check
  app.get("/health", async () => ({ status: "ok", ts: new Date().toISOString() }));

  // ─── Background workers ───────────────────────────────────────────────
  startAlertBroadcastWorker();
  startEventLogWorker();

  return app;
}
