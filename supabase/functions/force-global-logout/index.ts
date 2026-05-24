import { getCorsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { parseContract } from "../_shared/contracts/index.ts";
import {
  ForceGlobalLogoutSchemas,
} from "../_shared/contracts/schemas/force-global-logout.ts";

// Module-scope CORS headers — atribuído per-request no handler.
let corsHeaders: Record<string, string> = {};
let contractResponseHeaders: Record<string, string> = {};

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, ...contractResponseHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  corsHeaders = getCorsHeaders(req);
  contractResponseHeaders = {};

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonRes({ error: "Não autorizado" }, 401);

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) return jsonRes({ error: "Não autorizado" }, 401);

    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);

    const roles = (callerRoles ?? []).map((r: { role: string }) => r.role);
    const isPrivileged =
      roles.includes("admin") ||
      roles.includes("supervisor") ||
      roles.includes("dev");

    if (!isPrivileged) {
      return jsonRes({ error: "Apenas administradores ou desenvolvedores podem forçar logout global" }, 403);
    }

    // Parse + validate body via parseContract
    const contractResult = await parseContract(req, ForceGlobalLogoutSchemas, {
      corsHeaders,
    });
    if (!contractResult.ok) return contractResult.response;
    contractResponseHeaders = contractResult.responseHeaders;
    // confirm já validado pelo schema (literal "FORCE_LOGOUT_ALL")

    // List all users and sign them out (exclude caller to keep current admin session)
    let totalSignedOut = 0;
    let errors = 0;
    let page = 1;
    const perPage = 1000;

    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (error) {
        return jsonRes({ error: error.message }, 500);
      }

      const users = data?.users || [];
      if (users.length === 0) break;

      for (const u of users) {
        if (u.id === caller.id) continue;
        const { error: signOutErr } = await supabaseAdmin.auth.admin.signOut(u.id, "global");
        if (signOutErr) {
          errors++;
        } else {
          totalSignedOut++;
        }
      }

      if (users.length < perPage) break;
      page++;
    }

    // Log to audit
    await supabaseAdmin.from("admin_audit_log").insert({
      user_id: caller.id,
      action: "force_global_logout",
      resource_type: "auth",
      details: { signed_out: totalSignedOut, errors, kept_caller: caller.id },
      ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      user_agent: req.headers.get("user-agent") || null,
    });

    return jsonRes({ success: true, signed_out: totalSignedOut, errors });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return jsonRes({ error: msg }, 500);
  }
});
