import { createLogger } from "@dacc/core";
import { CronRunner } from "./cron-runner.js";
import { startManualRunWorker } from "./workers/manual-run.worker.js";

const log = createLogger("scheduler");
const runner = new CronRunner();
const manualRunWorker = startManualRunWorker();

runner.start().then(() => {
  log.info("DACC Scheduler started");
}).catch((err) => {
  log.error({ err }, "Scheduler failed to start");
  process.exit(1);
});

process.on("SIGTERM", async () => {
  runner.stop();
  await manualRunWorker.close();
  process.exit(0);
});
