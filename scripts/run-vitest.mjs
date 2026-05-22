#!/usr/bin/env node
// Cross-platform vitest launcher that forces TZ before workers spawn.
//
// Why a wrapper instead of `vitest run`:
//   vitest's config-level `test.env: { TZ: ... }` only stubs process.env in
//   the worker after Date.prototype.toLocaleString has already cached the TZ
//   (see comment in vitest.config.ts). Setting TZ in the parent process here
//   guarantees it propagates to the worker spawn, so snapshot files that
//   were generated under America/Sao_Paulo stay reproducible regardless of
//   the host clock (CI Ubuntu UTC, dev BRT, etc.).
//
// Args passthrough: anything after the script name is forwarded verbatim to
// vitest. e.g. `node scripts/run-vitest.mjs run --coverage`.

import { spawn } from 'node:child_process';

const env = { ...process.env };
if (!env.TZ) {
  env.TZ = 'America/Sao_Paulo';
}

const args = process.argv.slice(2);
const child = spawn('npx', ['vitest', ...args], {
  stdio: 'inherit',
  env,
  shell: true,
});

child.on('close', (code) => {
  process.exit(code ?? 1);
});

child.on('error', (err) => {
  console.error('Failed to launch vitest:', err);
  process.exit(1);
});
