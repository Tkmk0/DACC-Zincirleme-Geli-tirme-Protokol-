import cron from "node-cron";
import { createLogger } from "@dacc/core";
interface MaintenanceJob {
  id: string;
  name: string;
  handler: string;
  cronExpr: string;
  config: unknown;
  status: string;
}
import { JobRegistry } from "./registry/job-registry.js";
import { runAuditSweep } from "./jobs/audit-sweep.job.js";
import { runRiskRecalc } from "./jobs/risk-recalc.job.js";
import { runCleanup } from "./jobs/cleanup.job.js";
import { runAssetHealthCheck } from "./jobs/asset-health-check.job.js";
import { runRiskTrendReport } from "./jobs/risk-trend-report.job.js";
import { runBrandChunkReindex } from "./jobs/brand-chunk-reindex.job.js";

const log = createLogger("cron-runner");

type JobHandler = (config: Record<string, unknown>) => Promise<void>;

export const HANDLER_MAP: Record<string, JobHandler> = {
  "auditor:audit-sweep": (c) => runAuditSweep(c as { batchSize?: number }),
  "auditor:risk-recalc": (c) => runRiskRecalc(c as { stalenessHours?: number }),
  "scheduler:cleanup": (c) => runCleanup(c as { retentionDays?: number }),
  "scheduler:asset-health-check": (c) => runAssetHealthCheck(c as { batchSize?: number }),
  "scheduler:risk-trend-report": (c) => runRiskTrendReport(c),
  "scheduler:brand-chunk-reindex": (c) => runBrandChunkReindex(c as { staleDays?: number }),
};

export class CronRunner {
  private readonly registry = new JobRegistry();
  private readonly tasks: cron.ScheduledTask[] = [];

  async start(): Promise<void> {
    const jobs = await this.registry.loadEnabledJobs();

    for (const job of jobs) {
      this.scheduleJob(job);
    }

    log.info({ scheduledCount: this.tasks.length }, "Cron runner started");
  }

  private scheduleJob(job: MaintenanceJob): void {
    const handler = HANDLER_MAP[job.handler];
    if (!handler) {
      log.warn({ handler: job.handler }, "No handler registered for job");
      return;
    }

    const task = cron.schedule(job.cronExpr, async () => {
      log.info({ jobName: job.name }, "Running scheduled job");
      await this.registry.markRunStarted(job.id);
      try {
        await handler(job.config as Record<string, unknown>);
        await this.registry.markRunCompleted(job.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.error({ jobName: job.name, error: message }, "Job failed");
        await this.registry.markRunFailed(job.id, message);
      }
    });

    this.tasks.push(task);
    log.debug({ jobName: job.name, cronExpr: job.cronExpr }, "Job scheduled");
  }

  stop(): void {
    for (const task of this.tasks) {
      task.stop();
    }
    log.info("Cron runner stopped");
  }
}
