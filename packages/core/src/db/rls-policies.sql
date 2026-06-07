-- ─────────────────────────────────────────────────────────────────────────────
-- DACC — PostgreSQL Row-Level Security Policies
-- Run AFTER prisma migrate (manually or via migration hook)
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable RLS on tenant-scoped tables
ALTER TABLE digital_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_scores    ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys       ENABLE ROW LEVEL SECURITY;

-- ─── digital_assets ──────────────────────────────────────────────────────────

CREATE POLICY tenant_isolation_digital_assets
  ON digital_assets
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ─── audit_events ────────────────────────────────────────────────────────────

CREATE POLICY tenant_isolation_audit_events
  ON audit_events
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ─── risk_scores ─────────────────────────────────────────────────────────────

CREATE POLICY tenant_isolation_risk_scores
  ON risk_scores
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ─── operator_sessions ───────────────────────────────────────────────────────

CREATE POLICY tenant_isolation_operator_sessions
  ON operator_sessions
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ─── event_log ───────────────────────────────────────────────────────────────

CREATE POLICY tenant_isolation_event_log
  ON event_log
  USING (
    tenant_id IS NULL
    OR tenant_id = current_setting('app.tenant_id', true)::uuid
  );

-- ─── users ───────────────────────────────────────────────────────────────────

CREATE POLICY tenant_isolation_users
  ON users
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ─── api_keys ────────────────────────────────────────────────────────────────

CREATE POLICY tenant_isolation_api_keys
  ON api_keys
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Grant bypass to service role (Prisma migration user)
-- IMPORTANT: The app DB user should NOT have BYPASSRLS
-- ALTER ROLE dacc_app NOBYPASSRLS;
