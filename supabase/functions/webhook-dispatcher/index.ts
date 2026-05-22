// webhook-dispatcher: dispatches an event to all active outbound_webhooks
// subscribed to that event. HMAC signs payload with webhook secret. Retries
// with backoff and logs each attempt to webhook_deliveries.
//
// AUTORIZAÇÃO (Onda 1 hardening, 2026-05-14):
//   - Modo A: header `x-dispatcher-secret: <SECRET>` (triggers DB, RPCs, cron)
//   - Modo B: `Authorization: Bearer <user JWT>` + role >= supervisor (frontend)
//   - test_mode e replay_delivery_id exigem Modo B (operação sensível)
//   - Retrocompat: se WEBHOOK_DISPATCHER_SECRET não estiver setado, aceita anônimo com warning
//
// VERSIONAMENTO (feat/contract-tests-zod-v1-v2):
//   - v1 (default): schema atual { event, payload, replay_delivery_id, test_mode, test_webhook_id }
//   - v2: adiciona priority, dedupe_window_ms, event_id e mutual-exclusion mais estrita
//
// Ver: supabase/functions/_shared/dispatcher-auth.ts
import { crypto } from "https://deno.land/std@0.224.0/crypto/mod.ts";
import { encodeHex } from "https://deno.land/std@0.224.0/encoding/hex.ts";
import { buildPublicCorsHeaders } from "../_shared/cors.ts";
import { authorizeDispatcher } from "../_shared/dispatcher-auth.ts";
import {
  WebhookDispatcherSchemaByVersion,
  WebhookDispatcherVersions,
  type WebhookDispatcherVersion,
} from "../_shared/contracts/index.ts";
import {
  parseApiVersion,
  withVersionHeaders,
} from "../_shared/contract-versioning.ts";
import { validationError422, invalidJsonError400 } from "../_shared/api-errors.ts";

const corsHeaders = buildPublicCorsHeaders({
  allowMethods: "POST, OPTIONS",
  extraAllowHeaders: ["x-dispatcher-secret", "x-api-version"],
});

// Circuit breaker: 5 falhas consecutivas → desativa o webhook
const CIRCUIT_BREAKER_THRESHOLD = 5;

async function hmacSign(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return encodeHex(new Uint8Array(sig));
}

