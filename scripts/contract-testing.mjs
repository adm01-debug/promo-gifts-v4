#!/usr/bin/env node
/**
 * scripts/contract-testing.mjs
 *
 * Smoke contract tests dispatched against running Edge Functions.
 *
 * Diferente do unitário vitest (`tests/contracts/*.test.ts`), este script:
 *   - É executado fora da CI (manualmente ou via `npm run test:contract`)
 *   - Faz HTTP real contra o ambiente alvo (default: localhost supabase functions)
 *   - Verifica que o formato de resposta {code, message, fields} é respeitado
 *   - Testa: payload válido, missing body, invalid JSON, missing field, wrong type,
 *     unsupported version, deprecated version (headers Deprecation/Sunset)
 *
 * Variáveis de ambiente:
 *   SUPABASE_URL                 default http://localhost:54321
 *   SUPABASE_ANON_KEY            obrigatório
 *   N8N_PRODUCT_WEBHOOK_SECRET   se setado, enviado em x-webhook-secret
 *   CONTRACT_TEST_TIMEOUT_MS     default 10000
 *
 * Códigos de saída:
 *   0 → todos os contratos passaram
 *   1 → ao menos um falhou (detalhes no stdout)
 *   2 → variável de ambiente obrigatória ausente
 */

import { createHmac } from 'node:crypto';
import process from 'node:process';

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const PRODUCT_WEBHOOK_SECRET = process.env.N8N_PRODUCT_WEBHOOK_SECRET || '';
const TIMEOUT_MS = Number(process.env.CONTRACT_TEST_TIMEOUT_MS || 10000);
const CONTRACT_USER_AGENT = 'PromoGiftsContractSmoke/1.0';
const UPSTREAM_RETRY_COUNT = Number(process.env.CONTRACT_TEST_UPSTREAM_RETRIES || 8);
const UPSTREAM_RETRY_DELAY_MS = Number(process.env.CONTRACT_TEST_UPSTREAM_RETRY_DELAY_MS || 1000);
const TRANSIENT_UPSTREAM_STATUSES = new Set([502, 503, 504]);

