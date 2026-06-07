import type { FastifyPluginAsync } from "fastify";
import {
  createSnapshot,
  listSnapshots,
  getSnapshot,
  pruneSnapshots,
  rollbackToSnapshot,
  validateRollbackTarget,
  NotFoundError,
} from "@dacc/core";

interface CreateSnapshotBody {
  label?: string;
  assetId?: string;
}

export const sandboxRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: CreateSnapshotBody }>("/snapshots", {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const tenantId = req.principal.tenantId;
    const { label, assetId } = req.body ?? {};

    const snapshot = await createSnapshot(tenantId, {
      ...(label !== undefined ? { label } : {}),
      ...(assetId !== undefined ? { assetId } : {}),
    });
    await pruneSnapshots(tenantId, 10);

    return reply.status(201).send({ snapshot });
  });

  app.get("/snapshots", {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const tenantId = req.principal.tenantId;
    const snapshots = await listSnapshots(tenantId);
    return reply.send({ snapshots });
  });

  app.get<{ Params: { id: string } }>("/snapshots/:id", {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const tenantId = req.principal.tenantId;
    const snapshot = await getSnapshot(req.params.id, tenantId);
    if (!snapshot) throw new NotFoundError("Snapshot not found");
    return reply.send({ snapshot });
  });

  app.post<{ Params: { id: string } }>("/snapshots/:id/rollback", {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const tenantId = req.principal.tenantId;
    const { id } = req.params;

    const valid = await validateRollbackTarget(id, tenantId);
    if (!valid) throw new NotFoundError("Snapshot not found");

    const result = await rollbackToSnapshot(id, tenantId);
    return reply.send({ result });
  });
};
