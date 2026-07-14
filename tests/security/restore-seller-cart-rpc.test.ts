/**
 * restore_seller_cart RPC — smoke de disponibilidade + end-to-end
 * ----------------------------------------------------------------
 * Garante que a função `public.restore_seller_cart(jsonb)` está publicada
 * no schema cache do banco alvo (canônico em produção). Motivação:
 *
 *   • Em 2026-07-14 o toast "Não foi possível restaurar o carrinho.
 *     Operação não pôde ser concluída." acontecia porque a migração
 *     `20260713101342_restore_seller_cart.sql` tinha sido aplicada no
 *     Lovable Cloud interno (pqp), mas não no canônico
 *     (`doufsxqlfjyuvxuezpln`) — que é o alvo do supabase client.
 *   • O fallback client-side mascarava o problema até bater em FK/RLS,
 *     e o `mapRestoreCartError` caía em "unknown".
 *
 * Esta suíte protege contra regressão:
 *   1) A RPC RESPONDE (schema cache reconhece a assinatura). Se ausente,
 *      falha com `PGRST202` / `42883` e o teste explica que a migração
 *      não foi aplicada ao banco alvo.
 *   2) A RPC VALIDA o input (`invalid_snapshot` p/ payload não-objeto).
 *   3) A RPC EXECUTA fluxo feliz completo (INSERT cart + items + dedup)
 *      quando SUPABASE_SERVICE_ROLE_KEY estiver disponível (E2E real).
 *      Skipped em fork PR / sandbox sem service_role para não falsear.
 *
 * Fonte de verdade da assinatura:
 *   supabase/migrations/20260713101342_...sql
 *
 * Skipped quando credenciais Supabase ausentes.
 */
import { test, expect, describe } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const hasAnyKey = !!url && (!!anonKey || !!serviceRoleKey);
const hasServiceRole = !!url && !!serviceRoleKey;

/**
 * Códigos que sinalizam "RPC não existe no schema cache".
 * Se aparecerem, a migração não foi aplicada ao banco alvo.
 */
const RPC_MISSING_CODES = new Set(["PGRST202", "42883"]);

describe("restore_seller_cart RPC — disponibilidade no banco alvo", () => {
  test.skipIf(!hasAnyKey)(
    "RPC está publicada no schema cache (não retorna PGRST202/42883)",
    async () => {
      const supabase = createClient(url!, (serviceRoleKey ?? anonKey)!);

      // Payload deliberadamente inválido: força a RPC a responder RÁPIDO
      // com `invalid_snapshot` (22023). Se em vez disso vier PGRST202/42883,
      // a função não existe no schema cache do banco alvo.
      const { error } = await supabase.rpc("restore_seller_cart", {
        _snapshot: "not-an-object" as never,
      });

      if (error && RPC_MISSING_CODES.has(String(error.code))) {
        throw new Error(
          `\n❌ RPC public.restore_seller_cart(jsonb) NÃO encontrada no schema cache do banco alvo.\n` +
            `   URL alvo: ${url}\n` +
            `   Código:   ${error.code}\n` +
            `   Mensagem: ${error.message}\n\n` +
            `Provável causa: a migração 20260713101342_restore_seller_cart.sql\n` +
            `foi aplicada em outro projeto Supabase (ex.: Lovable Cloud interno)\n` +
            `mas não no banco canônico que o app consulta em runtime.\n\n` +
            `Correção: aplicar o SQL da migração no banco canônico\n` +
            `(SQL Editor do Supabase de destino) e reexecutar este teste.`,
        );
      }

      // Qualquer OUTRO erro é OK aqui — o objetivo é apenas provar que a
      // função foi encontrada. Erros de validação (22023) e RLS (42501)
      // significam que a função respondeu, então estão passando.
    },
    15_000,
  );

  test.skipIf(!hasAnyKey)(
    'RPC responde com SQLSTATE do Postgres (invalid_snapshot ou auth) — não com PGRST202',
    async () => {
      const supabase = createClient(url!, (serviceRoleKey ?? anonKey)!);
      const { error } = await supabase.rpc("restore_seller_cart", {
        _snapshot: 42 as never,
      });

      // Se a RPC estiver ausente, o teste acima já falhou com uma mensagem
      // mais didática. Aqui apenas confirmamos que veio um SQLSTATE.
      if (error && RPC_MISSING_CODES.has(String(error.code))) {
        return;
      }

      expect(error, "esperava erro do Postgres, veio null (RPC não deveria aceitar payload inválido/anônimo)").not.toBeNull();

      // Códigos aceitos, todos provam que a RPC existe e RESPONDEU:
      //   22023 = invalid_parameter_value → validação `invalid_snapshot`
      //   28000 = invalid_authorization → guard `not_authenticated` (anon key sem JWT de user)
      //   42501 = insufficient_privilege → `seller_mismatch` / RLS
      // Qualquer outro sugere regressão de comportamento da função.
      const ACCEPTED = new Set(["22023", "28000", "42501"]);
      const codeOk = ACCEPTED.has(String(error?.code ?? ""));
      const msgOk =
        /invalid_snapshot|not_authenticated|seller_mismatch/i.test(error?.message ?? "");
      expect(
        codeOk || msgOk,
        `esperava SQLSTATE 22023/28000/42501, veio: code=${error?.code} message=${error?.message}`,
      ).toBe(true);
    },
    15_000,
  );
});

