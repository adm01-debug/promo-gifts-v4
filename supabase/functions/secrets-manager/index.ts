import { getCorsHeaders } from "../_shared/cors.ts";
// Admin-only secrets manager for the Conexões hub.
// Persists values in `integration_credentials` and never returns plaintext to the client.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import {
  invalidateCredentialCache,
  getCredentialCacheMetrics,
  resetCredentialCacheMetrics,
} from "../_shared/credentials.ts";
import { writeAuditEntry, extractRequestMeta } from "../_shared/audit-log.ts";
import { getOrCreateRequestId, REQUEST_ID_HEADER } from "../_shared/request-id.ts";

const SOURCE = "secrets-manager";

const ALLOWED_SECRETS = new Set<string>([
  "EXTERNAL_PROMOBRIND_URL",
  "EXTERNAL_PROMOBRIND_SERVICE_ROLE_KEY",
  "EXTERNAL_PROMOBRIND_ANON_KEY",
  "EXTERNAL_CRM_URL",
  "EXTERNAL_CRM_SERVICE_ROLE_KEY",
  "EXTERNAL_CRM_ANON_KEY",
  "BITRIX24_WEBHOOK_URL",
  "BITRIX24_DOMAIN",
  "BITRIX24_USER_ID",
  "BITRIX24_TOKEN",
  "N8N_BASE_URL",
  "N8N_API_KEY",
  "MCP_SHARED_SECRET",
  "GITHUB_TOKEN",
  "GITHUB_REPO",
  "GITHUB_DEFAULT_BRANCH",
]);

const ALLOWED_PREFIXES = [
  "OUTBOUND_WEBHOOK_SECRET_",
  "INBOUND_WEBHOOK_HMAC_",
];

function isAllowedSecretName(name: string): boolean {
  if (ALLOWED_SECRETS.has(name)) return true;
  return ALLOWED_PREFIXES.some((p) => name.startsWith(p));
}

const BodySchema = z.object({
  action: z.enum([
    "list",
    "set",
    "delete",
    "status",
    "rotate",
    "rotation_history",
    "refresh_cache",
    "cache_metrics",
    "reset_cache_metrics",
  ]),
  names: z.array(z.string()).optional(),
  name: z.string().optional(),
  value: z.string().optional(),
  notes: z.string().max(500).optional(),
});

function maskValue(v: string | undefined | null): {
  has_value: boolean;
  masked_suffix: string | null;
  length: number;
} {
  if (!v) return { has_value: false, masked_suffix: null, length: 0 };
  const suffix = v.length >= 4 ? v.slice(-4) : v;
  return { has_value: true, masked_suffix: suffix, length: v.length };
}

