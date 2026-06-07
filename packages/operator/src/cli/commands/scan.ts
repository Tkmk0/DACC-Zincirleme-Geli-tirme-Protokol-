import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import { OperatorSdkClient } from "../../sdk/client.js";
import { cliConfig } from "../../config/cli-config.js";
import { formatScanResult } from "../../formatters/table-formatter.js";
import { prisma } from "@dacc/core";

function resolveConfig(opts: { tenant?: string }): { tenantId: string; operatorId: string } {
  const tenantId =
    opts.tenant ?? cliConfig.getTenantId() ?? process.env["DACC_TENANT_ID"];
  if (!tenantId) {
    console.error(
      chalk.red("Error: tenant ID required. Use --tenant, dacc config set-tenant, or DACC_TENANT_ID env.")
    );
    process.exit(1);
  }
  return { tenantId, operatorId: process.env["DACC_OPERATOR_ID"] ?? "cli-user" };
}

export const scanCommand = new Command("scan")
  .description("Trigger an SEO audit scan for a URL or domain")
  .argument("<url>", "Target URL or domain to scan")
  .option("-p, --priority <level>", "Job priority: low|normal|high", "normal")
  .option("--tenant <id>", "Tenant ID")
  .option("--watch", "Poll until audit completes (60s timeout)")
  .action(
    async (
      url: string,
      opts: { priority: string; tenant?: string; watch?: boolean }
    ) => {
      const { tenantId, operatorId } = resolveConfig(opts);

      const priority = opts.priority as "low" | "normal" | "high";
      const sdk = new OperatorSdkClient({ tenantId, operatorId });

      const spinner = ora(`Queuing scan for ${chalk.cyan(url)}...`).start();

      let result: { auditEventId: string; sessionId: string } | undefined;
      try {
        result = await sdk.triggerScan(url, { priority });
        spinner.succeed(chalk.green("Scan queued"));
      } catch (err) {
        spinner.fail(chalk.red("Failed to queue scan"));
        console.error(err instanceof Error ? err.message : err);
        await prisma.$disconnect();
        process.exit(1);
      }

      if (!result) {
        await prisma.$disconnect();
        process.exit(1);
      }

      console.log("\n" + formatScanResult({ ...result, url }));

      if (opts.watch) {
        const watchSpinner = ora("Waiting for audit to complete...").start();
        const deadline = Date.now() + 60_000;
        let done = false;

        while (Date.now() < deadline && !done) {
          await new Promise((r) => setTimeout(r, 3000));
          const audit = await prisma.auditEvent.findUnique({
            where: { id: result.auditEventId },
            select: { status: true, completedAt: true },
          });

          if (!audit) break;

          if (audit.status === "COMPLETED" || audit.status === "FAILED") {
            done = true;
            if (audit.status === "COMPLETED") {
              watchSpinner.succeed(chalk.green(`Audit completed at ${audit.completedAt?.toLocaleString()}`));
            } else {
              watchSpinner.fail(chalk.red("Audit failed"));
            }
          } else {
            watchSpinner.text = `Audit status: ${chalk.yellow(audit.status)}...`;
          }
        }

        if (!done) {
          watchSpinner.warn(chalk.yellow("Timed out waiting for audit (60s)"));
        }
      }

      await prisma.$disconnect();
    }
  );
