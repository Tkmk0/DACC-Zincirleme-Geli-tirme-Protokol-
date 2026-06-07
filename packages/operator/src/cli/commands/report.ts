import { Command } from "commander";
import chalk from "chalk";
import { OperatorSdkClient } from "../../sdk/client.js";
import { cliConfig } from "../../config/cli-config.js";
import { formatAuditTable, formatRiskBadge } from "../../formatters/table-formatter.js";
import { prisma } from "@dacc/core";

export const reportCommand = new Command("report")
  .description("Fetch the latest audit report for an asset")
  .argument("<assetId>", "Asset ID (or short prefix)")
  .option("--format <fmt>", "Output format: table|json", "table")
  .option("--limit <n>", "Number of audits to show", "10")
  .option("--tenant <id>", "Tenant ID")
  .action(
    async (
      assetId: string,
      opts: { format: string; limit: string; tenant?: string }
    ) => {
      const tenantId =
        opts.tenant ?? cliConfig.getTenantId() ?? process.env["DACC_TENANT_ID"];
      if (!tenantId) {
        console.error(chalk.red("Error: tenant ID required"));
        process.exit(1);
      }

      const sdk = new OperatorSdkClient({ tenantId, operatorId: "cli-user" });
      const limit = parseInt(opts.limit, 10);

      const audits = await sdk.getAuditHistory(assetId, limit);
      const riskScore = await sdk.getRiskScore(assetId);

      if (opts.format === "json") {
        console.log(JSON.stringify({ audits, riskScore }, null, 2));
        await prisma.$disconnect();
        return;
      }

      console.log(chalk.bold(`\nAudit History — Asset ${chalk.cyan(assetId.slice(0, 8))}\n`));

      if (riskScore) {
        const badge = formatRiskBadge(riskScore.level);
        console.log(
          `  Current Risk: ${badge}  Score: ${chalk.bold(String(Math.round(riskScore.score)))}  ` +
          `Calculated: ${chalk.dim(riskScore.calculatedAt.toLocaleString())}\n`
        );
      } else {
        console.log(chalk.dim("  No risk score calculated yet.\n"));
      }

      const rows = audits.map((a) => ({
        id: a.id,
        status: a.status,
        triggeredBy: a.triggeredBy,
        riskScore: null,
        riskLevel: null,
        startedAt: a.startedAt,
        completedAt: a.completedAt,
      }));

      console.log(formatAuditTable(rows));
      console.log();
      await prisma.$disconnect();
    }
  );
