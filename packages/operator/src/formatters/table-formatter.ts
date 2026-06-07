import chalk from "chalk";
import Table from "cli-table3";

export interface AssetRow {
  id: string;
  url: string;
  domain: string;
  status: string;
  type: string;
  lastSeenAt?: Date | null;
}

export interface AuditRow {
  id: string;
  status: string;
  triggeredBy: string;
  riskScore?: number | null;
  riskLevel?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
}

const RISK_COLORS: Record<string, (s: string) => string> = {
  NONE: chalk.gray,
  LOW: chalk.green,
  MEDIUM: chalk.yellow,
  HIGH: chalk.red,
  CRITICAL: (s: string) => chalk.bgRed.white.bold(s),
};

const STATUS_COLORS: Record<string, (s: string) => string> = {
  ACTIVE: chalk.green,
  PENDING: chalk.yellow,
  UNREACHABLE: chalk.red,
  ARCHIVED: chalk.gray,
  COMPLETED: chalk.green,
  RUNNING: chalk.cyan,
  QUEUED: chalk.yellow,
  FAILED: chalk.red,
  SKIPPED: chalk.gray,
};

export function formatRiskBadge(level: string): string {
  const color = RISK_COLORS[level] ?? chalk.white;
  const symbols: Record<string, string> = {
    NONE: "○",
    LOW: "◔",
    MEDIUM: "◑",
    HIGH: "◕",
    CRITICAL: "●",
  };
  return color(`${symbols[level] ?? "?"} ${level}`);
}

function colorStatus(status: string): string {
  const fn = STATUS_COLORS[status] ?? chalk.white;
  return fn(status);
}

export function formatAssetTable(assets: AssetRow[]): string {
  if (assets.length === 0) return chalk.gray("No assets found.");

  const table = new Table({
    head: ["ID (short)", "URL", "Domain", "Type", "Status", "Last Seen"].map(
      (h) => chalk.bold.cyan(h)
    ),
    style: { compact: false },
  });

  for (const a of assets) {
    table.push([
      chalk.dim(a.id.slice(0, 8)),
      a.url.length > 45 ? a.url.slice(0, 42) + "..." : a.url,
      a.domain,
      chalk.blue(a.type),
      colorStatus(a.status),
      a.lastSeenAt ? new Date(a.lastSeenAt).toLocaleString() : chalk.dim("never"),
    ]);
  }

  return table.toString();
}

export function formatAuditTable(audits: AuditRow[]): string {
  if (audits.length === 0) return chalk.gray("No audits found.");

  const table = new Table({
    head: ["ID (short)", "Status", "Risk", "Score", "Triggered By", "Completed At"].map(
      (h) => chalk.bold.cyan(h)
    ),
    style: { compact: false },
  });

  for (const a of audits) {
    table.push([
      chalk.dim(a.id.slice(0, 8)),
      colorStatus(a.status),
      a.riskLevel ? formatRiskBadge(a.riskLevel) : chalk.dim("—"),
      a.riskScore != null ? String(Math.round(a.riskScore)) : chalk.dim("—"),
      chalk.dim(a.triggeredBy),
      a.completedAt ? new Date(a.completedAt).toLocaleString() : chalk.dim("—"),
    ]);
  }

  return table.toString();
}

export function formatKeyValue(pairs: Record<string, string | undefined>): string {
  const lines = Object.entries(pairs).map(([k, v]) => {
    const key = chalk.bold.cyan(k.padEnd(16));
    const val = v ? chalk.white(v) : chalk.dim("(not set)");
    return `  ${key} ${val}`;
  });
  return lines.join("\n");
}

export function formatScanResult(result: {
  auditEventId: string;
  sessionId: string;
  url: string;
}): string {
  return [
    chalk.green("✓ Scan queued successfully"),
    `  ${chalk.bold("URL")}            ${result.url}`,
    `  ${chalk.bold("Audit Event ID")} ${chalk.cyan(result.auditEventId)}`,
    `  ${chalk.bold("Session ID")}     ${chalk.dim(result.sessionId)}`,
  ].join("\n");
}
