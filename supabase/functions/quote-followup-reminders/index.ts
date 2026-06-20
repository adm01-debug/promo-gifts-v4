// supabase/functions/quote-followup-reminders/index.ts
// BUG-EF-007 FIXED: supabase-js@2.45.0 -> @2.49.4
/**
 * quote-followup-reminders
 * Cria notificacoes para vendedores cujos orcamentos enviados ha >=2 dias
 * ainda nao foram visualizados pelo cliente. Idempotente por dia (nao duplica).
 */
// BULK-SDK-FIX: Changed from esm.sh URL to npm: direct — removes import_map dependency.
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { buildPublicCorsHeaders } from "../_shared/cors.ts";
import { authorizeCron } from "../_shared/dispatcher-auth.ts";

const corsHeaders = buildPublicCorsHeaders();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Cron: exige x-cron-secret para evitar chamadas diretas nao autorizadas
  const cronAuth = await authorizeCron(req, {
    corsHeaders: {},
    secretEnvName: "CRON_SECRET",
    headerName: "x-cron-secret",
  });
  if (!cronAuth.ok) return cronAuth.response;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

    // 1) Orcamentos enviados ha >=2d
    const { data: quotes, error: qErr } = await supabase
      .from("quotes")
      .select("id, quote_number, client_name, seller_id, updated_at")
      .in("status", ["sent"])
      .lte("updated_at", twoDaysAgo)
      .limit(500);

    if (qErr) throw qErr;
    if (!quotes || quotes.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const candidates = quotes;

    // 2) Idempotencia: ignora os que ja tem reminder hoje
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data: existing } = await supabase
      .from("follow_up_reminders")
      .select("quote_id")
      .in("quote_id", candidates.map((c) => c.id))
      .gte("created_at", todayStart.toISOString());
    const existingSet = new Set((existing || []).map((e) => e.quote_id));

    const toInsert = candidates
      .filter((c) => !existingSet.has(c.id) && c.seller_id)
      .map((c) => ({
        quote_id: c.id,
        seller_id: c.seller_id!,
        reminder_type: "no_view",
        scheduled_for: new Date().toISOString(),
        title: `Orcamento ${c.quote_number} sem visualizacao`,
        notes: `Cliente ${c.client_name || "--"} ainda nao abriu o link. Considere enviar follow-up.`,
        is_sent: true,
        sent_at: new Date().toISOString(),
      }));

    let inserted = 0;
    if (toInsert.length > 0) {
      const { error: insErr, count } = await supabase
        .from("follow_up_reminders")
        .insert(toInsert, { count: "exact" });
      if (insErr) throw insErr;
      inserted = count ?? toInsert.length;
    }

    return new Response(
      JSON.stringify({ ok: true, scanned: quotes.length, candidates: candidates.length, inserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
