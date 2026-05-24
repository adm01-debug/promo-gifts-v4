#!/usr/bin/env node
/**
 * run-smoke-filtered — wrapper opcional do `test:e2e:smoke` com filtro por tag/título.
 *
 * Por quê: o project `chromium-smoke` já isola pelo grep `/@smoke/` (vide
 * playwright.config.ts). Este wrapper ADICIONA um filtro extra (`--grep <X>`)
 * que se combina via AND com o grep do project — sem afetar a regression,
 * pois nunca toca em outros projects.
 *
 * Uso:
 *   npm run test:e2e:smoke -- --tag favoritos
 *   npm run test:e2e:smoke -- --tag @smoke-cart
 *   npm run test:e2e:smoke -- --tag "Catálogo|Busca"        # regex
 *   npm run test:e2e:smoke -- --tag favoritos --headed      # flags extras passam adiante
 *   npm run test:e2e:smoke                                   # sem --tag → roda smoke completo
 *
 * Sai com o exit code do Playwright.
 */
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const passthrough = [];
let tag = null;
const PLAYWRIGHT_BIN = join(process.cwd(), 'node_modules', '@playwright', 'test', 'cli.js');

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--tag' || a === '-t') {
    tag = argv[++i];
  } else if (a.startsWith('--tag=')) {
    tag = a.slice('--tag='.length);
  } else {
    passthrough.push(a);
  }
}

const args = [PLAYWRIGHT_BIN, 'test', '--project=chromium-smoke', '--workers=1'];

if (tag && tag.trim()) {
  // combina via AND com o grep do project (`/@smoke/`)
  args.push(`--grep=${tag.trim()}`);
  console.log(`\n🎯 Smoke filtrado por: ${tag.trim()}\n`);
} else {
  console.log(`\n🚬 Smoke completo (sem filtro)\n`);
}

args.push(...passthrough);

const child = spawn(process.execPath, args, { stdio: 'inherit', shell: false });
child.on('exit', (code) => process.exit(code ?? 1));
child.on('error', (err) => {
  console.error('❌ Falha ao iniciar Playwright:', err.message);
  process.exit(1);
});