Deno.serve(async (req) => {
  const requestId = getOrCreateRequestId(req);
  // X-Request-Id propagado em TODA resposta via spread de corsHeaders.
  const corsHeaders = { ...getCorsHeaders(req), [REQUEST_ID_HEADER]: requestId };
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const { ip, ua } = extractRequestMeta(req);

  // Service-role client iniciado cedo p/ permitir auditoria mesmo em falhas de auth
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const service = createClient(supabaseUrl, serviceKey);

  const auditDenied = async (
    userId: string | null,
    reason: string,
    extra: Record<string, unknown> = {},
  ) => {
    await writeAuditEntry(service, {
      user_id: userId,
      action: "secrets_manager.access_denied",
      resource_type: "secret",
      resource_id: null,
      ip_address: ip,
      user_agent: ua,
      request_id: requestId,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - startedMs,
      status: "denied",
      payload_summary: {},
      source: SOURCE,
      details: { reason, ...extra },
    });
  };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      await auditDenied(null, "missing_token");
      return new Response(JSON.stringify({ error: "Token de autenticação ausente" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      await auditDenied(null, "invalid_jwt", { detail: userErr?.message });
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roles } = await service
      .from("user_roles").select("role").eq("user_id", userData.user.id);
    // Hardening: gerência de credenciais técnicas (rota /admin/conexoes é devOnly)
    // exige perfil `dev`. Admin/supervisor não têm mais acesso a secrets.
    const isDev = (roles ?? []).some((r: { role: string }) => r.role === "dev");
    if (!isDev) {
      await auditDenied(userData.user.id, "not_dev", { roles: (roles ?? []).map((r: { role: string }) => r.role) });
      return new Response(
        JSON.stringify({ ok: false, error: { code: "forbidden", message: "Apenas desenvolvedores (dev) podem gerenciar credenciais técnicas" } }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Payload inválido", details: parsed.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const { action, names, name, value, notes } = parsed.data;

    // Helper: load DB rows for a list of names
    async function loadFromDb(targets: string[]) {
      type Row = { masked_suffix: string | null; length: number; updated_at: string; updated_by: string | null };
      if (targets.length === 0) return new Map<string, Row>();
      const { data } = await service
        .from("integration_credentials")
        .select("secret_name, masked_suffix, length, updated_at, updated_by")
        .in("secret_name", targets);
      const map = new Map<string, Row>();
      for (const row of (data ?? []) as Array<{ secret_name: string } & Row>) {
        map.set(row.secret_name, {
          masked_suffix: row.masked_suffix,
          length: row.length,
          updated_at: row.updated_at,
          updated_by: row.updated_by,
        });
      }
      return map;
    }

    // Helper: resolve uuid → email via auth.admin (bounded single page; admin tool)
    async function resolveEmails(ids: string[]): Promise<Map<string, string>> {
      const map = new Map<string, string>();
      if (ids.length === 0) return map;
      const { data: usersPage } = await service.auth.admin.listUsers({ page: 1, perPage: 200 });
      for (const u of usersPage?.users ?? []) {
        if (ids.includes(u.id) && u.email) map.set(u.id, u.email);
      }
      return map;
    }


    if (action === "rotation_history") {
      const baseQ = service
        .from("secret_rotation_log")
        .select("*")
        .order("rotated_at", { ascending: false })
        .limit(100);
      const { data: history, error: histErr } = name
        ? await baseQ.eq("secret_name", name)
        : await baseQ;
      if (histErr) throw histErr;

      // Enrich each entry with rotated_by_email via auth.admin lookup
      const rows = (history ?? []) as Array<{ rotated_by: string | null } & Record<string, unknown>>;
      const uniqueIds = Array.from(new Set(rows.map((r) => r.rotated_by).filter((v): v is string => !!v)));
      const emailMap = await resolveEmails(uniqueIds);
      const enriched = rows.map((r) => ({
        ...r,
        rotated_by_email: r.rotated_by ? emailMap.get(r.rotated_by) ?? null : null,
      }));

      return new Response(JSON.stringify({ ok: true, history: enriched }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list" || action === "status") {
      const requested = names && names.length > 0 ? names : Array.from(ALLOWED_SECRETS);
      const allowed = requested.filter(isAllowedSecretName);
      const dbMap = await loadFromDb(allowed);
      const updaterIds = Array.from(
        new Set(
          Array.from(dbMap.values())
            .map((r) => r.updated_by)
            .filter((v): v is string => !!v),
        ),
      );
      const emailMap = await resolveEmails(updaterIds);
      const results = allowed.map((n) => {
        const dbRow = dbMap.get(n);
        if (dbRow?.length) {
          return {
            name: n,
            has_value: true,
            masked_suffix: dbRow.masked_suffix,
            length: dbRow.length,
            updated_at: dbRow.updated_at,
            updated_by: dbRow.updated_by,
            updated_by_email: dbRow.updated_by ? emailMap.get(dbRow.updated_by) ?? null : null,
            source: "db" as const,
            env_fallback_active: false,
          };
        }
        const env = maskValue(Deno.env.get(n) ?? null);
        return {
          name: n,
          has_value: env.has_value,
          masked_suffix: env.masked_suffix,
          length: env.length,
          updated_at: null as string | null,
          updated_by: null as string | null,
          updated_by_email: null as string | null,
          source: env.has_value ? ("env" as const) : ("none" as const),
          env_fallback_active: env.has_value,
        };
      });
      return new Response(JSON.stringify({ ok: true, secrets: results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "refresh_cache") {
      invalidateCredentialCache(name);
      await service.from("admin_audit_log").insert({
        user_id: userData.user.id,
        action: "secret_cache_refreshed",
        resource_type: "secret",
        resource_id: name ?? "*",
        details: { scope: name ? "single" : "all" },
      });
      return new Response(
        JSON.stringify({ ok: true, refreshed: name ?? "all", message: name ? `Cache de ${name} invalidado.` : "Cache de credenciais invalidado." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "cache_metrics") {
      const snapshot = getCredentialCacheMetrics();
      return new Response(JSON.stringify({ ok: true, metrics: snapshot }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reset_cache_metrics") {
      resetCredentialCacheMetrics();
      await service.from("admin_audit_log").insert({
        user_id: userData.user.id,
        action: "secret_cache_metrics_reset",
        resource_type: "secret",
        resource_id: "*",
        details: {},
      });
      return new Response(
        JSON.stringify({ ok: true, message: "Métricas do cache reiniciadas neste isolate." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "set" || action === "rotate") {
      if (!name || !isAllowedSecretName(name)) {
        return new Response(
          JSON.stringify({ ok: false, error: { code: "not_whitelisted", message: "Nome de secret não permitido" } }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (!value || value.length < 4) {
        return new Response(
          JSON.stringify({ ok: false, error: { code: "invalid_value", message: "Valor inválido (mínimo 4 caracteres)" } }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Capture previous state (DB > env) for rotation log + was_update flag
      const prevMap = await loadFromDb([name]);
      const prevDb = prevMap.get(name);
      const previousSuffix = prevDb?.masked_suffix ?? maskValue(Deno.env.get(name) ?? null).masked_suffix;
      const wasUpdate = !!prevDb && (prevDb.length ?? 0) > 0;
      const next = maskValue(value);

      const { error: upsertErr } = await service
        .from("integration_credentials")
        .upsert(
          {
            secret_name: name,
            secret_value: value,
            updated_by: userData.user.id,
            notes: notes ?? null,
          },
          { onConflict: "secret_name" },
        );
      if (upsertErr) {
        console.error("secrets-manager upsert error:", upsertErr.message);
        return new Response(
          JSON.stringify({ ok: false, error: { code: "db_error", message: "Falha ao gravar o segredo" } }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      invalidateCredentialCache(name);

      // Re-read the persisted row so the suffix returned comes from the trigger, not the client string
      const { data: storedRow } = await service
        .from("integration_credentials")
        .select("secret_name, masked_suffix, length, updated_at")
        .eq("secret_name", name)
        .maybeSingle();

      const finalSuffix = storedRow?.masked_suffix ?? next.masked_suffix;
      const finalLength = storedRow?.length ?? value.length;
      const finalUpdatedAt = storedRow?.updated_at ?? new Date().toISOString();

      // Log every save operation (set OR rotate) so the credential history shows the full timeline
      await service.from("secret_rotation_log").insert({
        secret_name: name,
        rotated_by: userData.user.id,
        previous_suffix: previousSuffix,
        new_suffix: finalSuffix,
        notes: notes ?? null,
        action_type: action === "rotate" ? "rotate" : "set",
      });

      await service.from("admin_audit_log").insert({
        user_id: userData.user.id,
        action: action === "rotate" ? "secret_rotated" : "secret_set",
        resource_type: "secret",
        resource_id: name,
        details: { previous_suffix: previousSuffix, new_suffix: finalSuffix, length: finalLength, was_update: wasUpdate },
      });

      return new Response(
        JSON.stringify({
          ok: true,
          stored: true,
          was_update: wasUpdate,
          previous_suffix: previousSuffix,
          new_suffix: finalSuffix,
          masked_suffix: finalSuffix,
          length: finalLength,
          secret: {
            name,
            masked_suffix: finalSuffix,
            length: finalLength,
            updated_at: finalUpdatedAt,
            source: "db" as const,
          },
          message: action === "rotate"
            ? "Credencial rotacionada e persistida com segurança."
            : wasUpdate
              ? "Credencial atualizada e disponível para as integrações."
              : "Credencial salva e disponível para as integrações.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "delete") {
      if (!name || !isAllowedSecretName(name)) {
        return new Response(JSON.stringify({ error: "Nome de secret não permitido" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error: delErr } = await service
        .from("integration_credentials")
        .delete()
        .eq("secret_name", name);
      if (delErr) throw delErr;

      invalidateCredentialCache(name);

      await service.from("admin_audit_log").insert({
        user_id: userData.user.id,
        action: "secret_deleted",
        resource_type: "secret",
        resource_id: name,
        details: {},
      });

      return new Response(
        JSON.stringify({ ok: true, stored: true, message: "Credencial removida do banco." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ ok: false, error: { code: "unknown_action", message: "Ação desconhecida" } }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return new Response(JSON.stringify({ ok: false, error: { code: "unexpected", message: msg } }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
