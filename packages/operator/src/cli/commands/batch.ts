import { Command } from "commander";
import { readFileSync } from "fs";
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import { OperatorSdkClient } from "../../sdk/client.js";
import { cliConfig } from "../../config/cli-config.js";
import { prisma } from "@dacc/core";

const batchCommand = new Command("batch").description("Batch operations");

batchCommand
  .command("scan <file>")
  .description("Scan multiple URLs from a newline-separated file")
  .option("-p, --priority <level>", "Job priority: low|normal|high", "low")
  .option("--tenant <id>", "Tenant ID")
  .option("--json", "Output results as JSON")
  .action(
    async (
      file: string,
      opts: { priority: string; tenant?: string; json?: boolean }
    ) => {
      const tenantId =
        opts.tenant ?? cliConfig.getTenantId() ?? process.env["DACC_TENANT_ID"];
      if (!tenantId) {
        console.error(chalk.red("Error: tenant ID required"));
        process.exit(1);
      }

      let raw: string;
      try {
        raw = readFileSync(file, "utf-8");
      } catch {
        console.error(chalk.red(`Error: cannot read file ${file}`));
        process.exit(1);
      }

      const urls = raw
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"));

      if (urls.length === 0) {
        console.error(chalk.yellow("No valid URLs found in file"));
        process.exit(1);
      }

      console.log(chalk.bold(`\nBatch Scan — ${urls.length} URL(s)\n`));

      const sdk = new OperatorSdkClient({
        tenantId,
        operatorId: "cli-batch",
      });

      const priority = opts.priority as "low" | "normal" | "high";
      const spinner = ora(`Processing ${urls.length} URL(s)...`).start();
      const results = await sdk.batchScan(urls, { priority });
      spinner.stop();

      if (opts.json) {
        console.log(JSON.stringify(results, null, 2));
        await prisma.$disconnect();
        return;
      }

      const table = new Table({
        head: ["URL", "Audit Event ID", "Status"].map((h) => chalk.bold.cyan(h)),
        style: { compact: false },
      });

      let ok = 0;
      let fail = 0;
      for (const r of results) {
        if (r.error) {
          fail++;
          table.push([
            r.url.length > 50 ? r.url.slice(0, 47) + "..." : r.url,
            chalk.dim("—"),
            chalk.red(`✗ ${r.error}`),
          ]);
        } else {
          ok++;
          table.push([
            r.url.length > 50 ? r.url.slice(0, 47) + "..." : r.url,
            chalk.cyan(r.auditEventId.slice(0, 8)),
            chalk.green("✓ queued"),
          ]);
        }
      }

      console.log(table.toString());
      console.log(
        `\n  ${chalk.green(`${ok} queued`)}  ${fail > 0 ? chalk.red(`${fail} failed`) : ""}\n`
      );

      await prisma.$disconnect();
    }
  );

export { batchCommand };
