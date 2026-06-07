import { createLogger } from "@dacc/core";
import { startAuditWorker } from "./workers/audit.worker.js";
import { startDiscoveryWorker } from "./workers/discovery.worker.js";
import { startRiskEngineWorker } from "./workers/risk-engine.worker.js";
import { startShadowAuditWorker } from "./workers/shadow-audit.worker.js";

const log = createLogger("auditor");

const auditWorker = startAuditWorker();
const discoveryWorker = startDiscoveryWorker();
const riskEngineWorker = startRiskEngineWorker();
const shadowAuditWorker = startShadowAuditWorker();

log.info("DACC Auditor workers started");

process.on("SIGTERM", async () => {
  log.info("Shutting down auditor workers...");
  await auditWorker.close();
  await discoveryWorker.close();
  await riskEngineWorker.close();
  await shadowAuditWorker.close();
  process.exit(0);
});

export { CHECK_REGISTRY, ALL_CHECK_NAMES } from "./checks/index.js";
