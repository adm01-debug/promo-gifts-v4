/**
 * test-cart-limit — Edge function de CI para validar o trigger enforce_seller_cart_limit.
 *
 * IMPORTANTE: cria usuário temporário via auth.admin para evitar:
 *  - Violar FK (seller_id REFERENCES auth.users) com UUID falso
 *  - Contaminar/apagar dados de usuários reais
 * Cleanup: deleteUser cascateia seller_carts (ON DELETE CASCADE).
 *
 * Limite atual: MAX_SELLER_CARTS = 10 (migration 20260623111612).
 */
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { getCorsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAX_SELLER_CARTS = 10; // Espelha o trigger enforce_seller_cart_limit

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // 1. Cria usuário temporário isolado para o teste (não polui dados reais)
  const testEmail = `ci-cart-limit-${Date.now()}@test.internal`;
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: "ci-test-password-2026",
    email_confirm: true,
  });

  if (authErr || !authData?.user?.id) {
    return new Response(
      JSON.stringify({ error: `Falha ao criar usuário de teste: ${authErr?.message}` }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  }

  const seller_id = authData.user.id;

  try {
    // 2. Tenta criar MAX+1 carrinhos (11) — apenas 10 devem ter sucesso
    const TOTAL_ATTEMPTS = MAX_SELLER_CARTS + 1;
    const results = [];
    for (let i = 0; i < TOTAL_ATTEMPTS; i++) {
      const res = await supabase.from("seller_carts").insert({
        seller_id,
        company_id: `ci-comp-${i}-${Date.now()}`,
        company_name: `CI Company ${i}`,
      });
      results.push(res);
    }

    // 3. Verifica contagem final
    const { data: finalCarts } = await supabase
      .from("seller_carts")
      .select("id")
      .eq("seller_id", seller_id);

    const successCount = results.filter((r) => !r.error).length;
    const failCount = results.filter((r) => r.error).length;
    const limitErrors = results
      .filter((r) => r.error)
      .map((r) => r.error?.message)
      .filter(Boolean);

    return new Response(
      JSON.stringify({
        attempts: TOTAL_ATTEMPTS,
        limit_tested: MAX_SELLER_CARTS,
        successful_inserts: successCount,
        failed_inserts: failCount,
        final_count: finalCarts?.length ?? 0,
        // true = exatamente MAX carrinhos criados e o (MAX+1)º foi recusado
        limit_enforced:
          successCount === MAX_SELLER_CARTS &&
          failCount === 1 &&
          finalCarts?.length === MAX_SELLER_CARTS,
        limit_errors: limitErrors,
      }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  } finally {
    // 4. Cleanup: deletar o usuário de teste cascateia todos os seus carrinhos
    await supabase.auth.admin.deleteUser(seller_id);
  }
});
