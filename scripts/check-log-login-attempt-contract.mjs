#!/usr/bin/env node
/**
 * Gate: log-login-attempt DEVE manter o contrato "nunca-5xx".
 *
 * Regra: nenhum caminho em `supabase/functions/log-login-attempt/index.ts`
 * pode retornar `status: 5xx`. A degradação suave é obrigatória — DB error,
 * env ausente, RPC 404, tudo vira 200 { ok:false, fallback:true }.
 *
 * Este gate roda análise estática (regex) sobre o arquivo e falha CI se
 * detectar `status: 5\d\d` em qualquer `new Response(...)`.
 *
 * Não substitui os testes runtime (Deno + Vitest fuzz) — é uma malha de
 * segurança adicional contra regressão silenciosa via edit direto.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(__dirname, "..", "supabase/functions/log-login-attempt/index.ts");

const src = readFileSync(FILE, "utf8");

// Procura `status: 5xx` em qualquer bloco `new Response(...)` ou `Response.json(...)`.
const re = /status\s*:\s*5\d{2}\b/g;
const hits = [...src.matchAll(re)];

if (hits.length > 0) {
  console.error(`❌ log-login-attempt/index.ts contém ${hits.length} retorno(s) 5xx:`);
  for (const h of hits) {
    const before = src.slice(0, h.index ?? 0);
    const line = before.split("\n").length;
    console.error(`   linha ${line}: ${h[0]}`);
  }
  console.error("\n   Regra: log-login-attempt NUNCA pode retornar 5xx. Use fallback 200.");
  process.exit(1);
}

console.log("✅ log-login-attempt/index.ts — contrato nunca-5xx OK (0 violações).");
