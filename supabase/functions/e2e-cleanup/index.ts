/**
 * e2e-cleanup — Apaga dados de aplicação criados por usuários de teste E2E.
 *
 * Camadas de segurança:
 *  1. Header `x-e2e-cleanup-token` precisa bater com E2E_CLEANUP_TOKEN (timing-safe).
 *  2. Rate limit por IP (default 30 req / 60s) via RPC atômica
 *     `e2e_cleanup_check_rate_limit`. Configurável via env:
 *        E2E_CLEANUP_RATE_LIMIT_MAX (default 30)
 *        E2E_CLEANUP_RATE_LIMIT_WINDOW_SECONDS (default 60)
 *  3. `email` do body precisa estar em E2E_CLEANUP_ALLOWED_EMAILS (CSV).
 *  4. user_id é resolvido server-side via auth.admin (cliente nunca passa UUID).
 *  5. dryRun = true por default — exige opt-in explícito {"dryRun": false}.
 *  6. Apaga apenas dados de aplicação por user_id/seller_id. NUNCA apaga auth.users.
 *
 * Auditoria:
 *  - Cada chamada (sucesso, falha, rate-limit, erro de auth) grava uma linha
 *    em `public.e2e_cleanup_audit` com IP, status, motivo, totais e duração.
 *  - Logs estruturados no console (Edge Function logs) replicam o registro
 *    para correlação rápida.
 *
 * Body:
 *   { "email": "e2e@...", "dryRun": false }
 * Resposta:
 *   { ok, dryRun, userId, deleted: { table: count }, totalMs }
 */
// @ts-ignore - Deno runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { castRpcResult } from "../_shared/supabase-client-adapter.ts";
import { buildPublicCorsHeaders } from "../_shared/cors.ts";
import { parseContract } from "../_shared/contracts/index.ts";
import {
  E2eCleanupSchemas,
} from "../_shared/contracts/schemas/e2e-cleanup.ts";

type E2ERateLimitRow = {
  allowed: boolean;
  reset_in_seconds?: number;
  current_count?: number;
};

const corsHeaders = buildPublicCorsHeaders({ extraAllowHeaders: ["x-e2e-cleanup-token"], allowMethods: "POST, OPTIONS" });
let contractResponseHeaders: Record<string, string> = {};

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, ...contractResponseHeaders, "Content-Type": "application/json", ...extraHeaders },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const first = fwd.split(",")[0]?.trim();
  return (
    first ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Tabelas filtradas por user_id (escopo do dono lógico do recurso).
 * NÃO inclui carrinhos/mockups com seller_id direto — esses vão em SELLER_ID_TABLES.
 */
const USER_ID_TABLES = [
  "favorite_items_trash",
  "favorite_items",
  "favorite_lists",
  "collection_item_reactions",
  "collection_items_trash",
  "collection_items",
  "collections",
  "cart_templates",
  "comparison_reactions",
  "user_comparisons",
  "mockup_drafts",
  "custom_kits",
] as const;

/**
 * Tabelas filtradas por seller_id (escopo de tenant). NUNCA misturar com
 * user_id — em apps multi-tenant um user pode atuar em vários sellers.
 */
const SELLER_ID_TABLES = ["seller_carts", "generated_mockups"] as const;

/** seller_cart_items é resolvida via cart_id ∈ seller_carts(seller_id). */
const QUOTE_CHILD_TABLES_BY_QUOTE_ID = [
  "quote_item_personalizations",
  "quote_items",
  "quote_history",
  "quote_comments",
] as const;

/**
 * Para cada tabela com recurso nomeável, qual coluna serve para filtrar
 * por prefixo `name LIKE '<prefix>%'`. Tabelas omitidas não têm coluna
 * textual e são purgadas sem filtro de nome (apenas user_id/seller_id).
 *
 * Importante: filtros de itens-filhos (`favorite_items`, `collection_items`,
 * `quote_items`, etc.) propagam o filtro do PAI via lookup de IDs.
 */
const NAMEABLE_COLUMNS: Record<string, string> = {
  favorite_lists: "name",
  collections: "name",
  cart_templates: "name",
  custom_kits: "name",
  // quotes: filtra por client_name
  quotes: "client_name",
};

interface AuditPayload {
  email: string;
  user_id: string | null;
  seller_id?: string | null;
  seller_scope?: "self" | "explicit";
  name_filter_prefix?: string | null;
  dry_run: boolean;
  status:
    | "ok"
    | "error"
    | "rate_limited"
    | "unauthorized"
    | "forbidden"
    | "not_found"
    | "invalid"
    | "scope_mismatch";
  reason?: string | null;
  ip: string;
  user_agent: string | null;
  total_deleted: number;
  deleted_by_table: Record<string, number>;
  errors: Record<string, string>;
  duration_ms: number;
}

async function writeAudit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  payload: AuditPayload,
): Promise<void> {
  // Log estruturado sempre (mesmo se a tabela falhar).
  console.log(JSON.stringify({ tag: "e2e_cleanup_audit", ...payload }));
  try {
    await admin.from("e2e_cleanup_audit").insert(payload);
  } catch (err) {
    console.warn(JSON.stringify({ tag: "e2e_cleanup_audit_insert_failed", error: String(err) }));
  }
}

