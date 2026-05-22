#!/usr/bin/env node
/**
 * Runner LIVE de testes de contrato — bate em Edge Functions reais e valida
 * shape de resposta. Fonte única de payloads: cada contrato exporta
 * `examples.valid[]` e `examples.invalid[]` em
 * `supabase/functions/_shared/contracts/<name>.contracts.ts`.
 *
 * Uso:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   CONTRACT_TEST_TOKEN=<service_role_or_jwt> \
 *   npm run test:contract
 *
 * Quando uma fixture inválida bate na Edge Function real, esperamos:
 *   - status 422 (VALIDATION_FAILED) ou 400 (INVALID_JSON / MISSING_BODY),
 *   - body com shape { code, message, fields[] }.
 *
 * Endpoints que requerem auth (JWT/service-role/webhook-secret) só rodam
 * quando o env apropriado está setado — caso contrário são pulados.
 */
import * as dotenv from 'dotenv';
import { readdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { register } from 'node:module';

dotenv.config();

// Permite import dinâmico de .ts via tsx loader (sem build step).
try {
  register('tsx/esm', pathToFileURL('./'));
} catch (err) {
  console.error(
    'tsx/esm loader não disponível. Instale dev dep `tsx` (já está em package.json) e rode com npm run test:contract.',
  );
  console.error(err);
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const CONTRACTS_DIR = join(
  REPO_ROOT,
  'supabase',
  'functions',
  '_shared',
  'contracts',
);

const SUPABASE_URL = process.env.SUPABASE_URL;
const TOKEN =
  process.env.CONTRACT_TEST_TOKEN ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  '';

if (!SUPABASE_URL) {
  console.error('⚠️  SUPABASE_URL não definido — abortando.');
  process.exit(2);
}

const HEADERS_PER_ENDPOINT = {
  'product-webhook': () => ({
    'x-webhook-secret': process.env.N8N_PRODUCT_WEBHOOK_SECRET || 'sim-secret',
  }),
  'webhook-dispatcher': () => ({
    'x-dispatcher-secret': process.env.WEBHOOK_DISPATCHER_SECRET || '',
  }),
  'webhook-inbound': () => ({ 'x-signature-256': '' }), // só envelope; HMAC falhará — esperado 401
};

function listContracts() {
  return readdirSync(CONTRACTS_DIR)
    .filter((f) => f.endsWith('.contracts.ts'))
    .filter((f) => !f.startsWith('error-response') && !f.startsWith('versioning'))
    .map((f) => ({ file: f, name: f.replace(/\.contracts\.ts$/, '') }));
}

function isErrorShape(body) {
  return (
    body &&
    typeof body === 'object' &&
    typeof body.code === 'string' &&
    typeof body.message === 'string' &&
    Array.isArray(body.fields)
  );
}

async function callFunction(name, payload) {
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/${name}`;
  const extra = HEADERS_PER_ENDPOINT[name]?.() ?? {};
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: TOKEN ? `Bearer ${TOKEN}` : '',
      ...extra,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { __raw: text };
  }
  return { status: res.status, body };
}

let passed = 0;
let failed = 0;
const failures = [];

for (const { file, name } of listContracts()) {
  process.stdout.write(`\n📦 ${name}\n`);
  let mod;
  try {
    mod = await import(pathToFileURL(join(CONTRACTS_DIR, file)).href);
  } catch (err) {
    console.error(`  💥 falha ao importar ${file}: ${err.message}`);
    failed++;
    continue;
  }
  const registry = mod.contracts;
  if (!registry || !registry.v1) {
    console.warn(`  ⚠️  ${file} sem registry v1 — skipping`);
    continue;
  }

  // Casos inválidos — esperamos 422 com shape canônico (ou 400 para casos
  // que o gateway interceptar antes do schema).
  for (const { payload, expectedPath } of registry.v1.examples?.invalid ?? []) {
    try {
      const { status, body } = await callFunction(name, payload);
      const ok =
        (status === 422 || status === 400) &&
        isErrorShape(body) &&
        (!expectedPath || body.fields.some((f) => f.path === expectedPath));
      if (ok) {
        process.stdout.write(`  ✅ invalid → ${status} ${body.code}\n`);
        passed++;
      } else {
        process.stdout.write(`  ❌ invalid → ${status} ${JSON.stringify(body).slice(0, 200)}\n`);
        failed++;
        failures.push({ name, type: 'invalid', payload, status, body });
      }
    } catch (err) {
      process.stdout.write(`  💥 ${err.message}\n`);
      failed++;
    }
  }
}

console.log('\n--- RESULTADO ---');
console.log(`✅ ${passed}`);
console.log(`❌ ${failed}`);
console.log('-----------------\n');
if (failed > 0) {
  console.log(JSON.stringify(failures, null, 2));
  process.exit(1);
}
