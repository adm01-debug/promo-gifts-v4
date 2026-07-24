/**
 * E2E — Quote Builder · cobertura completa do botão de colapso por card:
 *
 *  1. Visual regression em 4 viewports (375 / 768 / 1440 / 1920) com
 *     screenshots pixel-a-pixel do card colapsado e expandido.
 *  2. Exclusão de produto ⇒ `pruneCollapsedItems` remove a chave do
 *     localStorage automaticamente (sem ids zumbis).
 *  3. A11y do botão de toggle: nome acessível (`aria-label` dinâmico),
 *     `aria-expanded`/`aria-pressed`, foco visível e ativação por teclado
 *     (Space e Enter).
 *  4. Asserts determinísticos: `gotoAndSettle` → wait do testid →
 *     polling em `localStorage` antes de assertar persistência. `test.describe`
 *     com `retries(1)` para tolerar flakes de rede no CI.
 *
 * Específico: este spec NÃO seeda produto no banco — pula com
 * `test.skip` quando o orçamento novo está vazio (cobertura do fluxo de
 * adicionar produto está em flows/04-quotes.spec.ts). Assim cobrimos
 * regressão sem acoplamento a dados.
 */
import { test, expect, type Locator, type Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

const PREFIX = 'quote-builder:collapsed-item-keys';
const KEY_NEW = `${PREFIX}:new`;
const VIEWPORTS = [
  { name: '375-mobile', width: 375, height: 800 },
  { name: '768-tablet', width: 768, height: 900 },
  { name: '1440-desktop', width: 1440, height: 900 },
  { name: '1920-wide', width: 1920, height: 1080 },
] as const;

/** Espera o `localStorage` refletir uma condição (polling determinístico). */
async function waitForStorage(
  page: Page,
  key: string,
  predicate: (value: string | null) => boolean,
  timeoutMs = 3_000,
): Promise<string | null> {
  const deadline = Date.now() + timeoutMs;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const value = await page.evaluate((k) => window.localStorage.getItem(k), key);
    if (predicate(value)) return value;
    if (Date.now() > deadline) {
      throw new Error(`waitForStorage timeout: key=${key} value=${value}`);
    }
    await page.waitForTimeout(80);
  }
}

/** Resolve o primeiro card visível; pula a spec se o resumo estiver vazio. */
async function getFirstCard(page: Page): Promise<{ card: Locator; toggle: Locator }> {
  const card = page.getByTestId('quote-summary-item-0');
  if ((await card.count()) === 0) {
    test.skip(true, 'Resumo vazio — fluxo de adicionar produto fora do escopo.');
  }
  await expect(card).toBeVisible({ timeout: 10_000 });
  const toggle = page.getByTestId('quote-summary-toggle-0');
  await expect(toggle).toBeVisible();
  return { card, toggle };
}

test.describe.configure({ retries: 1 });

test.describe('Quote Builder · colapso de cards — cobertura completa', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'user');
  });

  // ────────────────────────────── A11y + teclado ──────────────────────────────
  test('a11y: nome acessível, foco visível e ativação por Space/Enter', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAndSettle(page, '/orcamentos/novo');
    const { toggle } = await getFirstCard(page);

    // Nome acessível dinâmico
    await expect(toggle).toHaveAttribute('aria-label', 'Recolher');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    // Foco visível — focus programático + checagem de :focus-visible
    await toggle.focus();
    await expect(toggle).toBeFocused();
    const hasFocusVisible = await toggle.evaluate((el) => el.matches(':focus-visible'));
    expect(hasFocusVisible).toBe(true);

    // Ativa por Space ⇒ recolhe
    await page.keyboard.press('Space');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toHaveAttribute('aria-label', 'Expandir');

    // Ativa por Enter ⇒ expande
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  // ────────────── Prune: excluir item remove chave do storage ──────────────
  test('prune: excluir o produto remove o id do localStorage', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAndSettle(page, '/orcamentos/novo');
    const { card, toggle } = await getFirstCard(page);

    const itemId = (await card.getAttribute('data-quote-item-id')) || '';
    test.skip(!itemId, 'Item sem id persistido — prune cobre apenas ids reais.');

    // Recolhe ⇒ chave grava o itemId
    await toggle.click();
    const after = await waitForStorage(page, KEY_NEW, (v) => {
      if (!v) return false;
      try {
        return (JSON.parse(v) as string[]).includes(itemId);
      } catch {
        return false;
      }
    });
    expect(JSON.parse(after as string)).toContain(itemId);

    // Exclui o produto (auto-confirm de qualquer Confirm modal)
    page.once('dialog', (d) => d.accept());
    await page.getByTestId('quote-summary-delete-0').click();

    // Prune (useEffect [items]) deve remover o id. Set vazio ⇒ chave removida.
    await waitForStorage(page, KEY_NEW, (v) => {
      if (v === null) return true;
      try {
        return !(JSON.parse(v) as string[]).includes(itemId);
      } catch {
        return true;
      }
    });
  });

  // ─────────────── Visual regression em 4 viewports ───────────────
  for (const vp of VIEWPORTS) {
    test(`visual @ ${vp.name}: card expandido vs colapsado`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoAndSettle(page, '/orcamentos/novo');
      const { card, toggle } = await getFirstCard(page);

      // Desativa animações para snapshots determinísticos
      await page.addStyleTag({
        content: `*, *::before, *::after {
          transition: none !important;
          animation: none !important;
          caret-color: transparent !important;
        }`,
      });
      await page.evaluate(() => document.fonts?.ready);

      // Expandido (estado inicial)
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(card).toHaveScreenshot(`card-expanded-${vp.name}.png`, {
        maxDiffPixelRatio: 0.01,
        animations: 'disabled',
      });

      // Colapsado
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(card).toHaveScreenshot(`card-collapsed-${vp.name}.png`, {
        maxDiffPixelRatio: 0.01,
        animations: 'disabled',
      });

      testInfo.annotations.push({ type: 'viewport', description: `${vp.width}×${vp.height}` });
    });
  }
});
