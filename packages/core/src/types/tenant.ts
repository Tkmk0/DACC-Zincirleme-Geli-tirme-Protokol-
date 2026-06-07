export interface TenantContext {
  tenantId: string;
  slug: string;
  planTier: string;
  sandboxId: string | null;
}