/**
 * E2E real: só roda com SUPABASE_SERVICE_ROLE_KEY (bypass RLS controlado)
 * porque a RPC exige auth.uid() válido e um seller_id de teste.
 *
 * Estratégia: usa service_role para (a) criar um usuário sintético em
 * auth.users via API admin, (b) simular a chamada como esse usuário, (c)
 * limpar tudo no `finally`.
 *
 * Skipped em CI de fork/sandbox. Requer secret `SUPABASE_SERVICE_ROLE_KEY`.
 */
describe.skipIf(!hasServiceRole)(
  "restore_seller_cart RPC — end-to-end (fluxo feliz)",
  () => {
    test(
      "restaura carrinho + itens + reporta metrics (items_total/inserted/deduped)",
      async (ctx) => {
        const admin = createClient(url!, serviceRoleKey!);

        // 1) Cria usuário sintético — service_role admin API.
        const testEmail = `e2e-restore-${Date.now()}@promobrindes-test.local`;
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email: testEmail,
          email_confirm: true,
          password: crypto.randomUUID(),
        });

        // Detecta env com service_role INVÁLIDO (sandbox local, PR de fork
        // com secret quebrado). Não é falha do produto — skip explícito.
        if (createErr && /invalid api key|invalid.+key|401/i.test(createErr.message)) {
          ctx.skip();
          return;
        }
        expect(createErr, `criar usuário sintético: ${createErr?.message}`).toBeNull();
        const uid = created?.user?.id;
        expect(uid, "esperava id do usuário criado").toBeTruthy();

        try {
          // 2) Gera sessão pra esse usuário — a RPC lê auth.uid().
          const { data: linkData, error: linkErr } =
            await admin.auth.admin.generateLink({
              type: "magiclink",
              email: testEmail,
            });
          expect(linkErr, `generateLink: ${linkErr?.message}`).toBeNull();

          const hashed = linkData?.properties?.hashed_token;
          expect(hashed, "esperava hashed_token do magiclink").toBeTruthy();

          const userClient = createClient(url!, anonKey ?? serviceRoleKey!);
          const { data: verified, error: verifyErr } = await userClient.auth.verifyOtp({
            type: "magiclink",
            token_hash: hashed!,
          });
          expect(verifyErr, `verifyOtp: ${verifyErr?.message}`).toBeNull();
          expect(verified?.session, "esperava sessão hidratada").toBeTruthy();

          // 3) Chama a RPC com payload real (2 itens, sendo 1 duplicado
          //    p/ exercitar dedup).
          const productA = crypto.randomUUID();
          const productB = crypto.randomUUID();
          const snapshot = {
            seller_id: uid,
            company_id: crypto.randomUUID(),
            company_name: "E2E Test Co.",
            company_location: "São Paulo/SP",
            company_logo_url: null,
            notes: "smoke restore",
            status: "em_separacao",
            shipping_deadline: null,
            items: [
              {
                product_id: productA,
                product_name: "Produto A",
                product_price: 10.5,
                quantity: 3,
                color_name: "Azul",
              },
              {
                // Mesma (product_id, color_name) → deve ser deduplicado
                product_id: productA,
                product_name: "Produto A",
                product_price: 10.5,
                quantity: 2,
                color_name: "Azul",
              },
              {
                product_id: productB,
                product_name: "Produto B",
                product_price: 5,
                quantity: 1,
                color_name: null,
              },
            ],
          };

          const { data: result, error: rpcErr } = await userClient.rpc(
            "restore_seller_cart",
            { _snapshot: snapshot as never },
          );

          expect(rpcErr, `rpc restore_seller_cart: ${rpcErr?.message}`).toBeNull();
          expect(result, "esperava retorno da RPC").toBeTruthy();

          const r = result as {
            cart_id: string;
            items_total: number;
            items_inserted: number;
            items_deduped: number;
          };
          expect(r.cart_id, "esperava cart_id UUID").toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
          );
          // 3 itens no snapshot, 2 variantes distintas após dedup.
          expect(r.items_total).toBe(2);
          expect(r.items_inserted).toBe(2);
          expect(r.items_deduped).toBe(1);

          // 4) Verifica que os itens foram realmente inseridos com a
          //    quantidade somada (3 + 2 = 5 para o dedup).
          const { data: rows, error: readErr } = await admin
            .from("seller_cart_items")
            .select("product_id,quantity,color_name")
            .eq("cart_id", r.cart_id);

          expect(readErr, `read seller_cart_items: ${readErr?.message}`).toBeNull();
          expect(rows?.length).toBe(2);
          const aRow = rows?.find((it) => it.product_id === productA);
          expect(aRow?.quantity, "quantidade do item duplicado deve ser somada").toBe(5);
        } finally {
          // 5) Cleanup — remove tudo que criamos.
          await admin.auth.admin.deleteUser(uid!).catch(() => undefined);
        }
      },
      45_000,
    );
  },
);