// @ts-ignore - Deno runtime
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  // Reset module-scope response headers para esta request
  contractResponseHeaders = {};

  const startedAt = Date.now();
  const ip = clientIp(req);
  const userAgent = req.headers.get("user-agent");

  // service-role client (precisamos cedo para rate limit + audit)
  // @ts-ignore - Deno runtime
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  // @ts-ignore - Deno runtime
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // --- rate limit por IP (antes de tudo, exceto CORS) ---------------------
  // @ts-ignore - Deno runtime
  const rlMax = Number(Deno.env.get("E2E_CLEANUP_RATE_LIMIT_MAX") ?? "30");
  // @ts-ignore - Deno runtime
  const rlWindow = Number(Deno.env.get("E2E_CLEANUP_RATE_LIMIT_WINDOW_SECONDS") ?? "60");
  try {
    const { data: rl, error: rlErr } = await castRpcResult<{
      data: E2ERateLimitRow[] | null;
      error: { message: string } | null;
    }>(admin.rpc(
      "e2e_cleanup_check_rate_limit",
      { p_key: `ip:${ip}`, p_max: rlMax, p_window_seconds: rlWindow },
    ));
    if (!rlErr && Array.isArray(rl) && rl[0] && rl[0].allowed === false) {
      const resetIn = rl[0].reset_in_seconds ?? rlWindow;
      await writeAudit(admin, {
        email: "",
        user_id: null,
        dry_run: true,
        status: "rate_limited",
        reason: `ip ${ip} excedeu ${rlMax}/${rlWindow}s (count=${rl[0].current_count})`,
        ip,
        user_agent: userAgent,
        total_deleted: 0,
        deleted_by_table: {},
        errors: {},
        duration_ms: Date.now() - startedAt,
      });
      return jsonResponse(
        { error: "rate_limited", retry_after_seconds: resetIn },
        429,
        { "Retry-After": String(resetIn) },
      );
    }
  } catch (err) {
    // Falha do rate-limit não bloqueia a requisição, mas é registrada.
    console.warn(JSON.stringify({ tag: "e2e_cleanup_rate_limit_failed", error: String(err) }));
  }

  // --- camada 1: token compartilhado --------------------------------------
  // @ts-ignore - Deno runtime
  const expectedToken = Deno.env.get("E2E_CLEANUP_TOKEN") ?? "";
  const providedToken = req.headers.get("x-e2e-cleanup-token") ?? "";
  if (!expectedToken || !providedToken || !timingSafeEqual(expectedToken, providedToken)) {
    await writeAudit(admin, {
      email: "",
      user_id: null,
      dry_run: true,
      status: "unauthorized",
      reason: "invalid_cleanup_token",
      ip,
      user_agent: userAgent,
      total_deleted: 0,
      deleted_by_table: {},
      errors: {},
      duration_ms: Date.now() - startedAt,
    });
    return jsonResponse({ error: "invalid_cleanup_token" }, 401);
  }

  // --- parse + validate body via parseContract ----------------------------
  const contractResult = await parseContract(req, E2eCleanupSchemas, {
    corsHeaders,
  });
  if (!contractResult.ok) {
    // Preserva audit log de tentativa inválida (mantém rastreabilidade
    // do comportamento atual que loga `invalid_json` quando body falha).
    await writeAudit(admin, {
      email: "",
      user_id: null,
      dry_run: true,
      status: "invalid",
      reason: contractResult.response.status === 400 ? "invalid_json" : "invalid_payload",
      ip,
      user_agent: userAgent,
      total_deleted: 0,
      deleted_by_table: {},
      errors: {},
      duration_ms: Date.now() - startedAt,
    });
    return contractResult.response;
  }
  const body = contractResult.data;
  contractResponseHeaders = contractResult.responseHeaders;
  const email = (body.email ?? "").trim().toLowerCase();
  const dryRun = body.dryRun === false ? false : true;

  // sellerScope: "self" (default) usa o user_id resolvido como seller_id.
  // "explicit" exige sellerId no body — porém o sellerId DEVE bater com o
  // user_id resolvido por email. Isso impede um cliente comprometido de
  // pedir cleanup de outro tenant, mantendo a porta aberta para futuras
  // separações user/seller sem mudar contrato.
  const sellerScope: "self" | "explicit" =
    body.sellerScope === "explicit" ? "explicit" : "self";
  const requestedSellerId =
    body.sellerId && body.sellerId.length > 0 ? body.sellerId : null;

  // nameFilterPrefix: quando presente, restringe DELETEs a recursos cujo
  // nome começa com o prefixo (ex.: "[E2E]"). Garante isolamento contra
  // dados criados manualmente fora do escopo dos testes — apenas tabelas
  // listadas em NAMEABLE_COLUMNS são filtradas; demais permanecem
  // escopadas apenas por user_id/seller_id (são internas/órfãs por
  // construção).
  const nameFilterPrefix =
    body.nameFilterPrefix && body.nameFilterPrefix.length > 0
      ? body.nameFilterPrefix
      : null;
  // Sanitiza % e _ (LIKE wildcards) para evitar match acidental amplo.
  const sanitizedPrefix = nameFilterPrefix
    ? nameFilterPrefix.replace(/[\\%_]/g, (m) => `\\${m}`)
    : null;

  if (!email) {
    await writeAudit(admin, {
      email: "",
      user_id: null,
      seller_scope: sellerScope,
      dry_run: dryRun,
      status: "invalid",
      reason: "email_required",
      ip,
      user_agent: userAgent,
      total_deleted: 0,
      deleted_by_table: {},
      errors: {},
      duration_ms: Date.now() - startedAt,
    });
    return jsonResponse({ error: "email_required" }, 400);
  }
  if (sellerScope === "explicit" && !requestedSellerId) {
    await writeAudit(admin, {
      email,
      user_id: null,
      seller_scope: sellerScope,
      dry_run: dryRun,
      status: "invalid",
      reason: "sellerId_required_for_explicit_scope",
      ip,
      user_agent: userAgent,
      total_deleted: 0,
      deleted_by_table: {},
      errors: {},
      duration_ms: Date.now() - startedAt,
    });
    return jsonResponse({ error: "sellerId_required_for_explicit_scope" }, 400);
  }

  // --- camada 2: allow-list ------------------------------------------------
  // @ts-ignore - Deno runtime
  const allowedRaw = Deno.env.get("E2E_CLEANUP_ALLOWED_EMAILS") ?? "";
  const allowed = allowedRaw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) {
    await writeAudit(admin, {
      email,
      user_id: null,
      seller_scope: sellerScope,
      dry_run: dryRun,
      status: "forbidden",
      reason: "allow_list_not_configured",
      ip,
      user_agent: userAgent,
      total_deleted: 0,
      deleted_by_table: {},
      errors: {},
      duration_ms: Date.now() - startedAt,
    });
    return jsonResponse({ error: "allow_list_not_configured" }, 403);
  }
  if (!allowed.includes(email)) {
    await writeAudit(admin, {
      email,
      user_id: null,
      seller_scope: sellerScope,
      dry_run: dryRun,
      status: "forbidden",
      reason: "email_not_in_allow_list",
      ip,
      user_agent: userAgent,
      total_deleted: 0,
      deleted_by_table: {},
      errors: {},
      duration_ms: Date.now() - startedAt,
    });
    return jsonResponse({ error: "email_not_in_allow_list" }, 403);
  }

  // --- camada 3: resolver user_id ------------------------------------------
  let userId: string | null = null;
  try {
    let page = 1;
    while (page <= 5 && !userId) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      const found = data.users.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (u: any) => (u.email ?? "").toLowerCase() === email,
      );
      if (found) {
        userId = found.id;
        break;
      }
      if (data.users.length < 200) break;
      page++;
    }
  } catch (err) {
    await writeAudit(admin, {
      email,
      user_id: null,
      seller_scope: sellerScope,
      dry_run: dryRun,
      status: "error",
      reason: "user_lookup_failed",
      ip,
      user_agent: userAgent,
      total_deleted: 0,
      deleted_by_table: {},
      errors: { user_lookup: String(err) },
      duration_ms: Date.now() - startedAt,
    });
    return jsonResponse(
      { error: "user_lookup_failed", details: String(err) },
      500,
    );
  }
  if (!userId) {
    await writeAudit(admin, {
      email,
      user_id: null,
      seller_scope: sellerScope,
      dry_run: dryRun,
      status: "not_found",
      reason: "user_not_found",
      ip,
      user_agent: userAgent,
      total_deleted: 0,
      deleted_by_table: {},
      errors: {},
      duration_ms: Date.now() - startedAt,
    });
    return jsonResponse({ error: "user_not_found", email }, 404);
  }

  // --- camada 4: resolução do seller_id e guarda anti-mismatch -----------
  // No modelo atual seller_id == user_id resolvido por email. Em "explicit",
  // exigimos que o sellerId enviado bata exatamente com esse user_id —
  // qualquer divergência aborta a operação ANTES de qualquer DELETE.
  const sellerId = userId;
  if (sellerScope === "explicit" && requestedSellerId !== sellerId) {
    await writeAudit(admin, {
      email,
      user_id: userId,
      seller_id: sellerId,
      seller_scope: sellerScope,
      dry_run: dryRun,
      status: "scope_mismatch",
      reason: `requested sellerId ${requestedSellerId} != resolved ${sellerId}`,
      ip,
      user_agent: userAgent,
      total_deleted: 0,
      deleted_by_table: {},
      errors: {},
      duration_ms: Date.now() - startedAt,
    });
    return jsonResponse(
      { error: "seller_scope_mismatch", expected: sellerId },
      409,
    );
  }

  const deleted: Record<string, number> = {};
  const errors: Record<string, string> = {};

  /**
   * Aplica filtro `name LIKE '<prefix>%'` quando:
   *   (a) `sanitizedPrefix` foi enviado pelo cliente, e
   *   (b) a tabela está em `NAMEABLE_COLUMNS`.
   * Caso contrário, executa sem filtro de nome (apenas owner-scope).
   *
   * Tabelas órfãs/internas (sem coluna textual visível ao usuário) NÃO
   * recebem filtro — elas são purgadas integralmente por owner. O contrato
   * é: "se você nomeou, devia ter usado e2eName()".
   */
  function maybeApplyNameFilter<Q>(
    qb: Q,
    table: string,
  ): Q {
    if (!sanitizedPrefix) return qb;
    const col = NAMEABLE_COLUMNS[table];
    if (!col) return qb;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (qb as any).like(col, `${sanitizedPrefix}%`) as Q;
  }

  async function purgeByUserId(table: string) {
    if (dryRun) {
      const q = admin
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId!);
      const { count, error } = await maybeApplyNameFilter(q, table);
      if (error) errors[table] = error.message;
      else deleted[table] = count ?? 0;
      return;
    }
    const q = admin
      .from(table)
      .delete({ count: "exact" })
      .eq("user_id", userId!);
    const { error, count } = await maybeApplyNameFilter(q, table);
    if (error) errors[table] = error.message;
    else deleted[table] = count ?? 0;
  }

  async function purgeBySellerId(table: string) {
    if (dryRun) {
      const q = admin
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("seller_id", sellerId!);
      const { count, error } = await maybeApplyNameFilter(q, table);
      if (error) errors[table] = error.message;
      else deleted[table] = count ?? 0;
      return;
    }
    const q = admin
      .from(table)
      .delete({ count: "exact" })
      .eq("seller_id", sellerId!);
    const { error, count } = await maybeApplyNameFilter(q, table);
    if (error) errors[table] = error.message;
    else deleted[table] = count ?? 0;
  }

  // 1) user_id-scoped
  //    Quando há prefixo de nome, processamos PRIMEIRO os pais nomeáveis
  //    (favorite_lists, collections, custom_kits) coletando seus IDs e
  //    apagando seus filhos via FK; assim os filhos ficam corretamente
  //    isolados ao escopo do prefixo. Tabelas sem nome (favorite_items,
  //    collection_items, etc.) só são purgadas-em-bloco quando NÃO há
  //    prefixo — caso contrário ficariam "soltas" do filtro.
  if (sanitizedPrefix) {
    const SCOPED_OWNER_TABLES = Object.keys(NAMEABLE_COLUMNS).filter((t) =>
      (USER_ID_TABLES as readonly string[]).includes(t),
    );
    for (const t of SCOPED_OWNER_TABLES) {
      await purgeByUserId(t);
    }
  } else {
    for (const t of USER_ID_TABLES) {
      await purgeByUserId(t);
    }
  }

  // 2) seller_cart_items via cart_id ∈ seller_carts(seller_id) — precisa
  //    rodar ANTES de purgar seller_carts.
  try {
    const { data: cartRows, error: cErr } = await admin
      .from("seller_carts")
      .select("id")
      .eq("seller_id", sellerId);
    if (cErr) {
      errors["seller_carts_lookup"] = cErr.message;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cartIds = (cartRows ?? []).map((r: any) => r.id);
      if (cartIds.length > 0) {
        if (dryRun) {
          const { count, error } = await admin
            .from("seller_cart_items")
            .select("id", { count: "exact", head: true })
            .in("cart_id", cartIds);
          if (error) errors["seller_cart_items"] = error.message;
          else deleted["seller_cart_items"] = count ?? 0;
        } else {
          const { error, count } = await admin
            .from("seller_cart_items")
            .delete({ count: "exact" })
            .in("cart_id", cartIds);
          if (error) errors["seller_cart_items"] = error.message;
          else deleted["seller_cart_items"] = count ?? 0;
        }
      } else {
        deleted["seller_cart_items"] = 0;
      }
    }
  } catch (err) {
    errors["seller_cart_items_block"] = String(err);
  }

  // 3) seller_id-scoped (carts, mockups gerados, etc.)
  for (const t of SELLER_ID_TABLES) {
    await purgeBySellerId(t);
  }

  // 4) Quotes (seller_id) — apaga filhos via quote_id, depois quotes.
  //    Quando há prefixo de nome, restringimos por `client_name LIKE` tanto
  //    no lookup de IDs quanto no DELETE final.
  try {
    let quoteLookup = admin
      .from("quotes")
      .select("id")
      .eq("seller_id", sellerId);
    if (sanitizedPrefix) {
      quoteLookup = quoteLookup.like(NAMEABLE_COLUMNS["quotes"], `${sanitizedPrefix}%`);
    }
    const { data: quoteRows, error: qErr } = await quoteLookup;
    if (qErr) {
      errors["quotes_lookup"] = qErr.message;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const quoteIds = (quoteRows ?? []).map((r: any) => r.id);
      if (quoteIds.length > 0) {
        for (const child of QUOTE_CHILD_TABLES_BY_QUOTE_ID) {
          if (dryRun) {
            const { count, error } = await admin
              .from(child)
              .select("id", { count: "exact", head: true })
              .in("quote_id", quoteIds);
            if (error) errors[child] = error.message;
            else deleted[child] = count ?? 0;
          } else {
            const { error, count } = await admin
              .from(child)
              .delete({ count: "exact" })
              .in("quote_id", quoteIds);
            if (error) errors[child] = error.message;
            else deleted[child] = count ?? 0;
          }
        }
        if (dryRun) {
          deleted["quotes"] = quoteIds.length;
        } else {
          // DELETE final SEMPRE limitado aos quoteIds resolvidos acima —
          // garante que o filtro por prefixo é honrado.
          const { error, count } = await admin
            .from("quotes")
            .delete({ count: "exact" })
            .in("id", quoteIds);
          if (error) errors["quotes"] = error.message;
          else deleted["quotes"] = count ?? 0;
        }
      } else {
        deleted["quotes"] = 0;
      }
    }
  } catch (err) {
    errors["quotes_block"] = String(err);
  }

  const totalDeleted = Object.values(deleted).reduce((a, b) => a + b, 0);
  const status: AuditPayload["status"] =
    Object.keys(errors).length === 0 ? "ok" : "error";
  const duration = Date.now() - startedAt;

  await writeAudit(admin, {
    email,
    user_id: userId,
    seller_id: sellerId,
    seller_scope: sellerScope,
    name_filter_prefix: nameFilterPrefix,
    dry_run: dryRun,
    status,
    reason: status === "ok" ? null : "partial_or_failed_purge",
    ip,
    user_agent: userAgent,
    total_deleted: totalDeleted,
    deleted_by_table: deleted,
    errors,
    duration_ms: duration,
  });

  return jsonResponse({
    ok: status === "ok",
    dryRun,
    userId,
    sellerId,
    sellerScope,
    nameFilterPrefix,
    email,
    deleted,
    errors,
    totalMs: duration,
  });
});
