/**
 * undoCopy — guardas anti-regressão nos chamadores.
 *
 * Lê o código-fonte dos 3 pontos de exclusão de carrinho (linha, lote, popover
 * do header) e do fluxo de remoção de item na SellerCartsPage e garante que
 * TODOS eles:
 *   1) Usam a constante `UNDO_DURATION_MS` (nunca `duration: 8000` cravado)
 *   2) Usam `UNDO_TOAST_DESCRIPTION` (nunca "Você pode desfazer esta ação.")
 *   3) Usam `deletedToastTitle(n)`/`itemRemovedToastTitle` — nunca literais
 *      "Carrinho excluído" cravados dentro de `showUndoToast({ title: ... })`
 *
 * O teste é textual (grep no fonte) porque encapsula um invariante de projeto:
 * "toda copy de Desfazer vem do SSOT". Se alguém reintroduzir literal por
 * copy/paste, este teste quebra ANTES do E2E precisar rodar.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../../../..');

const FILES = {
  cartsList: resolve(ROOT, 'src/pages/products/CartsListPage.tsx'),
  header: resolve(ROOT, 'src/components/cart/CartHeaderButton.tsx'),
  sellerCartsHook: resolve(ROOT, 'src/pages/products/seller-carts/useSellerCartsPage.ts'),
} as const;

function read(name: keyof typeof FILES): string {
  return readFileSync(FILES[name], 'utf-8');
}

/**
 * Extrai apenas os blocos `showUndoToast({...})` (não bloqueia outros
 * `showUndoToast` de contextos não relacionados como `clearCart`).
 */
function extractShowUndoBlocks(src: string): string[] {
  const blocks: string[] = [];
  const re = /showUndoToast\s*\(\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    // Captura até o `})` correspondente com profundidade simples.
    let i = m.index + m[0].length;
    let depth = 1;
    const start = i;
    while (i < src.length && depth > 0) {
      const ch = src[i];
      if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
      i += 1;
    }
    blocks.push(src.slice(start, i));
  }
  return blocks;
}

describe('undoCopy — chamadores usam o SSOT (não literais)', () => {
  describe('CartsListPage.tsx (linha + lote)', () => {
    const src = read('cartsList');
    const blocks = extractShowUndoBlocks(src);

    it('há exatamente 2 chamadas de showUndoToast (linha + lote)', () => {
      expect(blocks.length).toBe(2);
    });

    it('nenhum bloco tem duration hard-coded como número literal', () => {
      for (const b of blocks) {
        expect(b, `Bloco não deve conter "duration: 8000":\n${b}`).not.toMatch(
          /duration\s*:\s*8000\b/,
        );
        expect(b).toMatch(/duration\s*:\s*UNDO_DURATION_MS/);
      }
    });

    it('description sempre referencia UNDO_TOAST_DESCRIPTION', () => {
      for (const b of blocks) {
        expect(b).toMatch(/description\s*:\s*UNDO_TOAST_DESCRIPTION/);
        expect(b).not.toMatch(/Você pode desfazer esta ação\./);
      }
    });

    it('title vem de deletedToastTitle(...) — não literal', () => {
      for (const b of blocks) {
        expect(b).toMatch(/title\s*:\s*deletedToastTitle\s*\(/);
        // Não permite literal cravado
        expect(b).not.toMatch(/title\s*:\s*['"`]Carrinho excluído['"`]/);
      }
    });
  });

  describe('CartHeaderButton.tsx (popover — delete de carrinho)', () => {
    const src = read('header');
    const blocks = extractShowUndoBlocks(src);

    // Header tem outros showUndoToast (clearCart, removeItem) — filtramos pelo
    // que fala de "Carrinho" (delete de carrinho, não item).
    const deleteBlock = blocks.find(
      (b) =>
        b.includes('deletedToastTitle') ||
        b.toLowerCase().includes('carrinho excluído'),
    );

    it('existe um bloco de undo para delete de carrinho no popover', () => {
      expect(deleteBlock, 'CartHeaderButton perdeu o fluxo de undo do delete').toBeTruthy();
    });

    it('usa UNDO_DURATION_MS e UNDO_TOAST_DESCRIPTION (não literais)', () => {
      expect(deleteBlock!).toMatch(/duration\s*:\s*UNDO_DURATION_MS/);
      expect(deleteBlock!).toMatch(/description\s*:\s*UNDO_TOAST_DESCRIPTION/);
      expect(deleteBlock!).not.toMatch(/duration\s*:\s*8000\b/);
    });

    it('title vem de deletedToastTitle(1)', () => {
      expect(deleteBlock!).toMatch(/title\s*:\s*deletedToastTitle\s*\(\s*1\s*\)/);
    });
  });

  describe('useSellerCartsPage.ts (remoção de item)', () => {
    const src = read('sellerCartsHook');
    const blocks = extractShowUndoBlocks(src);

    const itemBlock = blocks.find((b) => b.includes('itemRemovedToastTitle'));

    it('handleRemoveItem usa SSOT (itemRemovedToastTitle + UNDO_DURATION_MS)', () => {
      expect(itemBlock, 'handleRemoveItem perdeu o SSOT do undo de item').toBeTruthy();
      expect(itemBlock!).toMatch(/duration\s*:\s*UNDO_DURATION_MS/);
      expect(itemBlock!).toMatch(/description\s*:\s*UNDO_TOAST_DESCRIPTION/);
      expect(itemBlock!).toMatch(/title\s*:\s*itemRemovedToastTitle\s*\(/);
    });
  });
});
