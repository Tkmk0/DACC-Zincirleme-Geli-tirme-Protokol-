import {
  Queue,
  Worker,
  type Processor,
  type WorkerOptions,
  type JobsOptions,
  type ConnectionOptions,
} from "bullmq";
import type { QueueName } from "./queue-names.js";
import type { DaccEvent } from "./event-types.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("event-bus");

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 1000 },
  removeOnComplete: { count: 500 },
  removeOnFail: { count: 1000 },
};

// ─── Producer ─────────────────────────────────────────────────────────────

export function createProducer(queueName: QueueName, connection: ConnectionOptions | object) {
  const queue = new Queue(queueName, { connection });

  return {
    async publish(
      event: DaccEvent,
      opts?: { priority?: number }
    ): Promise<void> {
      const jobOpts: JobsOptions = { ...DEFAULT_JOB_OPTIONS };
      if (opts?.priority !== undefined) jobOpts.priority = opts.priority;
      await queue.add(event.type, event, jobOpts);
      log.debug(
        { eventId: event.eventId, type: event.type, queue: queueName },
        "Event published"
      );
    },
    async close(): Promise<void> {
      await queue.close();
    },
  };
}

export type EventProducer = ReturnType<typeof createProducer>;

// ─── Consumer ─────────────────────────────────────────────────────────────

export function createConsumer<T extends DaccEvent>(
  queueName: QueueName,
  processor: Processor<T>,
  connection: ConnectionOptions | object,
  opts?: Partial<WorkerOptions>
): Worker<T> {
  const worker = new Worker<T>(queueName, processor, {
    connection: connection as ConnectionOptions,
    concurrency: opts?.concurrency ?? 5,
    ...opts,
  });

  worker.on("failed", (job, err) => {
    log.error(
      { jobId: job?.id, queue: queueName, error: err.message },
      "Job failed"
    );
  });

  worker.on("stalled", (jobId) => {
    log.warn({ jobId, queue: queueName }, "Job stalled");
  });

  return worker;
}
