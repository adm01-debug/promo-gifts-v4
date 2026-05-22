import { getCorsHeaders } from "../_shared/cors.ts";
/**
 * ownership-repair — executa a tentativa de reparo dos órfãos detectados
 * pelo último relatório de `ownership-audit`. Apenas admins/devs.
 *
 * Body JSON:
 *   { report_id?: string, dry_run?: boolean, triggered_by?: string }
 *
 * Retorna o resumo da RPC `repair_ownership_orphans` + os logs gravados.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { castRpcResult } from "../_shared/supabase-client-adapter.ts";
import { parseContract } from "../_shared/contracts/index.ts";
import {
  OwnershipRepairSchemas,
} from "../_shared/contracts/schemas/ownership-repair.ts";

// Module-scope CORS headers — atribuído per-request no handler.
let corsHeaders: Record<string, string> = {};
let contractResponseHeaders: Record<string, string> = {};

type RepairOrphansResult = {
  report_id?: string;
  totals?: Record<string, unknown>;
} & Record<string, unknown>;

Deno.serve(async (req) => {
  corsHeaders = getCorsHeaders(req);
  contractResponseHeaders = {};
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "missing_auth" }, 401);

    // Cliente com JWT do usuário — RPC valida internamente has_role()
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: uErr } = await userClient.auth.getUser();
    if (uErr || !userData.user) return json({ error: "unauthorized" }, 401);

    const contractResult = await parseContract(req, OwnershipRepairSchemas, {
      corsHeaders,
    });
    if (!contractResult.ok) return contractResult.response;
    const body = contractResult.data;
    contractResponseHeaders = contractResult.responseHeaders;

    const dryRun = body.dry_run !== false; // default true
    const triggeredBy = (body.triggered_by ?? "manual_admin").slice(0, 64);

    const t0 = Date.now();
    const { data: result, error: rpcErr } = await castRpcResult<{
      data: RepairOrphansResult | null;
      error: { message: string } | null;
    }>(userClient.rpc("repair_ownership_orphans", {
      _report_id: body.report_id ?? null,
      _dry_run: dryRun,
      _triggered_by_label: triggeredBy,
    }));
    if (rpcErr) {
      console.error("[ownership-repair] rpc error", rpcErr);
      return json({ error: rpcErr.message }, 400);
    }

    // Carrega os logs gerados (mesmo report_id e mesmo dry_run, últimos N segundos)
    const reportId = result?.report_id;
    const { data: logs } = await userClient
      .from("ownership_repair_logs")
      .select("*")
      .eq("report_id", reportId!)
      .eq("dry_run", dryRun)
      .gte("created_at", new Date(t0 - 1000).toISOString())
      .order("created_at", { ascending: true });

    console.log(
      `[ownership-repair] ${dryRun ? "DRY-RUN" : "APPLIED"} in ${Date.now() - t0}ms — ` +
        `report ${reportId}, totals=${JSON.stringify(result?.totals)}`,
    );

    return json({ ok: true, result, logs: logs ?? [] });
  } catch (e) {
    console.error("[ownership-repair] uncaught", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, ...contractResponseHeaders, "Content-Type": "application/json" },
  });
}
