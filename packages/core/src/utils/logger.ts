import pino, { type Logger } from "pino";

const rootLogger = pino({
  level: process.env["LOG_LEVEL"] ?? "info",
  ...(process.env["NODE_ENV"] === "development"
    ? { transport: { target: "pino-pretty" } }
    : {}),
});

export function createLogger(name: string): Logger {
  return rootLogger.child({ module: name });
}

export { rootLogger };
