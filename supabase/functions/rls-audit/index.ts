import { getCorsHeaders } from "../_shared/cors.ts";
import { safeErrorResponse } from "../_shared/error-response.ts";
// RLS Audit: testa SELECT/INSERT/UPDATE/DELETE em quotes, orders e
// discount_approval_requests usando o JWT do usuário logado (vendedor).
// Cada cenário retorna ✅/❌ + detalhe para evidência de auditoria.
// BULK-SDK-FIX: Changed from esm.sh URL to npm: direct.
// Version upgraded @2.95.0 → @2.49.4 to align with project standard (supabase-js@2.49.4).
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

interface ScenarioResult {
  table: string;
  op: "SELECT" | "INSERT" | "UPDATE" | "DELETE";
  scenario: string;
  expected: "allow" | "deny";
  actual: "allow" | "deny" | "error";
  passed: boolean;
  detail?: string;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "missing_auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Cliente que representa o usuário (respeita RLS)
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    // Cliente admin para criar registro "de outro vendedor" e cleanup
    const adminClient = createClient(SUPABASE_URL, SERVICE, {
      auth: { persistSession: false },
    });

    const { data: userResp, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userResp.user) {
      return new Response(JSON.stringify({ error: "invalid_jwt" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sellerId = userResp.user.id;

    // Outro vendedor "fantasma" — UUID fixo que não corresponde ao usuário
    const otherSellerId = "00000000-0000-0000-0000-00000000dead";

    const results: ScenarioResult[] = [];
    const push = (r: ScenarioResult) => results.push(r);

    // -------- helpers --------
    const classify = (error: unknown, data: unknown): "allow" | "deny" => {
      if (error) {
        const msg = String((error as { message?: string })?.message ?? "");
        if (/row-level security|permission denied|violates/i.test(msg)) return "deny";
      }
      // SELECT que retorna [] em RLS = "deny" (filtrado)
      if (Array.isArray(data) && data.length === 0) return "deny";
      return "allow";
    };

    // ============ QUOTES ============
    // 1. SELECT próprio (allow esperado) — cria via admin um quote do seller
    const ownQuote = await adminClient
      .from("quotes")
      .insert({
        seller_id: sellerId,
        client_name: "[RLS-AUDIT] Cliente Próprio",
        status: "draft",
        subtotal: 0,
        total: 0,
      })
      .select("id")
      .single();

    // Quote de outro vendedor
    const foreignQuote = await adminClient
      .from("quotes")
      .insert({
        seller_id: otherSellerId,
        client_name: "[RLS-AUDIT] Cliente Alheio",
        status: "draft",
        subtotal: 0,
        total: 0,
      })
      .select("id")
      .single();

    if (ownQuote.data && foreignQuote.data) {
      // SELECT próprio
      {
        const { data, error } = await userClient
          .from("quotes").select("id").eq("id", ownQuote.data.id).maybeSingle();
        const actual = error ? "error" : data ? "allow" : "deny";
        push({
          table: "quotes", op: "SELECT", scenario: "Ler próprio orçamento",
          expected: "allow", actual: actual as any,
          passed: actual === "allow",
          detail: error?.message,
        });
      }
      // SELECT alheio
      {
        const { data, error } = await userClient
          .from("quotes").select("id").eq("id", foreignQuote.data.id).maybeSingle();
        const actual = error ? "deny" : data ? "allow" : "deny";
        push({
          table: "quotes", op: "SELECT", scenario: "Não ler orçamento de outro vendedor",
          expected: "deny", actual: actual as any,
          passed: actual === "deny",
          detail: data ? `vazou id=${data.id}` : error?.message,
        });
      }
      // UPDATE alheio
      {
        const { data, error } = await userClient
          .from("quotes").update({ client_name: "HACKED" })
          .eq("id", foreignQuote.data.id).select("id");
        const actual = classify(error, data);
        push({
          table: "quotes", op: "UPDATE", scenario: "Não atualizar orçamento de outro vendedor",
          expected: "deny", actual,
          passed: actual === "deny",
          detail: error?.message ?? (data?.length ? `afetou ${data.length}` : undefined),
        });
      }
      // UPDATE próprio
      {
        const { data, error } = await userClient
          .from("quotes").update({ client_name: "[RLS-AUDIT] OK" })
          .eq("id", ownQuote.data.id).select("id");
        const actual = classify(error, data);
        push({
          table: "quotes", op: "UPDATE", scenario: "Atualizar próprio orçamento",
          expected: "allow", actual,
          passed: actual === "allow",
          detail: error?.message,
        });
      }
      // DELETE alheio
      {
        const { data, error } = await userClient
          .from("quotes").delete().eq("id", foreignQuote.data.id).select("id");
        const actual = classify(error, data);
        push({
          table: "quotes", op: "DELETE", scenario: "Não excluir orçamento de outro vendedor",
          expected: "deny", actual,
          passed: actual === "deny",
          detail: error?.message,
        });
      }
    }

    // INSERT com seller_id próprio (allow)
    {
      const { data, error } = await userClient
        .from("quotes").insert({
          client_name: "[RLS-AUDIT] Insert Próprio",
          status: "draft", subtotal: 0, total: 0,
        }).select("id, seller_id").single();
      const actual = error ? "deny" : "allow";
      push({
        table: "quotes", op: "INSERT", scenario: "Inserir com seller_id = auth.uid() (auto)",
        expected: "allow", actual: actual as any,
        passed: actual === "allow" && data?.seller_id === sellerId,
        detail: error?.message ?? `seller_id=${data?.seller_id}`,
      });
      if (data?.id) await adminClient.from("quotes").delete().eq("id", data.id);
    }
    // INSERT forçando seller_id alheio (deny esperado)
    {
      const { data, error } = await userClient
        .from("quotes").insert({
          seller_id: otherSellerId,
          client_name: "[RLS-AUDIT] Insert Alheio",
          status: "draft", subtotal: 0, total: 0,
        }).select("id");
      const actual = classify(error, data);
      push({
        table: "quotes", op: "INSERT", scenario: "Não inserir com seller_id de outro vendedor",
        expected: "deny", actual,
        passed: actual === "deny",
        detail: error?.message,
      });
      if (data?.[0]?.id) await adminClient.from("quotes").delete().eq("id", data[0].id);
    }

    // ============ ORDERS ============
    const ownOrder = await adminClient.from("orders").insert({
      seller_id: sellerId,
      client_name: "[RLS-AUDIT] Order Próprio",
      status: "pending", total: 0,
    }).select("id").single();
    const foreignOrder = await adminClient.from("orders").insert({
      seller_id: otherSellerId,
      client_name: "[RLS-AUDIT] Order Alheio",
      status: "pending", total: 0,
    }).select("id").single();

    if (ownOrder.data && foreignOrder.data) {
      {
        const { data, error } = await userClient
          .from("orders").select("id").eq("id", ownOrder.data.id).maybeSingle();
        const actual = error ? "error" : data ? "allow" : "deny";
        push({
          table: "orders", op: "SELECT", scenario: "Ler próprio pedido",
          expected: "allow", actual: actual as any, passed: actual === "allow",
          detail: error?.message,
        });
      }
      {
        const { data, error } = await userClient
          .from("orders").select("id").eq("id", foreignOrder.data.id).maybeSingle();
        const actual = error ? "deny" : data ? "allow" : "deny";
        push({
          table: "orders", op: "SELECT", scenario: "Não ler pedido de outro vendedor",
          expected: "deny", actual: actual as any, passed: actual === "deny",
        });
      }
      {
        const { data, error } = await userClient.from("orders")
          .update({ client_name: "HACKED" })
          .eq("id", foreignOrder.data.id).select("id");
        const actual = classify(error, data);
        push({
          table: "orders", op: "UPDATE", scenario: "Não atualizar pedido de outro vendedor",
          expected: "deny", actual, passed: actual === "deny",
          detail: error?.message,
        });
      }
      {
        const { data, error } = await userClient.from("orders")
          .delete().eq("id", foreignOrder.data.id).select("id");
        const actual = classify(error, data);
        push({
          table: "orders", op: "DELETE", scenario: "Não excluir pedido de outro vendedor",
          expected: "deny", actual, passed: actual === "deny",
          detail: error?.message,
        });
      }
    }

    // ============ DISCOUNT_APPROVAL_REQUESTS ============
    // Precisa de quote_id; criamos um quote do seller via admin
    if (ownQuote.data) {
      const ownReq = await adminClient.from("discount_approval_requests").insert({
        seller_id: sellerId,
        quote_id: ownQuote.data.id,
        requested_discount_pct: 5,
        status: "pending",
      }).select("id").single();

      // Para "alheio" precisamos de um quote do outro seller também
      const foreignReq = foreignQuote.data
        ? await adminClient.from("discount_approval_requests").insert({
            seller_id: otherSellerId,
            quote_id: foreignQuote.data.id,
            requested_discount_pct: 5,
            status: "pending",
          }).select("id").single()
        : { data: null, error: null as any };

      if (ownReq.data) {
        const { data, error } = await userClient
          .from("discount_approval_requests").select("id")
          .eq("id", ownReq.data.id).maybeSingle();
        const actual = error ? "error" : data ? "allow" : "deny";
        push({
          table: "discount_approval_requests", op: "SELECT",
          scenario: "Ler própria solicitação de desconto",
          expected: "allow", actual: actual as any, passed: actual === "allow",
          detail: error?.message,
        });
      }
      if (foreignReq.data) {
        const { data } = await userClient
          .from("discount_approval_requests").select("id")
          .eq("id", foreignReq.data.id).maybeSingle();
        const actual = data ? "allow" : "deny";
        push({
          table: "discount_approval_requests", op: "SELECT",
          scenario: "Não ler solicitação de desconto alheia",
          expected: "deny", actual: actual as any, passed: actual === "deny",
        });

        const upd = await userClient.from("discount_approval_requests")
          .update({ status: "approved" })
          .eq("id", foreignReq.data.id).select("id");
        const a2 = classify(upd.error, upd.data);
        push({
          table: "discount_approval_requests", op: "UPDATE",
          scenario: "Não aprovar/alterar solicitação alheia",
          expected: "deny", actual: a2, passed: a2 === "deny",
          detail: upd.error?.message,
        });

        const del = await userClient.from("discount_approval_requests")
          .delete().eq("id", foreignReq.data.id).select("id");
        const a3 = classify(del.error, del.data);
        push({
          table: "discount_approval_requests", op: "DELETE",
          scenario: "Não excluir solicitação alheia",
          expected: "deny", actual: a3, passed: a3 === "deny",
          detail: del.error?.message,
        });
      }

      // INSERT alheio
      if (foreignQuote.data) {
        const { data, error } = await userClient
          .from("discount_approval_requests").insert({
            seller_id: otherSellerId,
            quote_id: foreignQuote.data.id,
            requested_discount_pct: 99,
            status: "pending",
          }).select("id");
        const actual = classify(error, data);
        push({
          table: "discount_approval_requests", op: "INSERT",
          scenario: "Não criar solicitação com seller_id alheio",
          expected: "deny", actual, passed: actual === "deny",
          detail: error?.message,
        });
        if (data?.[0]?.id) await adminClient.from("discount_approval_requests").delete().eq("id", data[0].id);
      }
    }

    // -------- cleanup --------
    if (ownQuote.data?.id) {
      await adminClient.from("discount_approval_requests").delete().eq("quote_id", ownQuote.data.id);
      await adminClient.from("quotes").delete().eq("id", ownQuote.data.id);
    }
    if (foreignQuote.data?.id) {
      await adminClient.from("discount_approval_requests").delete().eq("quote_id", foreignQuote.data.id);
      await adminClient.from("quotes").delete().eq("id", foreignQuote.data.id);
    }
    if (ownOrder.data?.id) await adminClient.from("orders").delete().eq("id", ownOrder.data.id);
    if (foreignOrder.data?.id) await adminClient.from("orders").delete().eq("id", foreignOrder.data.id);

    const summary = {
      total: results.length,
      passed: results.filter((r) => r.passed).length,
      failed: results.filter((r) => !r.passed).length,
      seller_id: sellerId,
      ran_at: new Date().toISOString(),
    };

    return new Response(JSON.stringify({ summary, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    return safeErrorResponse(e, { corsHeaders, publicMessage: "internal", logLabel: "rls-audit error:" });
  }
});
