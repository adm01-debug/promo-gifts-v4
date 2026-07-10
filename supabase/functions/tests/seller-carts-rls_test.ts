/**
 * Integração — RLS de `seller_carts.notes`.
 *
 * Objetivo: provar em runtime, com dois JWTs de sellers distintos,
 * que `seller_carts` NÃO é acessível cruzado — nem leitura nem escrita.
 *
 * Comportamento esperado da policy única `ALL` com
 * `qual = with_check = (seller_id = auth.uid())`:
 *   • Seller A vê e edita apenas seus próprios carrinhos.
 *   • Seller B recebe zero linhas ao selecionar carrinhos do A.
 *   • UPDATE/DELETE de B em linhas do A afetam zero linhas
 *     (RLS filtra silenciosamente; PostgREST não retorna erro).
 *
 * Como executar localmente:
 *   export SUPABASE_URL="https://<seu-project>.supabase.co"
 *   export SUPABASE_ANON_KEY="<anon key>"
 *   export TEST_SELLER_A_JWT="<access_token do vendedor A>"
 *   export TEST_SELLER_B_JWT="<access_token do vendedor B>"
 *   deno test --allow-net --allow-env supabase/functions/tests/seller-carts-rls_test.ts
 *
 * Sem essas variáveis o teste faz skip-graceful (não falha o CI).
 * Os JWTs precisam ser access tokens válidos (não refresh) obtidos
 * via `supabase.auth.signInWithPassword` para dois usuários de teste
 * criados previamente no projeto.
 */
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const JWT_A = Deno.env.get("TEST_SELLER_A_JWT") ?? "";
const JWT_B = Deno.env.get("TEST_SELLER_B_JWT") ?? "";

const missing = [
  ["SUPABASE_URL", SUPABASE_URL],
  ["SUPABASE_ANON_KEY", SUPABASE_ANON_KEY],
  ["TEST_SELLER_A_JWT", JWT_A],
  ["TEST_SELLER_B_JWT", JWT_B],
]
  .filter(([, v]) => !v)
  .map(([k]) => k);

const shouldSkip = missing.length > 0;

function clientAs(jwt: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Marker único desta execução — evita colisão com dados residuais.
const CANARY = `SEGREDO_INTERNO_${crypto.randomUUID()}`;

Deno.test({
  name: "seller_carts RLS: seller B não lê nem edita notas do seller A",
  ignore: shouldSkip,
  fn: async () => {
    if (shouldSkip) {
      console.warn(
        `[skip] credenciais ausentes: ${missing.join(", ")}. ` +
          `Rode com SUPABASE_URL/ANON_KEY + TEST_SELLER_A_JWT + TEST_SELLER_B_JWT.`,
      );
      return;
    }

    const a = clientAs(JWT_A);
    const b = clientAs(JWT_B);

    // Descobre uid de A e B via getUser() — falha rápido se JWT inválido.
    const [aUser, bUser] = await Promise.all([a.auth.getUser(), b.auth.getUser()]);
    assert(aUser.data.user?.id, "JWT A inválido");
    assert(bUser.data.user?.id, "JWT B inválido");
    assert(
      aUser.data.user!.id !== bUser.data.user!.id,
      "JWT A e B devem ser usuários diferentes",
    );

    // 1) Seller A cria um carrinho com nota interna canário.
    const { data: created, error: createErr } = await a
      .from("seller_carts")
      .insert({
        company_id: `rls-test-${crypto.randomUUID().slice(0, 8)}`,
        company_name: "RLS Test Co",
        notes: CANARY,
      })
      .select("id, seller_id, notes")
      .single();

    assertEquals(createErr, null, `insert por A falhou: ${createErr?.message}`);
    assert(created?.id, "carrinho de A não foi criado");
    assertEquals(created!.seller_id, aUser.data.user!.id);
    assertEquals(created!.notes, CANARY);

    const cartId = created!.id as string;

    try {
      // 2) Seller B tenta LER o carrinho de A → zero linhas visíveis.
      const { data: bReadById, error: bReadErr } = await b
        .from("seller_carts")
        .select("id, notes")
        .eq("id", cartId);
      assertEquals(bReadErr, null);
      assertEquals(bReadById?.length, 0, "RLS falhou: B leu carrinho de A por id");

      const { data: bReadByNotes } = await b
        .from("seller_carts")
        .select("id")
        .eq("notes", CANARY);
      assertEquals(
        bReadByNotes?.length,
        0,
        "RLS falhou: B leu carrinho de A filtrando por notes",
      );

      // 3) Seller B tenta ATUALIZAR a nota de A → RLS filtra silenciosamente.
      const { data: bUpdate, error: bUpdErr } = await b
        .from("seller_carts")
        .update({ notes: "HACKED_BY_B" })
        .eq("id", cartId)
        .select("id");
      assertEquals(bUpdErr, null);
      assertEquals(bUpdate?.length, 0, "RLS falhou: B conseguiu UPDATE no carrinho de A");

      // 4) Seller B tenta DELETAR o carrinho de A → RLS filtra silenciosamente.
      const { data: bDelete, error: bDelErr } = await b
        .from("seller_carts")
        .delete()
        .eq("id", cartId)
        .select("id");
      assertEquals(bDelErr, null);
      assertEquals(bDelete?.length, 0, "RLS falhou: B conseguiu DELETE no carrinho de A");

      // 5) Seller A relê e confirma que a nota original está intacta.
      const { data: aReRead, error: aReReadErr } = await a
        .from("seller_carts")
        .select("id, notes")
        .eq("id", cartId)
        .maybeSingle();
      assertEquals(aReReadErr, null);
      assertEquals(aReRead?.notes, CANARY, "nota original foi corrompida");
    } finally {
      // Cleanup: A remove o carrinho de teste.
      await a.from("seller_carts").delete().eq("id", cartId);
    }
  },
});
