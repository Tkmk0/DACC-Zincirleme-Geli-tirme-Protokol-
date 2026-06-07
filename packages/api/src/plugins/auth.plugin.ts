import fp from "fastify-plugin";
import {
  UnauthorizedError,
  ForbiddenError,
  type AuthPrincipal,
  type TenantContext,
  isJwtPayload,
} from "@dacc/core";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest) => Promise<void>;
  }
  interface FastifyRequest {
    principal: AuthPrincipal;
    tenantCtx: TenantContext;
  }
}

const authPlugin: FastifyPluginAsync = async (app) => {
  app.decorate("authenticate", async (request: FastifyRequest) => {
    // 1. Try Bearer JWT
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const payload = await request.jwtVerify<AuthPrincipal>();
        request.principal = payload;
        return;
      } catch {
        throw new UnauthorizedError("Invalid or expired token");
      }
    }

    // 2. Try API key (X-API-Key header)
    const apiKey = request.headers["x-api-key"];
    if (typeof apiKey === "string" && apiKey.length > 0) {
      const keyPrefix = apiKey.substring(0, 8);
      const record = await app.db.apiKey.findFirst({
        where: { keyPrefix, status: "ACTIVE" },
      });

      if (!record) throw new UnauthorizedError("Invalid API key");

      const { createHash } = await import("crypto");
      const hash = createHash("sha256").update(apiKey).digest("hex");
      if (hash !== record.keyHash) throw new UnauthorizedError("Invalid API key");

      if (record.expiresAt && record.expiresAt < new Date()) {
        throw new UnauthorizedError("API key expired");
      }

      await app.db.apiKey.update({
        where: { id: record.id },
        data: { lastUsedAt: new Date() },
      });

      request.principal = {
        keyId: record.id,
        tenantId: record.tenantId,
        scopes: record.scopes,
        operatorType: "api_key",
      };
      return;
    }

    throw new UnauthorizedError();
  });

  // Decorate with empty defaults — routes that call authenticate() will populate
  app.decorateRequest("principal", null);
  app.decorateRequest("tenantCtx", null);
};

export default fp(authPlugin, { name: "auth", dependencies: ["prisma"] });
export { authPlugin };

// ─── Scope guard helper ────────────────────────────────────────────────────

export function requireScope(scope: string) {
  return async (request: FastifyRequest) => {
    const p = request.principal;
    if (!p) throw new UnauthorizedError();
    if (!isJwtPayload(p) && !p.scopes.includes(scope)) {
      throw new ForbiddenError(`Scope '${scope}' required`);
    }
  };
}
