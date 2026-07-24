/**
 * Guarda de invariante: "Notas da negociação" (seller_carts.notes) são estritamente
 * internas ao vendedor dono do carrinho. Este teste falha se alguém futuramente:
 *
 *   1. Adicionar cart.notes ao payload de handoff para /orcamentos/novo.
 *   2. Referenciar cart.notes / seller_carts.notes em rotas públicas
 *      (quote-public-*), geração de PDF, envio de e-mail ou sync CRM
 *      (Bitrix / SalesPro / receive-crm-callback / send-transactional-email).
 *   3. Remover o marcador visual "🔒 Interno" ou o data-testid do bloco.
 *
 * Complementa a proteção de RLS já ativa em `seller_carts`
 * (policy única `ALL` com `seller_id = auth.uid()` em qual e with_check),
 * validada via supabase pg_policies.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../../..');

function readIfExists(p: string): string {
  try {
    return readFileSync(p, 'utf8');
  } catch {
    return '';
  }
}

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    let s;
    try {
      s = statSync(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      if (name === 'node_modules' || name === '.git' || name === 'dist') continue;
      walk(full, out);
    } else if (/\.(ts|tsx|js|mjs)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

describe('Notas da negociação — invariante de confidencialidade', () => {
  it('handoff carrinho → /orcamentos/novo não propaga cart.notes', () => {
    const src = readIfExists(
      join(ROOT, 'src/pages/products/seller-carts/useSellerCartsPage.ts'),
    );
    expect(src).not.toEqual('');
    // Isola o payload passado em navigate('/orcamentos/novo', { state: { ... } }).
    const match = /navigate\('\/orcamentos\/novo'[\s\S]*?\}\);/.exec(src);
    expect(match, 'bloco de handoff para /orcamentos/novo não encontrado').toBeTruthy();
    const handoff = match![0];
    // Aceita item.notes, cart.notes NUNCA. Regra estrita: nenhuma propriedade
    // "notes:" pode aparecer fora de `items.map(...)` do bloco.
    const beforeItems = handoff.split('items:')[0];
    expect(beforeItems).not.toMatch(/\bnotes\s*:/);
    // Também não pode aparecer como `cart.notes` em lugar nenhum do handoff.
    expect(handoff).not.toMatch(/\bcart\.notes\b/);
  });

  it('nenhum código de quote público / PDF / e-mail / CRM referencia seller_carts ou cart.notes', () => {
    const scanDirs = [
      // Edge functions sensíveis
      join(ROOT, 'supabase/functions/quote-public-view'),
      join(ROOT, 'supabase/functions/quote-public-react'),
      join(ROOT, 'supabase/functions/quote-public-approve'),
      join(ROOT, 'supabase/functions/send-transactional-email'),
      join(ROOT, 'supabase/functions/receive-crm-callback'),
      join(ROOT, 'supabase/functions/crm-callback-reprocess'),
      join(ROOT, 'supabase/functions/crm-callback-alerts'),
      join(ROOT, 'supabase/functions/crm-db-bridge'),
      join(ROOT, 'supabase/functions/_shared/transactional-email-templates'),
      // Client-side: quote público + PDF
      join(ROOT, 'src/pages/QuotePublicView'),
      join(ROOT, 'src/pages/quote-public'),
      join(ROOT, 'src/lib/quote/pdf'),
      join(ROOT, 'src/lib/pdf'),
      join(ROOT, 'src/integrations/crm'),
    ];
    const files = scanDirs.flatMap((d) => walk(d));
    const offenders: string[] = [];
    for (const f of files) {
      const content = readIfExists(f);
      if (!content) continue;
      // Qualquer menção a `seller_carts` ou ao alias `cart.notes` nessas rotas
      // já é vazamento potencial — falha explícita com nome do arquivo.
      if (/\bseller_carts\b/.test(content) || /\bcart\.notes\b/.test(content)) {
        offenders.push(f.replace(`${ROOT}/`, ''));
      }
    }
    expect(
      offenders,
      `Vazamento potencial de notas internas em: ${offenders.join(', ')}`,
    ).toEqual([]);
  });

  it('bloco de notas na UI mantém o rótulo "🔒 Interno" e testids', () => {
    const ui = readIfExists(join(ROOT, 'src/pages/products/SellerCartsPage.tsx'));
    expect(ui).toContain('data-testid="cart-notes-internal-block"');
    expect(ui).toContain('data-testid="cart-notes-internal-badge"');
    expect(ui).toContain('Interno — não visível ao cliente');
    expect(ui).toContain('aria-describedby="cart-notes-internal-hint"');
  });

  it('mutation updateCartNotes só grava em seller_carts (nunca em quotes/orders/CRM)', () => {
    const hook = readIfExists(join(ROOT, 'src/hooks/products/useSellerCarts.ts'));
    expect(hook).not.toEqual('');
    // Isola o mutationFn de updateCartNotes.
    const idx = hook.indexOf('Update cart notes');
    expect(idx).toBeGreaterThan(-1);
    const slice = hook.slice(idx, idx + 800);
    // Deve tocar apenas em seller_carts.
    expect(slice).toMatch(/from\(['"]seller_carts['"]\)/);
    expect(slice).not.toMatch(/from\(['"]quotes?['"]\)/);
    expect(slice).not.toMatch(/from\(['"]orders?['"]\)/);
    expect(slice).not.toMatch(/functions\.invoke\(['"]send-transactional-email/);
    expect(slice).not.toMatch(/functions\.invoke\(['"]crm-/);
  });
});