async function payloadHash(payload: string): Promise<string> {
  const data = new TextEncoder().encode(payload);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return encodeHex(new Uint8Array(hash));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Resolver versão da API antes de qualquer trabalho.
  const versioned = parseApiVersion<WebhookDispatcherVersion>(req, WebhookDispatcherVersions, {
    defaultVersion: "v1",
    deprecated: {},
    corsHeaders,
  });
  if ("error" in versioned) return versioned.error;

  // Guard: require X-Dispatcher-Secret to prevent unauthorized invocations
  const dispatcherSecret = Deno.env.get("WEBHOOK_DISPATCHER_SECRET");
  if (dispatcherSecret) {
    const incoming = req.headers.get("x-dispatcher-secret");
    if (!incoming || incoming !== dispatcherSecret) {
      return withVersionHeaders(
        new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        }),
        versioned,
      );
    }
  }

  try {
    // Body precisa ser parseado antes da auth pra saber se requer Modo B (test_mode/replay).
    // Body parse falha → 400 INVALID_JSON (não vaza info).
    let raw: unknown;
    try {
      const text = await req.text();
      raw = text ? JSON.parse(text) : {};
    } catch {
      return withVersionHeaders(
        invalidJsonError400({ corsHeaders, apiVersion: versioned.version }),
        versioned,
      );
    }

    const schema = WebhookDispatcherSchemaByVersion[versioned.version];
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return withVersionHeaders(
        validationError422(parsed.error, { corsHeaders, apiVersion: versioned.version }),
        versioned,
      );
    }
    let { event, payload } = parsed.data as { event: string; payload?: unknown };
    const { replay_delivery_id, test_mode, test_webhook_id } = parsed.data;

    // Operações que mexem com webhook específico (test/replay) só por Modo B
    const requiresUserContext = !!(test_mode || replay_delivery_id);

    const auth = await authorizeDispatcher(req, {
      corsHeaders,
      requireUserContext: requiresUserContext,
      minRole: "supervisor",
    });
    if (!auth.ok) return auth.response;

    const supabase = auth.supabaseAdmin;

    // Test mode (Onda 13 #9): single-shot, no retries, no DB write, no breaker
    if (test_mode) {
      if (!test_webhook_id) {
        return new Response(JSON.stringify({ error: "test_webhook_id obrigatório em test_mode" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: hook, error: hookErr } = await supabase
        .from("outbound_webhooks")
        .select("id, name, url, secret_ref")
        .eq("id", test_webhook_id)
        .maybeSingle();
      if (hookErr || !hook) {
        return new Response(JSON.stringify({ error: "Webhook não encontrado" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const bodyJson = JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        test: true,
        data: payload ?? null,
      });
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "PromoGifts-Webhooks/1.0 (test)",
        "X-Event": event,
        "X-Webhook-Id": hook.id,
        "X-Test-Mode": "1",
      };
      const secret = hook.secret_ref ? Deno.env.get(hook.secret_ref) : null;
      if (secret) headers["X-Signature-256"] = "sha256=" + await hmacSign(bodyJson, secret);
      const start = Date.now();
      try {
        const res = await fetch(hook.url, { method: "POST", headers, body: bodyJson });
        const respText = (await res.text()).slice(0, 4000);
        return new Response(JSON.stringify({
          ok: true,
          test_mode: true,
          webhook_id: hook.id,
          status_code: res.status,
          latency_ms: Date.now() - start,
          response_body: respText,
          success: res.ok,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (err) {
        return new Response(JSON.stringify({
          ok: true,
          test_mode: true,
          webhook_id: hook.id,
          status_code: null,
          latency_ms: Date.now() - start,
          error: err instanceof Error ? err.message : "Erro de rede",
          success: false,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Replay mode: load the original delivery and re-target only its webhook
    let replayHookId: string | null = null;
    if (replay_delivery_id) {
      const { data: orig, error: origErr } = await supabase
        .from("webhook_deliveries")
        .select("webhook_id, event, payload")
        .eq("id", replay_delivery_id)
        .maybeSingle();
      if (origErr || !orig) {
        return new Response(JSON.stringify({ error: "Delivery não encontrada" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      event = orig.event;
      payload = orig.payload;
      replayHookId = orig.webhook_id;
    }

    let hooksQuery = supabase
      .from("outbound_webhooks")
      .select("*")
      .contains("events", [event]);
    if (replayHookId) {
      hooksQuery = hooksQuery.eq("id", replayHookId); // replay ignora active flag
    } else {
      hooksQuery = hooksQuery.eq("active", true);
    }
    const { data: hooks, error } = await hooksQuery;
    if (error) throw error;

    if (!hooks || hooks.length === 0) {
      return new Response(JSON.stringify({ ok: true, dispatched: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bodyJson = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      data: payload ?? null,
    });
    const phash = await payloadHash(bodyJson);
    const results: Array<Record<string, unknown>> = [];

    for (const hook of hooks) {
      const policy = hook.retry_policy ?? { max_attempts: 3, backoff_seconds: [5, 30, 120] };
      const max = Math.max(1, Math.min(5, Number(policy.max_attempts ?? 3)));
      const backoff = Array.isArray(policy.backoff_seconds) ? policy.backoff_seconds : [5, 30, 120];
      let success = false;
      let attempt = 0;

      while (attempt < max && !success) {
        attempt++;
        try {
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "User-Agent": "PromoGifts-Webhooks/1.0",
            "X-Event": event,
            "X-Webhook-Id": hook.id,
            "X-Delivery-Attempt": String(attempt),
          };
          const secret = hook.secret_ref ? Deno.env.get(hook.secret_ref) : null;
          if (secret) headers["X-Signature-256"] = "sha256=" + await hmacSign(bodyJson, secret);

          const res = await fetch(hook.url, { method: "POST", headers, body: bodyJson });
          const respText = (await res.text()).slice(0, 4000);

          await supabase.from("webhook_deliveries").insert({
            webhook_id: hook.id,
            event,
            payload: payload ?? null,
            payload_hash: phash,
            status_code: res.status,
            response_body_truncated: respText,
            attempt,
            success: res.ok,
            error_message: res.ok ? null : `HTTP ${res.status}`,
          });

          if (res.ok) {
            success = true;
            await supabase.from("outbound_webhooks").update({
              last_triggered_at: new Date().toISOString(),
              total_success: (hook.total_success ?? 0) + 1,
              consecutive_failures: 0,
            }).eq("id", hook.id);
            results.push({ webhook_id: hook.id, status: "success", attempt });
          } else if (attempt < max) {
            const delay = (backoff[attempt - 1] ?? backoff[backoff.length - 1] ?? 30) * 1000;
            await new Promise((r) => setTimeout(r, delay));
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Erro desconhecido";
          await supabase.from("webhook_deliveries").insert({
            webhook_id: hook.id, event, payload: payload ?? null, payload_hash: phash,
            status_code: null, response_body_truncated: msg.slice(0, 4000),
            attempt, success: false, error_message: msg,
          });
          if (attempt < max) {
            const delay = (backoff[attempt - 1] ?? 30) * 1000;
            await new Promise((r) => setTimeout(r, delay));
          }
        }
      }

      if (!success) {
        const newConsecutive = (hook.consecutive_failures ?? 0) + 1;
        const shouldAutoDisable = !replayHookId && newConsecutive >= CIRCUIT_BREAKER_THRESHOLD && hook.active;
        const updatePayload: Record<string, unknown> = {
          total_failure: (hook.total_failure ?? 0) + 1,
          consecutive_failures: newConsecutive,
        };
        if (shouldAutoDisable) {
          updatePayload.active = false;
          updatePayload.auto_disabled_at = new Date().toISOString();
          updatePayload.auto_disabled_reason = `${newConsecutive} falhas consecutivas (circuit breaker)`;
        }
        await supabase.from("outbound_webhooks").update(updatePayload).eq("id", hook.id);
        results.push({
          webhook_id: hook.id,
          status: "failed",
          attempts: attempt,
          consecutive_failures: newConsecutive,
          auto_disabled: shouldAutoDisable,
        });
      }
    }

    return withVersionHeaders(
      new Response(JSON.stringify({ ok: true, dispatched: hooks.length, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
      versioned,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return withVersionHeaders(
      new Response(JSON.stringify({ error: msg }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
      versioned,
    );
  }
});
