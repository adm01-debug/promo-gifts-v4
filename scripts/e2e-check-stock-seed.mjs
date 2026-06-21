#!/usr/bin/env node
/**
 * e2e-check-stock-seed.mjs
 *
 * Verifica se o ambiente tem dados suficientes para os specs E2E que dependem
 * do filtro "Estoque" (Super Filtro e /estoque) produzirem resultados não-vazios.
 *
 * NÃO cria dados. O banco canônico do app é externo (`doufsxqlfjyuvxuezpln`,
 * "Gestão de Produtos") e mexer no schema sem aprovação do PO é proibido —
 * ver CLAUDE.md, Regra #1 e seção "Banco de dados — VÍNCULO FIXO".
 *
 * Como rodar:
 *   node scripts/e2e-check-stock-seed.mjs
 *
 * Saídas:
 *   exit 0 → ambiente OK (specs Estoque podem rodar de forma significativa).
 *   exit 2 → ambiente sem dados → specs devem usar test.skip() (já fazem).
 *   exit 1 → erro de conexão / configuração.
 *
 * Variáveis: usa VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY do .env (mesma
 * config que o app usa). Não exige service_role.
 */
import { readFileSync } from 'node:fs';

function loadEnv() {
  try {
    const txt = readFileSync('.env', 'utf8');
    for (const line of txt.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* opcional */
  }
}
loadEnv();

const URL = process.env.VITE_SUPABASE_URL;
const KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!URL || !KEY) {
  console.error('❌ VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórios.');
  process.exit(1);
}

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };

/**
 * Conta produtos com sinais que populariam o filtro "Estoque":
 *   - inStock=1   → produtos com stock_quantity > 0 (ou equivalente)
 *   - futuro      → produtos com previsão de chegada (variant_supplier_sources)
 */
async function countRows(path) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    headers: { ...headers, Prefer: 'count=exact', Range: '0-0' },
  });
  if (!res.ok) throw new Error(`${res.status} ${path}: ${await res.text()}`);
  const range = res.headers.get('content-range') || '*/0';
  return Number(range.split('/').pop()) || 0;
}

const REQUIRED = {
  'products?select=id&limit=1': { min: 50, label: 'produtos totais' },
  'variant_supplier_sources?select=id&limit=1': {
    min: 1,
    label: 'fontes de fornecedor (estoque futuro)',
  },
};

let ok = true;
const report = [];
for (const [path, { min, label }] of Object.entries(REQUIRED)) {
  try {
    const n = await countRows(path);
    const pass = n >= min;
    ok = ok && pass;
    report.push(`${pass ? '✅' : '⚠️ '} ${label.padEnd(40)} ${n} (mínimo: ${min})`);
  } catch (e) {
    ok = false;
    report.push(`❌ ${label} — erro: ${e.message}`);
  }
}

console.log('\n🔎 Verificação de dados para E2E — seção "Estoque"\n');
console.log(report.join('\n'));
console.log(
  ok
    ? '\n✅ Ambiente pronto: specs do Super Filtro / /estoque devem rodar com dados reais.\n'
    : '\n⚠️  Dados insuficientes: os specs farão test.skip() automaticamente.\n' +
        '   Para popular dados, sincronize o catálogo via /admin (botão "Sincronizar produtos")\n' +
        '   ou peça ao PO. Não criar tabelas/inserts diretos no banco externo (CLAUDE.md Regra #1).\n',
);

process.exit(ok ? 0 : 2);
