#!/usr/bin/env node
// Gera public/api/health.json com metadados de build/version.
// Rodado no prebuild — o resultado é servido estaticamente pelo Vercel
// e roteado em /api/health via vercel.json.

import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const outDir = resolve(root, "public/api");
const outFile = resolve(outDir, "health.json");

function safeExec(cmd, fallback = "") {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return fallback;
  }
}

const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

const payload = {
  status: "ok",
  name: pkg.name,
  version: pkg.version,
  commit:
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    safeExec("git rev-parse HEAD", "unknown"),
  branch:
    process.env.VERCEL_GIT_COMMIT_REF ||
    process.env.GITHUB_REF_NAME ||
    safeExec("git rev-parse --abbrev-ref HEAD", "unknown"),
  builtAt: new Date().toISOString(),
  node: process.version,
  env: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
};

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, JSON.stringify(payload, null, 2) + "\n", "utf8");

console.log(`✓ health.json gerado: ${payload.version} @ ${payload.commit.slice(0, 7)}`);
