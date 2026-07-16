#!/usr/bin/env node
/**
 * Deploy gate: confirma que a RPC `restore_seller_cart` está presente
 * no banco canônico (Supabase) consultando indiretamente o pg_proc.
 *
 * Como funciona:
 *   Sem service_role no CI público, não podemos rodar `SELECT ... FROM pg_proc`
 *   direto. Em vez disso, chamamos o endpoint PostgREST da RPC. O PostgREST
 *   consulta o schema cache (que é populado a partir do pg_proc) e responde:
 *     • HTTP 404 + code "PGRST202" → função AUSENTE no schema cache → FALHA
 *     • Qualquer outra resposta (200, 400 validação, 401, 403 RLS, 500 lógica)
 *       → função PRESENTE (endpoint existe) → PASSA
 *
 * Variáveis de ambiente:
 *   SUPABASE_URL           (fallback: VITE_SUPABASE_URL)
 *   SUPABASE_ANON_KEY      (fallback: VITE_SUPABASE_ANON_KEY / VITE_SUPABASE_PUBLISHABLE_KEY)
 *   STRICT=1               → falha se credenciais ausentes (default: skip)
 *   RPC_NAME               → override do nome (default: restore_seller_cart)
 *
 * Exit codes:
 *   0 → função presente (ou skip por falta de credenciais fora do modo estrito)
 *   1 → função ausente (PGRST202) OU credenciais faltando em STRICT=1
 *   2 → erro de rede/infra impedindo verificar (não bloqueia por padrão)
 */

const RPC_NAME = process.env.RPC_NAME || 'restore_seller_cart';
const STRICT = process.env.STRICT === '1';

// Canônico sempre por padrão — o .env local pode apontar para o projeto Lovable
// Cloud (pqp), mas o gate valida SEMPRE o banco de produção do app.
const CANONICAL_URL = 'https://doufsxqlfjyuvxuezpln.supabase.co';

const url = process.env.CANONICAL_SUPABASE_URL || process.env.SUPABASE_URL || CANONICAL_URL;

const anonKey =
  process.env.CANONICAL_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  '';

const tag = '[check:restore-seller-cart-rpc]';

function log(msg) {
  console.log(`${tag} ${msg}`);
}

function fail(msg) {
  console.error(`${tag} ❌ ${msg}`);
  process.exit(1);
}

function skip(msg) {
  console.warn(`${tag} ⚠️  ${msg} (skip — use STRICT=1 para forçar falha)`);
  process.exit(0);
}

async function main() {
  log(`Verificando presença da RPC \`${RPC_NAME}\` em ${url}`);

  if (!anonKey) {
    const msg = 'SUPABASE_ANON_KEY ausente — não é possível consultar o schema cache.';
    if (STRICT) fail(msg);
    return skip(msg);
  }

  const endpoint = `${url.replace(/\/$/, '')}/rest/v1/rpc/${RPC_NAME}`;

  let res;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      // Payload propositalmente inválido — não queremos executar de fato,
      // só provar que o endpoint (portanto a função) existe no schema cache.
      body: JSON.stringify({}),
    });
  } catch (err) {
    const msg = `Falha de rede ao consultar PostgREST: ${err?.message || err}`;
    if (STRICT) fail(msg);
    console.warn(`${tag} ⚠️  ${msg}`);
    process.exit(2);
  }

  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // corpo não-JSON — trata como texto
  }

  const code = body?.code;
  const message = body?.message || text;

  // PGRST202 = "Could not find the function ... in the schema cache"
  // 42883    = undefined_function (erro do próprio Postgres quando a assinatura
  //            some entre a resolução do cache e a execução).
  if (res.status === 404 && (code === 'PGRST202' || /schema cache/i.test(message))) {
    // PostgREST retorna 404 PGRST202 tanto quando a função não existe quanto
    // quando anon não tem EXECUTE (ambos são invisíveis no schema cache).
    // Usamos fn_rpc_exists() para distinguir os dois casos sem precisar de
    // service_role key nem de EXECUTE grant para anon.
    log(`404 PGRST202 — verificando via fn_rpc_exists('${RPC_NAME}')...`);
    let exists = false;
    try {
      const existsRes = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/fn_rpc_exists`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ _fname: RPC_NAME }),
      });
      if (existsRes.ok) {
        exists = await existsRes.json();
      }
    } catch {
      // rede inacessível — não podemos confirmar; não bloquear
    }

    if (exists === true) {
      log(`✅ RPC \`${RPC_NAME}\` existe em pg_proc (anon sem EXECUTE — intencional, função protegida).`);
      process.exit(0);
    }

    fail(
      `RPC \`${RPC_NAME}\` NÃO existe no banco canônico.\n` +
        `  status: ${res.status}\n` +
        `  code:   ${code}\n` +
        `  msg:    ${message}\n\n` +
        `  → Aplique a migração em supabase/migrations/ para criar a função.`
    );
  }

  if (code === '42883') {
    fail(
      `RPC \`${RPC_NAME}\` reportou undefined_function (42883). Assinatura ausente.\n` +
        `  msg: ${message}`
    );
  }

  // 401 significa que o JWT foi rejeitado ANTES do PostgREST consultar o schema
  // cache — não conseguimos distinguir "função existe" de "função ausente".
  // Trate como ambíguo: skip em modo normal, falha em STRICT.
  if (res.status === 401) {
    const msg =
      `PostgREST retornou 401 (anon key inválida para ${url}). ` +
      `Não é possível verificar a RPC — configure CANONICAL_SUPABASE_ANON_KEY ` +
      `com a anon key do projeto canônico.`;
    if (STRICT) fail(msg);
    return skip(msg);
  }

  log(`✅ RPC \`${RPC_NAME}\` presente (status=${res.status}${code ? `, code=${code}` : ''}).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(`${tag} erro inesperado:`, err);
  process.exit(2);
});
