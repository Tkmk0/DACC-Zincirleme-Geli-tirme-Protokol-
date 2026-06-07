import { Redis } from "ioredis";
import { createLogger } from "./logger.js";

const log = createLogger("redis");

export function createRedisClient(url: string): Redis {
  const client = new Redis(url, {
    maxRetriesPerRequest: null, // required for BullMQ
    retryStrategy: (times: number) => Math.min(times * 500, 5000),
    lazyConnect: false,
  });

  client.on("connect", () => log.info("Redis connected"));
  client.on("error", (err: Error) => log.error({ err }, "Redis error"));
  client.on("reconnecting", () => log.warn("Redis reconnecting"));

  return client;
}
