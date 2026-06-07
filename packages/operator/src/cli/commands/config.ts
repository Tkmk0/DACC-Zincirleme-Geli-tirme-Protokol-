import { Command } from "commander";
import chalk from "chalk";
import { cliConfig } from "../../config/cli-config.js";
import { formatKeyValue } from "../../formatters/table-formatter.js";

const configCommand = new Command("config").description("Manage DACC CLI configuration");

configCommand
  .command("set-key <apiKey>")
  .description("Set the API key for authentication")
  .action((apiKey: string) => {
    cliConfig.set("apiKey", apiKey);
    console.log(chalk.green("✓ API key saved"));
  });

configCommand
  .command("set-endpoint <url>")
  .description("Set the DACC API endpoint URL")
  .action((url: string) => {
    try {
      new URL(url);
    } catch {
      console.error(chalk.red("Error: invalid URL"));
      process.exit(1);
    }
    cliConfig.set("endpoint", url);
    console.log(chalk.green(`✓ Endpoint set to ${url}`));
  });

configCommand
  .command("set-tenant <tenantId>")
  .description("Set the default tenant ID")
  .action((tenantId: string) => {
    cliConfig.set("tenantId", tenantId);
    console.log(chalk.green("✓ Tenant ID saved"));
  });

configCommand
  .command("show")
  .description("Show current configuration")
  .action(() => {
    const all = cliConfig.getAll();
    const display: Record<string, string | undefined> = {
      apiKey: all.apiKey ? all.apiKey.slice(0, 8) + "..." : undefined,
      endpoint: all.endpoint,
      tenantId: all.tenantId,
    };
    console.log(chalk.bold("\nDacc CLI Configuration\n"));
    console.log(formatKeyValue(display));
    console.log();
  });

configCommand
  .command("clear")
  .description("Clear all stored configuration")
  .action(() => {
    cliConfig.clear();
    console.log(chalk.yellow("✓ Configuration cleared"));
  });

export { configCommand };
