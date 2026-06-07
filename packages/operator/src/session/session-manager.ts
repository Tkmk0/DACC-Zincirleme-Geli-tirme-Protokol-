import { prisma, type OperatorAction } from "@dacc/core";

export class SessionManager {
  async open(
    tenantId: string,
    operatorId: string,
    operatorType: "api_key" | "user" | "service",
    meta: { ipAddress?: string; userAgent?: string }
  ): Promise<string> {
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8h
    const session = await prisma.operatorSession.create({
      data: {
        tenantId,
        operatorId,
        operatorType,
        ...(meta.ipAddress !== undefined ? { ipAddress: meta.ipAddress } : {}),
        ...(meta.userAgent !== undefined ? { userAgent: meta.userAgent } : {}),
        expiresAt,
      },
    });
    return session.id;
  }

  async recordAction(sessionId: string, action: OperatorAction): Promise<void> {
    const session = await prisma.operatorSession.findUniqueOrThrow({
      where: { id: sessionId },
    });
    const actions = (session.actions as unknown as OperatorAction[]) ?? [];
    const updatedActions = [...actions, action];
    await prisma.operatorSession.update({
      where: { id: sessionId },
      data: { actions: updatedActions as unknown as object },
    });
  }

  async close(sessionId: string): Promise<void> {
    await prisma.operatorSession.update({
      where: { id: sessionId },
      data: { status: "CLOSED", closedAt: new Date() },
    });
  }
}
