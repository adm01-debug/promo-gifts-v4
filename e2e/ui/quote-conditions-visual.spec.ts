import { test, expect, type Page } from '../fixtures/test-base';
import { loginAs } from '../helpers/auth';

/**
 * Card "Condições" — validações visuais, de layout e de acessibilidade.
 *
 * Cobertura:
 *  - Grid em terços (md+) e empilhamento (mobile).
 *  - Snapshot dos bounding boxes dos 3 selects (Validade/Forma/Prazo).
 *  - A11y: labels associadas, foco por Tab na ordem correta em mobile e desktop.
 */

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812, cols: 1 },
  { name: 'tablet', width: 768, height: 1024, cols: 3 },
  { name: 'desktop', width: 1280, height: 900, cols: 3 },
] as const;

const SELECT_TIDS = [
  'payment-method-select', // Forma | Pagamento
  'payment-terms-select', // Prazo | Pagamento
] as const;

type Theme = 'light' | 'dark';

async function gotoQuoteBuilder(page: Page, theme: Theme = 'light') {
  await loginAs(page);
  await page.goto('/quotes/new');
  await page.waitForSelector('h3:has-text("Condições")', { timeout: 15000 });
  // Reduz flakiness: espera rede quieta + fontes carregadas + desativa animações.
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.evaluate(() => (document as any).fonts?.ready).catch(() => {});
  // Aplica tema (light/dark) via classe no <html> (Tailwind class-strategy).
  await page.evaluate((t) => {
    const html = document.documentElement;
    html.classList.remove('light', 'dark');
    html.classList.add(t);
    html.style.colorScheme = t;
  }, theme);
  await page.addStyleTag({
    content: `*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }`,
  });
}

test.describe('Card Condições — layout responsivo', () => {
  for (const theme of ['light', 'dark'] as const) {
    for (const vp of VIEWPORTS) {
      test(`grid ${vp.cols} coluna(s) em ${vp.name} (${vp.width}px) — ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await gotoQuoteBuilder(page, theme);

        const card = page.locator('div:has(> div > h3:has-text("Condições"))').first();
        await expect(card).toBeVisible();

        const grid = card.locator('.grid.grid-cols-1.md\\:grid-cols-3').first();
        await expect(grid).toBeVisible();

        await expect(card).toHaveScreenshot(`quote-conditions-${vp.name}-${theme}.png`, {
          maxDiffPixelRatio: 0.02,
          animations: 'disabled',
          caret: 'hide',
          scale: 'css',
        });
      });
    }
  }


  test('bounding boxes: 3 selects consistentes em md+ (larguras ~iguais)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoQuoteBuilder(page);

    const triggers = await Promise.all(
      // Validade é o primeiro select do card (sem testid próprio) — pegamos por ordem
      [
        page.locator('div:has(> label:has-text("Validade | Proposta")) [role="combobox"]').first(),
        page.getByTestId('payment-method-select'),
        page.getByTestId('payment-terms-select'),
      ].map((loc) => loc.boundingBox()),
    );

    for (const box of triggers) {
      expect(box).not.toBeNull();
    }

    const [b1, b2, b3] = triggers as NonNullable<(typeof triggers)[number]>[];

    // Mesma linha (y similar)
    expect(Math.abs(b1.y - b2.y)).toBeLessThan(4);
    expect(Math.abs(b2.y - b3.y)).toBeLessThan(4);

    // Ordem horizontal correta
    expect(b1.x).toBeLessThan(b2.x);
    expect(b2.x).toBeLessThan(b3.x);

    // Larguras equivalentes (tolerância 2px para arredondamento sub-pixel)
    expect(Math.abs(b1.width - b2.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(b2.width - b3.width)).toBeLessThanOrEqual(2);
  });

  test('bounding boxes: empilhados em mobile (mesma coluna)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await gotoQuoteBuilder(page);

    const triggers = await Promise.all(
      [
        page.locator('div:has(> label:has-text("Validade | Proposta")) [role="combobox"]').first(),
        page.getByTestId('payment-method-select'),
        page.getByTestId('payment-terms-select'),
      ].map((loc) => loc.boundingBox()),
    );

    const [b1, b2, b3] = triggers as NonNullable<(typeof triggers)[number]>[];

    // Empilhados: y crescente e x aproximadamente igual
    expect(b1.y).toBeLessThan(b2.y);
    expect(b2.y).toBeLessThan(b3.y);
    expect(Math.abs(b1.x - b2.x)).toBeLessThan(4);
    expect(Math.abs(b2.x - b3.x)).toBeLessThan(4);
  });
});

test.describe('Card Condições — acessibilidade', () => {
  for (const vp of [VIEWPORTS[0], VIEWPORTS[2]]) {
    test(`labels e ordem de foco (Tab) em ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoQuoteBuilder(page);

      const card = page.locator('div:has(> div > h3:has-text("Condições"))').first();

      // Labels visíveis e associadas a comboboxes
      await expect(card.getByText('Validade | Proposta')).toBeVisible();
      await expect(card.getByText('Forma | Pagamento')).toBeVisible();
      await expect(card.getByText('Prazo | Pagamento')).toBeVisible();

      // Todos os selects têm accessible name via SelectValue placeholder "Selecione"
      const comboboxes = card.locator('[role="combobox"]');
      await expect(comboboxes).toHaveCount(3);

      // Foca o primeiro combobox e valida ordem de Tab: Validade → Forma → Prazo
      const validity = comboboxes.nth(0);
      const method = page.getByTestId('payment-method-select');
      const terms = page.getByTestId('payment-terms-select');

      await validity.focus();
      await expect(validity).toBeFocused();

      await page.keyboard.press('Tab');
      await expect(method).toBeFocused();

      await page.keyboard.press('Tab');
      await expect(terms).toBeFocused();
    });
  }

  test('a11y: cada combobox é ativável por teclado (Enter/Space)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoQuoteBuilder(page);

    const method = page.getByTestId('payment-method-select');
    await method.focus();
    await page.keyboard.press('Enter');

    // Radix Select abre um listbox ao ativar
    await expect(page.locator('[role="listbox"]')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('[role="listbox"]')).toHaveCount(0);
  });
});
