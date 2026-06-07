import { prisma } from "../db/prisma-client.js";

export interface SnapshotState {
  assets: Record<string, unknown>[];
  riskScores: Record<string, unknown>[];
  capturedAt: string;
}

export interface CreateSnapshotOptions {
  label?: string;
  assetId?: string;
}

export interface Snapshot {
  id: string;
  tenantId: string;
  stateData: SnapshotState;
  createdAt: Date;
}

export async function createSnapshot(
  tenantId: string,
  options: CreateSnapshotOptions = {}
): Promise<Snapshot> {
  const assets = await prisma.digitalAsset.findMany({
    where: { tenantId, ...(options.assetId ? { id: options.assetId } : {}) },
    select: { id: true, url: true, status: true, type: true },
  });

  const riskScores = await prisma.riskScore.findMany({
    where: { tenantId, validUntil: null },
    select: { id: true, assetId: true, score: true, level: true, factors: true },
  });

  const stateData: SnapshotState = {
    assets: assets as Record<string, unknown>[],
    riskScores: riskScores as Record<string, unknown>[],
    capturedAt: new Date().toISOString(),
  };

  const snap = await prisma.sandboxSnapshot.create({
    data: { tenantId, stateData: stateData as unknown as object },
  });

  return {
    id: snap.id,
    tenantId: snap.tenantId,
    stateData: snap.stateData as unknown as SnapshotState,
    createdAt: snap.createdAt,
  };
}

export async function listSnapshots(tenantId: string): Promise<Snapshot[]> {
  const snaps = await prisma.sandboxSnapshot.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });
  return snaps.map((s) => ({
    id: s.id,
    tenantId: s.tenantId,
    stateData: s.stateData as unknown as SnapshotState,
    createdAt: s.createdAt,
  }));
}

export async function getSnapshot(id: string, tenantId: string): Promise<Snapshot | null> {
  const snap = await prisma.sandboxSnapshot.findFirst({ where: { id, tenantId } });
  if (!snap) return null;
  return {
    id: snap.id,
    tenantId: snap.tenantId,
    stateData: snap.stateData as unknown as SnapshotState,
    createdAt: snap.createdAt,
  };
}

export async function pruneSnapshots(tenantId: string, keepLast = 5): Promise<number> {
  const all = await prisma.sandboxSnapshot.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  const toDelete = all.slice(keepLast);
  if (toDelete.length === 0) return 0;
  const { count } = await prisma.sandboxSnapshot.deleteMany({
    where: { id: { in: toDelete.map((s) => s.id) } },
  });
  return count;
}
