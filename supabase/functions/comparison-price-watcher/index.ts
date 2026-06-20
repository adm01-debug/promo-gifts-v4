import { getCorsHeaders } from "../_shared/cors.ts";
import { authorizeCron } from "../_shared/dispatcher-auth.ts";
/**
 * comparison-price-watcher (C6 #7) — Cron diário.
 * Cruza user_comparisons ativas com price_history; se houve queda > 5% nos
 * últimos 7d em produto comparado, cria notificação em workspace_notifications.
 *
 * price_history é uma tabela de auditoria chaveada por `variant_id`, com o preço
 * em `new_values->>'price'` e timestamp em `changed_at`. Como as comparações
 * guardam `productId`, resolvemos os variants de cada produto via product_variants.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const THRESHOLD_PCT = 5;
const LOOKBACK_DAYS = 7;

interface RunStats {
  comparisons: number;
  products: number;
  variants: number;
  drops: number;
  notifications: number;
  skipped: number;
  errors: number;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Cron: exige x-cron-secret para evitar chamadas diretas não autorizadas
  const cronAuth = await authorizeCron(req, {
    corsHeaders: {},
    secretEnvName: "CRON_SECRET",
    headerName: "x-cron-secret",
  });
  if (!cronAuth.ok) return cronAuth.response;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const stats: RunStats = {
    comparisons: 0,
    products: 0,
    variants: 0,
    drops: 0,
    notifications: 0,
    skipped: 0,
    errors: 0,
  };

  const json = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { data: comparisons, error: cmpErr } = await supabase
      .from("user_comparisons")
      .select("id, user_id, items")
      .order("updated_at", { ascending: false })
      .limit(500);

    if (cmpErr) throw cmpErr;
    stats.comparisons = comparisons?.length ?? 0;

    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 3600 * 1000).toISOString();

    // product_id -> users; product_id -> variant ids declarados explicitamente nos itens
    const userByProduct = new Map<string, Set<string>>();
    const productSet = new Set<string>();
    const variantToProduct = new Map<string, string>();

    for (const c of comparisons ?? []) {
      const items = (c.items as Array<Record<string, unknown>>) ?? [];
      for (const it of items) {
        const pid = it?.productId as string | undefined;
        if (!pid) continue;
        productSet.add(pid);
        if (!userByProduct.has(pid)) userByProduct.set(pid, new Set());
        userByProduct.get(pid)!.add(c.user_id);
        const variant = it?.variant as Record<string, unknown> | undefined;
        const vid = variant?.variant_id as string | undefined;
        if (vid) variantToProduct.set(vid, pid);
      }
    }
    stats.products = productSet.size;

    if (productSet.size === 0) return json(200, { ok: true, stats });

    // Resolve todos os variants dos produtos comparados (price_history é por variant).
    const { data: variants, error: varErr } = await supabase
      .from("product_variants")
      .select("id, product_id")
      .in("product_id", Array.from(productSet));

    if (!varErr) {
      for (const v of (variants ?? []) as Array<Record<string, unknown>>) {
        const id = v?.id as string | undefined;
        const productId = v?.product_id as string | undefined;
        if (id && productId) variantToProduct.set(id, productId);
      }
    }

    const variantIds = Array.from(variantToProduct.keys());
    stats.variants = variantIds.length;
    if (variantIds.length === 0) return json(200, { ok: true, stats });

    // Auditoria de preço na janela. Se a tabela/coluna não existir, encerra graciosamente.
    const { data: history, error: histErr } = await supabase
      .from("price_history")
      .select("variant_id, new_values, changed_at")
      .in("variant_id", variantIds)
      .gte("changed_at", since)
      .order("changed_at", { ascending: false });

    if (histErr) return json(200, { ok: true, stats, note: "price_history indisponível" });

    // history é DESC por changed_at: 1ª linha por variant = mais nova, última = mais antiga.
    const perVariant = new Map<string, { newest: number; oldest: number }>();
    for (const h of (history ?? []) as Array<Record<string, unknown>>) {
      const vid = h?.variant_id as string | undefined;
      const newValues = h?.new_values as Record<string, unknown> | null;
      const price = Number(newValues?.price);
      if (!vid || !Number.isFinite(price) || price <= 0) continue;
      const cur = perVariant.get(vid);
      if (!cur) perVariant.set(vid, { newest: price, oldest: price });
      else cur.oldest = price; // sobrescreve até a linha mais antiga da janela
    }

    // Agrega ao nível de produto: maior queda entre os variants do produto.
    const dropByProduct = new Map<string, number>();
    for (const [vid, { newest, oldest }] of perVariant) {
      const pid = variantToProduct.get(vid);
      if (!pid || !oldest) continue;
      const dropPct = ((oldest - newest) / oldest) * 100;
      if (dropPct < THRESHOLD_PCT) continue;
      dropByProduct.set(pid, Math.max(dropByProduct.get(pid) ?? 0, dropPct));
    }
    stats.drops = dropByProduct.size;
    if (dropByProduct.size === 0) return json(200, { ok: true, stats });

    // Dedup: não re-notifica (usuário, produto) já avisado dentro da janela.
    const alreadyNotified = new Set<string>();
    const { data: recentNotifs } = await supabase
      .from("workspace_notifications")
      .select("user_id, metadata")
      .eq("type", "price_drop")
      .gte("created_at", since);
    for (const n of (recentNotifs ?? []) as Array<Record<string, unknown>>) {
      const metadata = n?.metadata as Record<string, unknown> | null;
      const pid = metadata?.product_id as string | undefined;
      const uid = n?.user_id as string | undefined;
      if (uid && pid) alreadyNotified.add(`${uid}|${pid}`);
    }

    for (const [pid, dropPct] of dropByProduct) {
      const users = userByProduct.get(pid);
      if (!users) continue;
      for (const userId of users) {
        const key = `${userId}|${pid}`;
        if (alreadyNotified.has(key)) {
          stats.skipped++;
          continue;
        }
        try {
          const { error: nErr } = await supabase.from("workspace_notifications").insert({
            user_id: userId,
            type: "price_drop",
            title: "Preço caiu em produto comparado",
            message: `Queda de ${dropPct.toFixed(1)}% nos últimos ${LOOKBACK_DAYS} dias.`,
            metadata: { product_id: pid, drop_pct: dropPct, source: "comparison-price-watcher" },
            is_read: false,
          });
          if (!nErr) {
            stats.notifications++;
            alreadyNotified.add(key);
          } else {
            stats.errors++;
          }
        } catch {
          stats.errors++;
        }
      }
    }

    return json(200, { ok: true, stats });
  } catch (e) {
    return json(500, { ok: false, error: String(e), stats });
  }
});
