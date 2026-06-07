#!/usr/bin/env node
import { Command } from "commander";
import { scanCommand } from "./commands/scan.js";
import { reportCommand } from "./commands/report.js";
import { statusCommand } from "./commands/status.js";
import { configCommand } from "./commands/config.js";
import { assetsCommand } from "./commands/assets.js";
import { batchCommand } from "./commands/batch.js";

const program = new Command();

program
  .name("dacc")
  .description("Digital Asset Command Center — Operator CLI")
  .version("0.0.1");

program.addCommand(scanCommand);
program.addCommand(reportCommand);
program.addCommand(statusCommand);
program.addCommand(configCommand);
program.addCommand(assetsCommand);
program.addCommand(batchCommand);

program.parse(process.argv);