if (!ANON_KEY) {
  console.error('❌ SUPABASE_ANON_KEY (ou SERVICE_ROLE_KEY) é obrigatório.');
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Definição dos contratos
// ---------------------------------------------------------------------------

const CONTRACTS = [
  {
    name: 'product-webhook',
    endpoint: 'product-webhook',
    signProductWebhook: true,
    scenarios: [
      {
        description: 'valid payload v1 (explicit)',
        headers: { 'accept-version': '1' },
        payload: {
          action: 'upsert',
          product: { sku: `CT-${Date.now()}`, name: 'Contract test', price: 1.0 },
        },
        expect: { status: 200, deprecation: true, version: '1' },
      },
      {
        description: 'missing body → 400 missing_body',
        headers: { 'accept-version': '1' },
        rawBody: '',
        expect: { status: 400, code: 'missing_body' },
      },
      {
        description: 'invalid JSON → 400 invalid_json',
        headers: { 'accept-version': '1' },
        rawBody: '{not-json',
        expect: { status: 400, code: 'invalid_json' },
      },
      {
        description: 'invalid action enum → 422 validation_failed',
        headers: { 'accept-version': '1' },
        payload: {
          action: 'explode',
          product: { sku: 'X', name: 'Y', price: 1 },
        },
        expect: {
          status: 422,
          code: 'validation_failed',
          fieldPaths: ['action'],
        },
      },
      {
        description: 'wrong type in price → 422',
        headers: { 'accept-version': '1' },
        payload: {
          action: 'upsert',
          product: { sku: 'X', name: 'Y', price: 'free' },
        },
        expect: {
          status: 422,
          code: 'validation_failed',
          fieldPaths: ['product.price'],
        },
      },
      {
        description: 'unsupported version → 406',
        headers: { 'accept-version': '99' },
        payload: { action: 'upsert', product: { sku: 'X', name: 'Y', price: 1 } },
        expect: { status: 406, code: 'unsupported_version' },
      },
      {
        description: 'v2 valid with idempotency_key → 200, no deprecation',
        headers: { 'accept-version': '2' },
        payload: {
          action: 'upsert',
          idempotency_key: '11111111-2222-3333-4444-555555555555',
          product: {
            external_id: 'ct-ext',
            sku: `CT2-${Date.now()}`,
            name: 'Contract v2',
            price: 1.0,
          },
        },
        expect: { status: 200, deprecation: false, version: '2' },
      },
    ],
  },
  {
    name: 'webhook-dispatcher',
    endpoint: 'webhook-dispatcher',
    extraHeaders: process.env.WEBHOOK_DISPATCHER_SECRET
      ? { 'x-dispatcher-secret': process.env.WEBHOOK_DISPATCHER_SECRET }
      : {},
    scenarios: [
      {
        description: 'v1 event-only → ok or dispatched',
        headers: { 'accept-version': '1' },
        payload: { event: 'contract.test', payload: { hello: 'world' } },
        expect: { statusIn: [200, 401] }, // 401 se dispatcher secret faltar
      },
      {
        description: 'v1 empty event → 422',
        headers: { 'accept-version': '1' },
        payload: { event: '' },
        expect: { status: 422, code: 'validation_failed', fieldPaths: ['event'] },
      },
      {
        description: 'v2 mode=replay sem UUID → 422',
        headers: { 'accept-version': '2' },
        payload: { mode: 'replay', replay_delivery_id: 'abc' },
        expect: { status: 422, code: 'validation_failed' },
      },
    ],
  },
  {
    name: 'webhook-inbound',
    endpoint: 'webhook-inbound?slug=contract-test-slug',
    extraHeaders: {},
    scenarios: [
      {
        description: 'unknown slug → 404',
        headers: { 'accept-version': '1' },
        payload: { hello: 'world' },
        expect: { statusIn: [404, 400] },
      },
      {
        description: 'empty body → 400 missing_body',
        headers: { 'accept-version': '1' },
        rawBody: '',
        expect: { statusIn: [400, 404] }, // 404 vem antes de body check
      },
      {
        description: 'v2 valid envelope (will fail at HMAC, but contract passes)',
        headers: { 'accept-version': '2' },
        payload: {
          event: 'contract.test',
          occurred_at: new Date().toISOString(),
          data: { ping: true },
        },
        expect: { statusIn: [200, 401, 404] },
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function runScenario(contract, scenario) {
  const url = `${SUPABASE_URL}/functions/v1/${contract.endpoint}`;
  const body = scenario.rawBody !== undefined ? scenario.rawBody : JSON.stringify(scenario.payload);
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': CONTRACT_USER_AGENT,
    Authorization: `Bearer ${ANON_KEY}`,
    ...(contract.extraHeaders ?? {}),
    ...(scenario.headers ?? {}),
  };

  if (contract.signProductWebhook && PRODUCT_WEBHOOK_SECRET) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = `contract-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const signature = createHmac('sha256', PRODUCT_WEBHOOK_SECRET)
      .update(`${timestamp}.${nonce}.${body}`)
      .digest('hex');

    headers['x-webhook-timestamp'] = timestamp;
    headers['x-webhook-nonce'] = nonce;
    headers['x-webhook-signature'] = `sha256=${signature}`;
  }

  let res;
  let text = '';
  try {
    for (let attempt = 0; attempt <= UPSTREAM_RETRY_COUNT; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        res = await fetch(url, { method: 'POST', headers, body, signal: controller.signal });
        text = await res.text();
      } finally {
        clearTimeout(timer);
      }

      if (!TRANSIENT_UPSTREAM_STATUSES.has(res.status) || attempt === UPSTREAM_RETRY_COUNT) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, UPSTREAM_RETRY_DELAY_MS));
    }
  } catch (err) {
    return { ok: false, reason: `fetch error: ${err.message}` };
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  // 1. Status check
  if (scenario.expect.status !== undefined && res.status !== scenario.expect.status) {
    return {
      ok: false,
      reason: `status: expected ${scenario.expect.status}, got ${res.status} body=${text.slice(0, 200)}`,
    };
  }
  if (scenario.expect.statusIn && !scenario.expect.statusIn.includes(res.status)) {
    return {
      ok: false,
      reason: `status not in ${scenario.expect.statusIn.join('|')}, got ${res.status}`,
    };
  }

  // 2. Error code check
  if (scenario.expect.code) {
    if (!json || json.code !== scenario.expect.code) {
      return {
        ok: false,
        reason: `code: expected "${scenario.expect.code}", got ${json?.code ?? '<no body>'}`,
      };
    }
    if (!Array.isArray(json.fields)) {
      return { ok: false, reason: 'response missing fields[]' };
    }
  }

  // 3. Field path check
  if (scenario.expect.fieldPaths) {
    const paths = (json?.fields ?? []).map((f) => f.path);
    for (const expected of scenario.expect.fieldPaths) {
      if (!paths.includes(expected)) {
        return {
          ok: false,
          reason: `expected field path "${expected}" not in ${JSON.stringify(paths)}`,
        };
      }
    }
  }

  // 4. Version headers
  if (scenario.expect.version !== undefined) {
    const v = res.headers.get('x-contract-version');
    if (v !== scenario.expect.version) {
      return {
        ok: false,
        reason: `x-contract-version: expected "${scenario.expect.version}", got "${v}"`,
      };
    }
  }
  if (scenario.expect.deprecation === true) {
    if (res.headers.get('Deprecation') !== 'true') {
      return { ok: false, reason: 'missing Deprecation: true header' };
    }
    if (!res.headers.get('Sunset')) {
      return { ok: false, reason: 'missing Sunset header' };
    }
  }
  if (scenario.expect.deprecation === false) {
    if (res.headers.get('Deprecation') === 'true') {
      return { ok: false, reason: 'unexpected Deprecation header on non-deprecated version' };
    }
  }

  return { ok: true };
}



async function runCriticalConcurrentChecks() {
  const runs = Number(process.env.CONTRACT_CRITICAL_CONCURRENCY || 20);
  const rounds = Number(process.env.CONTRACT_CRITICAL_ROUNDS || 3);
  console.log(`
⚡ Concurrent critical endpoint checks (runs=${runs}, rounds=${rounds})`);

  const productContract = CONTRACTS.find((c) => c.name === 'product-webhook');
  const dispatcherContract = CONTRACTS.find((c) => c.name === 'webhook-dispatcher');
  if (!productContract || !dispatcherContract) return { passed: 0, failed: 1 };

  let passed = 0;
  let failed = 0;

  for (let round = 1; round <= rounds; round++) {
    const key = `00000000-0000-4000-8000-${String(round).padStart(12, '0')}`;
    const idemScenario = {
      description: `idempotent upsert burst #${round}`,
      headers: { 'accept-version': '2' },
      payload: {
        action: 'upsert',
        idempotency_key: key,
        product: { external_id: `critical-${round}`, sku: `CRIT-${round}`, name: 'Critical burst', price: 1.23 },
      },
      expect: { status: 200, version: '2' },
    };

    const dispatcherScenario = {
      description: `dispatcher burst #${round}`,
      headers: { 'accept-version': '1' },
      payload: { event: 'critical.concurrent.test', payload: { round } },
      expect: { statusIn: [200, 401] },
    };

    const jobs = [];
    for (let i = 0; i < runs; i++) {
      jobs.push(runScenario(productContract, idemScenario));
      jobs.push(runScenario(dispatcherContract, dispatcherScenario));
    }

    const results = await Promise.all(jobs);
    const roundFailed = results.filter((r) => !r.ok).length;
    const roundPassed = results.length - roundFailed;
    passed += roundPassed;
    failed += roundFailed;
    console.log(`  - round ${round}: ✅ ${roundPassed} / ❌ ${roundFailed}`);
  }

  return { passed, failed };
}
async function main() {
  console.log(`🚀 Contract tests against ${SUPABASE_URL}`);
  let passed = 0;
  let failed = 0;

  for (const contract of CONTRACTS) {
    console.log(`\n📦 ${contract.name}`);
    for (const scenario of contract.scenarios) {
      process.stdout.write(`  - ${scenario.description}: `);
      const result = await runScenario(contract, scenario);
      if (result.ok) {
        console.log('✅ PASS');
        passed++;
      } else {
        console.log(`❌ FAIL — ${result.reason}`);
        failed++;
      }
    }
  }

  const critical = await runCriticalConcurrentChecks();
  passed += critical.passed;
  failed += critical.failed;

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Total: ${passed + failed}  passed: ${passed}  failed: ${failed}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
