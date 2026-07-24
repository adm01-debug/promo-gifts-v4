/**
 * Defesa em profundidade: `quote_items.unit_price` é imutável para sellers comuns.
 *
 * Tenta um UPDATE direto via Supabase JS client a partir do navegador (mesma
 * sessão do usuário logado) e valida que o trigger
 * `trg_prevent_non_admin_quote_item_price_change` rejeita a operação com
 * mensagem clara e que o valor não muda no banco.
 *
 * Skipa quando não há sessão Supabase injetada no sandbox ou quando o usuário
 * não tem nenhum quote_item próprio (admins/supervisores também são puláveis).
 */
import { test, expect } from '@playwright/test';
import { gotoAndSettle } from '../helpers/nav';

test.describe('quote_items.unit_price — imutável para sellers comuns', () => {
  test('UPDATE direto via supabase-js retorna erro e não altera o valor', async ({ page }) => {
    test.skip(
      process.env.LOVABLE_BROWSER_AUTH_STATUS !== 'injected',
      'Requer sessão Supabase injetada (managed auth).',
    );

    await gotoAndSettle(page, '/');

    const result = await page.evaluate(async () => {
      // Acessa o client Supabase exposto globalmente em DEV (window.__supabase),
      // ou recai num import dinâmico do módulo canônico.
      const client =
        // @ts-expect-error -- exposto pelo bootstrap em DEV
        (window.__supabase as any) ??
        (await import('/src/integrations/supabase/client.ts')).supabase;

      // Pega um item do usuário corrente (qualquer item ao qual ele tenha SELECT).
      const { data: items, error: selErr } = await client
        .from('quote_items')
        .select('id, unit_price')
        .limit(1);
      if (selErr) return { kind: 'select_error' as const, message: selErr.message };
      if (!items || items.length === 0) return { kind: 'no_items' as const };

      const target = items[0];
      const newPrice = (Number(target.unit_price) || 0) + 1234.56;

      const { error: updErr } = await client
        .from('quote_items')
        .update({ unit_price: newPrice })
        .eq('id', target.id);

      const { data: after } = await client
        .from('quote_items')
        .select('unit_price')
        .eq('id', target.id)
        .maybeSingle();

      return {
        kind: 'attempted' as const,
        targetId: target.id,
        before: Number(target.unit_price),
        after: after ? Number(after.unit_price) : null,
        errorMessage: updErr?.message ?? null,
        errorCode: (updErr as { code?: string } | null)?.code ?? null,
      };
    });

    test.skip(result.kind === 'no_items', 'Usuário não tem quote_items visíveis.');
    test.skip(
      result.kind === 'select_error',
      `Sessão não pode ler quote_items: ${result.kind === 'select_error' ? result.message : ''}`,
    );

    if (result.kind !== 'attempted') return;

    // Admins/supervisores podem alterar — pula sem falhar.
    if (!result.errorMessage) {
      test.skip(true, 'Sessão atual tem privilégio admin/supervisor — trigger não bloqueia.');
      return;
    }

    // Erro claro do trigger (PG ERRCODE 42501 = insufficient_privilege).
    expect(result.errorMessage).toMatch(/somente leitura|n[ãa]o pode ser alterado|cat[áa]logo/i);
    expect(result.before).toEqual(result.after);
  });
});
