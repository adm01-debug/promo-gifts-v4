#!/usr/bin/env node
/**
 * Guard: `package.json` e `package-lock.json` estao em sincronia?
 *
 * POR QUE ISSO EXISTE
 * -------------------
 * Dependencias foram adicionadas ao `package.json` (@fontsource/*, pixelmatch) sem
 * regenerar o lock. `npm ci` — que e o que o CI usa — se recusa a instalar quando os
 * dois divergem:
 *
 *     npm ci can only install packages when your package.json and
 *     package-lock.json are in sync
 *
 * O step "Install dependencies" morre em 1 segundo e TODOS os steps seguintes
 * (typecheck, lint, testes, coverage) sao marcados como `skipped`. O workflow fica
 * vermelho, mas nao por causa de um teste: por causa do install. Na pratica o CI
 * inteiro para de checar qualquer coisa — Full CI, E2E, Credentials Audit, todos.
 *
 * E o mesmo padrao do `eslint.config.js` quebrado: um guard-rail que morre em silencio
 * e ninguem percebe. Este script faz a divergencia falhar cedo, no pre-commit, com uma
 * mensagem que diz exatamente o que rodar.
 *
 * Uso:
 *   node scripts/check-lockfile-sync.mjs
 *   -> exit 0: em sincronia
 *   -> exit 1: divergente (lista os pacotes e ensina a corrigir)
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();

let pkg;
let lock;
try {
  pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
} catch (e) {
  console.error(`  x nao consegui ler package.json: ${e.message}`);
  process.exit(1);
}
try {
  lock = JSON.parse(readFileSync(resolve(ROOT, 'package-lock.json'), 'utf8'));
} catch (e) {
  console.error(`  x nao consegui ler package-lock.json: ${e.message}`);
  process.exit(1);
}

const root = lock.packages?.[''];
if (!root) {
  console.error('  x package-lock.json sem a entrada raiz (packages[""]) — lock invalido.');
  process.exit(1);
}

const problems = [];

for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
  const declared = pkg[field] ?? {};
  const locked = root[field] ?? {};

  for (const [name, range] of Object.entries(declared)) {
    if (!(name in locked)) {
      problems.push(`${name} (${field}) esta no package.json mas nao no lock`);
    } else if (locked[name] !== range) {
      problems.push(`${name}: package.json pede ${range}, lock tem ${locked[name]}`);
    }
    // A entrada raiz pode listar o pacote sem que ele exista na arvore resolvida.
    if (name in locked && !lock.packages[`node_modules/${name}`]) {
      problems.push(`${name} nao foi resolvido na arvore do lock`);
    }
  }

  for (const name of Object.keys(locked)) {
    if (!(name in declared)) {
      problems.push(`${name} (${field}) esta no lock mas nao no package.json`);
    }
  }
}

if (problems.length > 0) {
  console.error('');
  console.error('  x package.json e package-lock.json estao DESSINCRONIZADOS.');
  console.error('');
  for (const p of problems.slice(0, 12)) console.error(`    - ${p}`);
  if (problems.length > 12) console.error(`    ... e mais ${problems.length - 12}`);
  console.error('');
  console.error('    `npm ci` (que o CI usa) se recusa a instalar nesse estado. O step de');
  console.error('    install morre e typecheck/lint/testes viram `skipped` — o CI inteiro');
  console.error('    para de checar qualquer coisa.');
  console.error('');
  console.error('    Corrija com:');
  console.error('      npm install --package-lock-only');
  console.error('    e comite o package-lock.json junto com o package.json.');
  console.error('');
  process.exit(1);
}

const total =
  Object.keys(pkg.dependencies ?? {}).length + Object.keys(pkg.devDependencies ?? {}).length;
console.log(`  ok package-lock.json em sincronia com package.json (${total} deps)`);
