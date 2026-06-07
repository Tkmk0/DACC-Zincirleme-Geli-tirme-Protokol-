import { prisma } from "../db/prisma-client.js";
import { getSnapshot } from "./snapshot-engine.js";
import { NotFoundError } from "../utils/errors.js";

export interface RollbackOptions {
  dryRun?: boolean;
}

export interface RollbackResult {
  snapshotId: string;
  restoredAssets: number;
  restoredRiskScores: number;
  dryRun: boolean;
}

export async function validateRollbackTarget(id: string, tenantId: string): Promise<boolean> {
  const snap = await prisma.sandboxSnapshot.findFirst({ where: { id, tenantId } });
  return snap !== null;
}

export async function rollbackToSnapshot(
  snapshotId: string,
  tenantId: string,
  options: RollbackOptions = {}
): Promise<RollbackResult> {
  const snapshot = await getSnapshot(snapshotId, tenantId);
  if (!snapshot) throw new NotFoundError("Snapshot not found");

  const { dryRun = false } = options;

  if (!dryRun) {
    await prisma.riskScore.updateMany({
      where: { tenantId, validUntil: null },
      data: { validUntil: new Date() },
    });
  }

  return {
    snapshotId,
    restoredAssets: snapshot.stateData.assets.length,
    restoredRiskScores: snapshot.stateData.riskScores.length,
    dryRun,
  };
}
