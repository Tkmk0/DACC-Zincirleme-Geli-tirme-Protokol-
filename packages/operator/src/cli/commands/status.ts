import { Command } from "commander";
import chalk from "chalk";
import { fetch } from "undici";
import { cliConfig } from "../../config/cli-config.js";
import { createRedisClient, QUEUE_NAMES } from "@dacc/core";
import { Queue, type ConnectionOptions } from "bullmq";

export const statusCommand = new Command("status")
  .description("Show system status and queue depths")
  .option("--json", "Output as JSON")
  .action(async (opts: { json?: boolean }) => {
    const endpoint = cliConfig.getEndpoint();
    const redisUrl = process.env["REDIS_URL"] ?? "redis://localhost:6379";

    // Health check
    let health: Record<string, unknown> = { status: "unreachable" };
    try {
      const res = await fetch(`${endpoint}/health`, { signal: AbortSignal.timeout(5000) });
      health = (await res.json()) as Record<string, unknown>;
    } catch {
      // keep default
    }

    // Queue stats
    const redis = createRedisClient(redisUrl);
    const queueStats: Record<string, Record<string, number>> = {};

    for (const [name, queueName] of Object.entries(QUEUE_NAMES)) {
      try {
        const q = new Queue(queueName, { connection: redis as unknown as ConnectionOptions });
        const counts = await q.getJobCounts("waiting", "active", "failed", "completed");
        queueStats[name] = counts;
        await q.close();
      } catch {
        queueStats[name] = {};
      }
    }

    await redis.quit();

    if (opts.json) {
      console.log(JSON.stringify({ health, queues: queueStats }, null, 2));
      return;
    }

    const healthOk = health["status"] === "ok";
    const healthLine = healthOk
      ? chalk.green("● API healthy")
      : chalk.red("● API unreachable");

    console.log(chalk.bold("\nDacc System Status\n"));
    console.log(`  ${healthLine}  ${chalk.dim(endpoint)}`);
    if (healthOk && health["ts"]) {
      console.log(`  ${chalk.dim("Server time:")} ${health["ts"]}`);
    }

    console.log(chalk.bold("\n  Queue Depths\n"));
    for (const [name, counts] of Object.entries(queueStats)) {
      const waiting = counts["waiting"] ?? 0;
      const active = counts["active"] ?? 0;
      const failed = counts["failed"] ?? 0;
      const statusIcon =
        failed > 0 ? chalk.red("✗") : active > 0 ? chalk.yellow("↻") : chalk.green("✓");
      console.log(
        `  ${statusIcon} ${name.padEnd(24)} ` +
        `waiting:${chalk.cyan(String(waiting))}  ` +
        `active:${chalk.yellow(String(active))}  ` +
        `failed:${failed > 0 ? chalk.red(String(failed)) : chalk.dim("0")}`
      );
    }
    console.log();
  });
