#!/usr/bin/env tsx
/**
 * One-time setup: copies .env.example to .env if it doesn't exist.
 * Run: pnpm tsx scripts/setup-env.ts
 */
import { existsSync, copyFileSync } from "fs";
import { join } from "path";

const root = join(import.meta.dirname, "..");
const source = join(root, ".env.example");
const target = join(root, ".env");

if (existsSync(target)) {
  console.log(".env already exists — skipped.");
} else {
  copyFileSync(source, target);
  console.log(".env created from .env.example — edit it before starting services.");
}
