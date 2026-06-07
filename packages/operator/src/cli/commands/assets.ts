import { Command } from "commander";
import chalk from "chalk";
import { OperatorSdkClient } from "../../sdk/client.js";
import { cliConfig } from "../../config/cli-config.js";
import { formatAssetTable, formatRiskBadge, formatKeyValue } from "../../formatters/table-formatter.js";
import { prisma } from "@dacc/core";

const assetsCommand = new Command("assets").description("Manage digital assets");

assetsCommand
  .command("list")
  .description("List assets for the current tenant")
  .option("--status <status>", "Filter by status: ACTIVE|PENDING|UNREACHABLE|ARCHIVED")
  .option("--limit <n>", "Max results", "20")
  .option("--tenant <id>", "Tenant ID")
  .option("--json", "Output as JSON")
  .action(async (opts: { status?: string; limit: string; tenant?: string; json?: boolean }) => {
    const tenantId =
      opts.tenant ?? cliConfig.getTenantId() ?? process.env["DACC_TENANT_ID"];
    if (!tenantId) {
      console.error(chalk.red("Error: tenant ID required"));
      process.exit(1);
    }

    const sdk = new OperatorSdkClient({ tenantId, operatorId: "cli-user" });
    const assets = await sdk.listAssets({
      ...(opts.status !== undefined ? { status: opts.status } : {}),
      limit: parseInt(opts.limit, 10),
    });

    if (opts.json) {
      console.log(JSON.stringify(assets, null, 2));
      await prisma.$disconnect();
      return;
    }

    console.log(chalk.bold(`\nAssets — Tenant ${chalk.cyan(tenantId.slice(0, 8))}\n`));
    console.log(
      formatAssetTable(
        assets.map((a) => ({
          id: a.id,
          url: a.url,
          domain: a.domain,
          status: a.status,
          type: a.type,
          lastSeenAt: a.lastSeenAt,
        }))
      )
    );
    console.log(chalk.dim(`\n  ${assets.length} asset(s) shown\n`));
    await prisma.$disconnect();
  });

assetsCommand
  .command("show <assetId>")
  .description("Show details for a specific asset")
  .option("--tenant <id>", "Tenant ID")
  .action(async (assetId: string, opts: { tenant?: string }) => {
    const tenantId =
      opts.tenant ?? cliConfig.getTenantId() ?? process.env["DACC_TENANT_ID"];
    if (!tenantId) {
      console.error(chalk.red("Error: tenant ID required"));
      process.exit(1);
    }

    const sdk = new OperatorSdkClient({ tenantId, operatorId: "cli-user" });
    const asset = await sdk.getAsset(assetId);
    if (!asset) {
      console.error(chalk.red(`Asset ${assetId} not found`));
      await prisma.$disconnect();
      process.exit(1);
    }

    const riskScore = await sdk.getRiskScore(asset.id);

    console.log(chalk.bold(`\nAsset Detail — ${chalk.cyan(asset.id.slice(0, 8))}\n`));
    console.log(
      formatKeyValue({
        ID: asset.id,
        URL: asset.url,
        Domain: asset.domain,
        Type: asset.type,
        Status: asset.status,
        "Created At": asset.createdAt.toLocaleString(),
        "Last Seen": asset.lastSeenAt?.toLocaleString() ?? "(never)",
        Risk: riskScore ? `${formatRiskBadge(riskScore.level)} (score: ${Math.round(riskScore.score)})` : "(none)",
      })
    );
    console.log();
    await prisma.$disconnect();
  });

export { assetsCommand };
