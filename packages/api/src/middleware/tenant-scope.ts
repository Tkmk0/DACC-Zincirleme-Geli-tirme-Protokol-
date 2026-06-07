import type { FastifyRequest, FastifyReply } from "fastify";
import { prisma, type TenantContext } from "@dacc/core";
import { isJwtPayload } from "@dacc/core";

/**
 * Sets PostgreSQL session variable app.tenant_id for RLS enforcement.
 * Also populates request.tenantCtx for route handlers.
 * Only runs when a principal is present (i.e., after authenticate()).
 */
export async function tenantScopeHook(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const principal = request.principal;
  if (!principal) return;

  const tenantId = isJwtPayload(principal)
    ? principal.tenantId
    : principal.tenantId;

  // Set PostgreSQL session variable for RLS
  await prisma.$executeRawUnsafe(
    `SELECT set_config('app.tenant_id', $1, true)`,
    tenantId
  );

  // Load tenant context (cached per request lifecycle)
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { id: true, slug: true, planTier: true, sandboxId: true },
  });

  const ctx: TenantContext = {
    tenantId: tenant.id,
    slug: tenant.slug,
    planTier: tenant.planTier,
    sandboxId: tenant.sandboxId,
  };

  request.tenantCtx = ctx;
}
