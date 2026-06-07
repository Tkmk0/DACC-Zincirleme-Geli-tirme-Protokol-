import type { FastifyPluginAsync } from "fastify";
import { createHash } from "crypto";
import { UnauthorizedError } from "@dacc/core";

interface LoginBody {
  apiKey: string;
}

interface RefreshBody {
  token?: string;
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: LoginBody }>("/login", async (req, reply) => {
    const { apiKey } = req.body;
    if (!apiKey || typeof apiKey !== "string") {
      return reply.status(400).send({ error: "apiKey is required" });
    }

    const keyPrefix = apiKey.substring(0, 8);
    const record = await app.db.apiKey.findFirst({
      where: { keyPrefix, status: "ACTIVE" },
    });

    if (!record) throw new UnauthorizedError("Invalid API key");

    const hash = createHash("sha256").update(apiKey).digest("hex");
    if (hash !== record.keyHash) throw new UnauthorizedError("Invalid API key");

    if (record.expiresAt && record.expiresAt < new Date()) {
      throw new UnauthorizedError("API key expired");
    }

    await app.db.apiKey.update({
      where: { id: record.id },
      data: { lastUsedAt: new Date() },
    });

    const token = app.jwt.sign(
      { tenantId: record.tenantId, scopes: record.scopes, keyId: record.id },
      { expiresIn: "24h" }
    );

    return reply.status(200).send({ token, expiresIn: "24h" });
  });

  app.post<{ Body: RefreshBody }>("/refresh", {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const p = req.principal;
    const token = app.jwt.sign(
      { tenantId: p.tenantId, scopes: "scopes" in p ? p.scopes : [], keyId: "keyId" in p ? p.keyId : undefined },
      { expiresIn: "24h" }
    );
    return reply.status(200).send({ token, expiresIn: "24h" });
  });
};
