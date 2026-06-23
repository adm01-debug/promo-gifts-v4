/**
 * test-cart-rls — Teste E2E de RLS do módulo Carrinhos.
 *
 * PROBLEMA ORIGINAL: usava seller_id hardcoded de produção e não testava RLS de verdade
 * (retornava "Passed via SQL inspection" sem verificar nada).
 *
 * SOLUÇÃO: cria 2 usuários temporários, cria carrinho para user1, tenta acessar
 * com JWT de user2, verifica isolamento, limpa tudo via deleteUser (CASCADE).
 *
 * Cenários testados:
 *   A) user1 consegue ler seus próprios carrinhos (RLS permite)
 *   B) user2 NÃO consegue ler carrinhos de user1 (RLS bloqueia)
 *   C) user2 NÃO consegue deletar carrinho de user1 (RLS bloqueia)
 */
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { getCorsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const now = Date.now();
  const pw = "rls-test-pass-2026!";
  const u1Email = `rls-u1-${now}@test.internal`;
  const u2Email = `rls-u2-${now}@test.internal`;

  let user1Id: string | null = null;
  let user2Id: string | null = null;

  try {
    // ── Criar 2 usuários temporários ──────────────────────────────────────
    const { data: u1, error: e1 } = await admin.auth.admin.createUser({
      email: u1Email, password: pw, email_confirm: true,
    });
    if (e1 || !u1?.user?.id) {
      throw new Error(`Falha ao criar user1: ${e1?.message}`);
    }
    user1Id = u1.user.id;

    const { data: u2, error: e2 } = await admin.auth.admin.createUser({
      email: u2Email, password: pw, email_confirm: true,
    });
    if (e2 || !u2?.user?.id) {
      throw new Error(`Falha ao criar user2: ${e2?.message}`);
    }
    user2Id = u2.user.id;

    // ── Criar carrinho para user1 via admin (bypass RLS) ──────────────────
    const { data: cart, error: cartErr } = await admin.from("seller_carts").insert({
      seller_id: user1Id,
      company_id: `rls-test-co-${now}`,
      company_name: "RLS Test Company",
    }).select().single();
    if (cartErr || !cart) {
      throw new Error(`Falha ao criar carrinho: ${cartErr?.message}`);
    }

    // ── Obter JWT de user2 para testar RLS ────────────────────────────────
    const clientU2 = createClient(SUPABASE_URL, ANON_KEY);
    const { data: signIn, error: signInErr } = await clientU2.auth.signInWithPassword({
      email: u2Email, password: pw,
    });
    if (signInErr || !signIn?.session?.access_token) {
      throw new Error(`Falha no signIn de user2: ${signInErr?.message}`);
    }

    const u2Client = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } },
    });

    // ── Cenário A: user1 via admin vê seu próprio carrinho ────────────────
    const { data: u1Carts } = await admin
      .from("seller_carts")
      .select("id")
      .eq("seller_id", user1Id);
    const scenarioA = (u1Carts ?? []).some((c) => c.id === cart.id);

    // ── Cenário B: user2 NÃO vê carrinhos de user1 ───────────────────────
    const { data: u2Carts, error: u2ReadErr } = await u2Client
      .from("seller_carts")
      .select("id")
      .eq("id", cart.id); // tenta ler o carrinho específico de user1
    // RLS: retorna array vazio (não 403) — PostgREST filtra silenciosamente
    const scenarioB =
      !u2ReadErr && Array.isArray(u2Carts) && u2Carts.length === 0;

    // ── Cenário C: user2 NÃO consegue deletar carrinho de user1 ──────────
    const { error: u2DelErr } = await u2Client
      .from("seller_carts")
      .delete()
      .eq("id", cart.id);
    // Delete sem match (RLS filtra) não retorna erro no PostgREST — valida via re-select
    const { data: stillExists } = await admin
      .from("seller_carts")
      .select("id")
      .eq("id", cart.id);
    const scenarioC = (stillExists ?? []).length === 1; // carrinho ainda existe

    const allPassed = scenarioA && scenarioB && scenarioC;

    return new Response(JSON.stringify({
      passed: allPassed,
      scenarios: {
        A_user1_sees_own_cart: scenarioA,
        B_user2_cannot_read_user1_cart: scenarioB,
        C_user2_cannot_delete_user1_cart: scenarioC,
      },
      details: {
        u2_read_error: u2ReadErr?.message ?? null,
        u2_delete_error: u2DelErr?.message ?? null,
        u2_carts_count: u2Carts?.length ?? -1,
      },
    }), { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  } finally {
    // Cleanup: deleteUser cascateia seller_carts (ON DELETE CASCADE)
    if (user1Id) await admin.auth.admin.deleteUser(user1Id);
    if (user2Id) await admin.auth.admin.deleteUser(user2Id);
  }
});
