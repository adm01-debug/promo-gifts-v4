import { getCorsHeaders } from "../_shared/cors.ts";
import { authorizeCron } from "../_shared/dispatcher-auth.ts";
// favorites-watcher: cron diário que detecta quedas de preço em favoritos
// e gera workspace_notifications (categoria "favorites") com dedupe 24h.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { castSupabaseClient } from "../_shared/supabase-client-adapter.ts";

const DEDUPE_WINDOW_HOURS = 24;
const DROP_THRESHOLD_PCT = 5;

interface FavRow {
  id: string;
  user_id: string;
  list_id: string;
  product_id: string;
  price_at_save: number | null;
}

async function alreadyNotified(service: import("../_shared/supabase-client-adapter.ts").CompatibleSupabaseClient, userId: string, key: string) {
  const since = new Date(Date.now() - DEDUPE_WINDOW_HOURS * 3600 * 1000).toISOString();
  const { data } = await service
    .from("workspace_notifications")
    .select("id")
    .eq("user_id", userId)
    .eq("category", "favorites")
    .gte("created_at", since)
    .filter("metadata->>incident_key", "eq", key)
    .limit(1);
  return (data ?? []).length > 0;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Cron: exige x-cron-secret para evitar chamadas diretas não autorizadas
  const cronAuth = await authorizeCron(req, {
    corsHeaders: {},
    secretEnvName: "CRON_SECRET",
    headerName: "x-cron-secret",
  });
  if (!cronAuth.ok) return cronAuth.response;

  try {
    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Busca todos favoritos com snapshot de preço
    const { data: favs, error: favErr } = await service
      .from("favorite_items")
      .select("id, user_id, list_id, product_id, price_at_save")
      .not("price_at_save", "is", null);
    if (favErr) throw favErr;
    const items = (favs ?? []) as FavRow[];

    if (items.length === 0) {
      return new Response(JSON.stringify({ ok: true, scanned: 0, drops: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Busca preços atuais via external bridge (usa products table sincronizada)
    const productIds = [...new Set(items.map((i) => i.product_id))];
    const { data: products } = await service
      .from("products")
      .select("id, name, price, sale_price")
      .in("id", productIds);

    const priceMap = new Map<string, { name: string; price: number }>();
    (products ?? []).forEach((p: { id: string; name: string; price: number | null; sale_price?: number | null }) => {
      // Use effective selling price: sale_price when available, otherwise price
      const effectivePrice = (typeof p.sale_price === 'number' && p.sale_price > 0)
        ? p.sale_price
        : p.price;
      if (effectivePrice && effectivePrice > 0) priceMap.set(p.id, { name: p.name, price: effectivePrice });
    });

    // Agrupa drops por usuário
    const userDrops = new Map<string, Array<{ name: string; pct: number; productId: string; listId: string }>>();
    let totalDrops = 0;

    for (const item of items) {
      const current = priceMap.get(item.product_id);
      if (!current || !item.price_at_save) continue;
      const diffPct = ((current.price - item.price_at_save) / item.price_at_save) * 100;
      if (diffPct >= -DROP_THRESHOLD_PCT) continue; // só drops significativos
      totalDrops++;
      if (!userDrops.has(item.user_id)) userDrops.set(item.user_id, []);
      userDrops.get(item.user_id)!.push({
        name: current.name,
        pct: Math.abs(diffPct),
        productId: item.product_id,
        listId: item.list_id,
      });
    }

    // Cria 1 notificação por usuário (agregada) com dedupe diário
    let notified = 0;
    for (const [userId, drops] of userDrops.entries()) {
      const dayKey = new Date().toISOString().slice(0, 10);
      const incidentKey = `favorites_drop:${dayKey}`;
      if (await alreadyNotified(castSupabaseClient(service), userId, incidentKey)) continue;

      const top = drops.sort((a, b) => b.pct - a.pct).slice(0, 3);
      const message = drops.length === 1
        ? `${top[0].name} caiu ${top[0].pct.toFixed(0)}% desde que você salvou.`
        : `${drops.length} produtos favoritos com queda de preço. Maior: ${top[0].name} (−${top[0].pct.toFixed(0)}%).`;

      await service.from("workspace_notifications").insert({
        user_id: userId,
        title: "💸 Queda de preço nos favoritos",
        message,
        type: "success",
        category: "favorites",
        action_url: "/favoritos?filter=drops",
        is_read: false,
        metadata: {
          incident_key: incidentKey,
          source: "favorites-watcher",
          drops_count: drops.length,
          top_drops: top,
        },
      });
      notified++;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        scanned: items.length,
        drops: totalDrops,
        users_notified: notified,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("[favorites-watcher]", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
