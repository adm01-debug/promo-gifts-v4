import { getCorsHeaders } from "../_shared/cors.ts";
import { authorizeCron } from "../_shared/dispatcher-auth.ts";
/**
 * ownership-audit — executa a varredura de propriedade de registros.
 *
 * Invocada via cron diário (pg_cron + pg_net) ou manualmente por admin.
 * Usa a service_role para bypassar RLS na invocação da RPC. A RPC em si
 * (`audit_ownership_orphans`) verifica permissão internamente quando
 * chamada por usuário autenticado.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { castRpcResult } from "../_shared/supabase-client-adapter.ts";
import { parseContract } from "../_shared/contracts/index.ts";
import {
  OwnershipAuditSchemas,
} from "../_shared/contracts/schemas/ownership-audit.ts";

// Module-scope CORS headers — atribuído per-request no handler.
let corsHeaders: Record<string, string> = {};
let contractResponseHeaders: Record<string, string> = {};

Deno.serve(async (req) => {
  corsHeaders = getCorsHeaders(req);
  contractResponseHeaders = {};
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });

  // Cron: exige x-cron-secret para evitar chamadas diretas não autorizadas
  const cronAuth = await authorizeCron(req, {
    corsHeaders: {},
    secretEnvName: "CRON_SECRET",
    headerName: "x-cron-secret",
  });
  if (!cronAuth.ok) return cronAuth.response;

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return json({ error: "missing_env" }, 500);
    }

    const contractResult = await parseContract(req, OwnershipAuditSchemas, {
      corsHeaders,
    });
    if (!contractResult.ok) return contractResult.response;
    contractResponseHeaders = contractResult.responseHeaders;
    const triggeredBy = contractResult.data.triggered_by ?? "cron";

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const t0 = Date.now();
    const { data: reportId, error } = await castRpcResult<{
      data: string | null;
      error: { message: string } | null;
    }>(admin.rpc("audit_ownership_orphans", {
      _triggered_by: triggeredBy,
    }));
    if (error) {
      console.error("[ownership-audit] rpc error", error);
      return json({ error: error.message }, 500);
    }

    const { data: report, error: fetchErr } = await admin
      .from("ownership_audit_reports")
      .select("*")
      .eq("id", reportId)
      .single();

    if (fetchErr) {
      console.error("[ownership-audit] fetch report error", fetchErr);
      return json({ report_id: reportId, warning: "report saved but fetch failed" }, 200);
    }

    console.log(
      `[ownership-audit] ${triggeredBy} done in ${Date.now() - t0}ms — ` +
        `${report.total_tables_scanned} tables, ${report.total_issues_found} issues`,
    );

    return json({
      ok: true,
      report_id: reportId,
      summary: {
        generated_at: report.generated_at,
        total_tables_scanned: report.total_tables_scanned,
        total_issues_found: report.total_issues_found,
        null_owner_count: report.null_owner_count,
        missing_user_count: report.missing_user_count,
        duration_ms: report.duration_ms,
        affected_tables: (report.details as unknown[]).length,
        rls_gaps_count: report.rls_gaps_count ?? 0,
        rls_tables_with_gaps: Array.isArray(report.rls_coverage) ? report.rls_coverage.length : 0,
      },
      details: report.details,
      rls_coverage: report.rls_coverage ?? [],
    });
  } catch (e) {
    console.error("[ownership-audit] uncaught", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, ...contractResponseHeaders, "Content-Type": "application/json" },
  });
}
