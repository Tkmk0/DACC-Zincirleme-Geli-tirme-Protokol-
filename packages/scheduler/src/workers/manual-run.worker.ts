import {
  createConsumer,
  createRedisClient,
  QUEUE_NAMES,
  env,
  createLogger,
  prisma,
  type MaintenanceRunEvent,
} from "@dacc/core";
import { HANDLER_MAP } from "../cron-runner.js";
import { JobRegistry } from "../registry/job-registry.js";

const log = createLogger("manual-run.worker");

export function startManualRunWorker(): { close(): Promise<void> } {
  const connection = createRedisClient(env.REDIS_URL);
  const registry = new JobRegistry();

  return createConsumer<MaintenanceRunEvent>(
    QUEUE_NAMES.MAINTENANCE,
    async (job) => {
      const event = job.data;
      const { jobId, handler } = event.payload;

      const handlerFn = HANDLER_MAP[handler];
      if (!handlerFn) {
        log.warn({ handler }, "No handler found for manual run");
        return;
      }

      const dbJob = await prisma.maintenanceJob.findUnique({ where: { id: jobId } });
      if (!dbJob) {
        log.warn({ jobId }, "Job not found for manual run");
        return;
      }

      log.info({ jobId, handler }, "Executing manual job run");
      await registry.markRunStarted(jobId);

      try {
        await handlerFn((dbJob.config as Record<string, unknown>) ?? {});
        await registry.markRunCompleted(jobId);
        log.info({ jobId, handler }, "Manual run completed");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.error({ jobId, handler, error: message }, "Manual run failed");
        await registry.markRunFailed(jobId, message);
      }
    },
    connection as object,
    { concurrency: 1 }
  );
}
