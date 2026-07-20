#!/usr/bin/env node
/**
 * check-security-definer-acl
 * --------------------------------------------------------------
 * Gate de CI que falha se alguma função `SECURITY DEFINER` em
 * `public` ficar executável por `PUBLIC`, `anon` (fora da whitelist
 * de funções público-intencionais) ou se uma trigger function ficar
 * acessível a `authenticated`.
 *
 * Por quê:
 *   Funções SECURITY DEFINER rodam com privilégio do owner. Se
 *   `anon`/`PUBLIC` puderem executá-las, abre vetor de privilege-
 *   escalation (lints Supabase 0028 e 0029). A migração de hardening
 *   inicial fechou todas as 257 ocorrências; este script garante que
 *   migrations futuras não reintroduzam o problema.
 *
 * Como funciona:
 *   1. Se o ambiente NÃO tem credenciais Supabase (PR de fork, sandbox
 *      sem secrets), o script termina com sucesso e log de skip — o
 *      gate é defensivo, não pode quebrar PRs sem acesso ao banco.
 *   2. Caso contrário, chama o RPC `audit_security_definer_acl()`
 *      (criado na migração) via REST. Cada linha retornada é uma
 *      violação. Falha com exit 1 e imprime tabela legível.
 *   3. Se um arquivo baseline (--baseline <file>) for fornecido,
 *      violações que correspondam a entradas no baseline são filtradas
 *      e não causam falha — apenas violações NOVAS falham o gate.
 *      Isso permite documentar concessões legítimas pré-existentes sem
 *      alterar o banco de dados.
 *
 * Uso local:
 *   VITE_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/check-security-definer-acl.mjs [--baseline .security-definer-acl-baseline.json]
 *
 * Uso CI:
 *   - name: SECURITY DEFINER ACL gate
 *     env:
 *       VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
 *       SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
 *     run: node scripts/check-security-definer-acl.mjs --baseline .security-definer-acl-baseline.json
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Parse --baseline flag
let baselineFile = null;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--baseline" && args[i + 1]) {
    baselineFile = resolve(args[i + 1]);
    i++;
  }
}

// Load baseline entries (known-OK violations to ignore)
let baselineSet = new Set();
if (baselineFile) {
  try {
    const raw = readFileSync(baselineFile, "utf8");
    const parsed = JSON.parse(raw);
    const accepted = Array.isArray(parsed.accepted) ? parsed.accepted : [];
    for (const entry of accepted) {
      // Key: function_name + "::" + arguments + "::" + granted_to
      const key = `${entry.function_name}::${entry.arguments ?? ""}::${entry.granted_to}`;
      baselineSet.add(key);
    }
    console.log(`ℹ️  Baseline carregado de ${baselineFile}: ${baselineSet.size} entrada(s) conhecida(s).`);
  } catch (err) {
    console.error(`❌  Não foi possível ler baseline ${baselineFile}: ${err.message}`);
    process.exit(1);
  }
}

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.log("⚠️  SECURITY DEFINER ACL gate: credenciais Supabase ausentes — skip.");
  console.log("   Defina VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY no CI para habilitar.");
  process.exit(0);
}

const endpoint = `${url.replace(/\/$/, "")}/rest/v1/rpc/audit_security_definer_acl`;

let res;
try {
  res = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: "{}",
  });
} catch (err) {
  console.error(`❌ Falha de rede ao chamar audit_security_definer_acl: ${err.message}`);
  process.exit(1);
}

if (!res.ok) {
  const text = await res.text();
  console.error(`❌ HTTP ${res.status} ao chamar audit_security_definer_acl:\n${text}`);
  process.exit(1);
}

const rows = await res.json();

if (!Array.isArray(rows)) {
  console.error("❌ Resposta inesperada (esperava array):", rows);
  process.exit(1);
}

// Filter out known-OK violations from baseline
const newViolations = rows.filter((r) => {
  const rowKey = `${r.function_name}::${r.arguments ?? ""}::${r.granted_to}`;
  if (baselineSet.has(rowKey)) {
    console.log(`ℹ️  Violação conhecida (baseline): ${r.function_name}(${r.arguments ?? ""}) → ${r.granted_to} — ignorada.`);
    return false;
  }
  return true;
});

if (rows.length === 0) {
  console.log("✅ SECURITY DEFINER ACL: 0 violações.");
  console.log("   Todas as funções SECURITY DEFINER em public estão restritas corretamente.");
  process.exit(0);
}

if (newViolations.length === 0) {
  console.log(`✅ SECURITY DEFINER ACL: ${rows.length} violação(ões) encontrada(s), todas no baseline — 0 violações novas.`);
  process.exit(0);
}

console.error(`\n❌ SECURITY DEFINER ACL: ${newViolations.length} violação(ões) NOVA(S) encontrada(s) (${rows.length - newViolations.length} no baseline)\n`);
console.error("Funções SECURITY DEFINER ainda executáveis por papéis indevidos:\n");

const pad = (s, n) => String(s ?? "").padEnd(n);
console.error(
  `  ${pad("FUNÇÃO", 40)} ${pad("ARGS", 30)} ${pad("PAPEL", 14)} PROBLEMA`,
);
console.error(`  ${"-".repeat(40)} ${"-".repeat(30)} ${"-".repeat(14)} ${"-".repeat(50)}`);
for (const r of newViolations) {
  console.error(
    `  ${pad(r.function_name, 40)} ${pad(r.arguments || "()", 30)} ${pad(r.granted_to, 14)} ${r.problem}`,
  );
}

console.error(
  "\nComo corrigir:\n" +
    "  - Para cada função listada, na próxima migration:\n" +
    "      REVOKE EXECUTE ON FUNCTION public.<fn>(<args>) FROM <papel>;\n" +
    "  - Se a função PRECISA mesmo ser pública (ex: rota de aprovação por\n" +
    "    token), adicione o nome em supabase/migrations/<...>_hardening_security_definer.sql,\n" +
    "    no array `public_intent` da função audit_security_definer_acl().\n",
);

// Annotation amigável no GitHub Actions
if (process.env.GITHUB_ACTIONS === "true") {
  console.log(
    `::error title=SECURITY DEFINER ACL gate failed::${newViolations.length} função(ões) SECURITY DEFINER acessível(eis) por papel indevido. Veja log completo.`,
  );
}

process.exit(1);
