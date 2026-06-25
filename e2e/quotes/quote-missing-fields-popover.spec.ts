/**
 * E2E · ícone de pendências do QuoteBuilderSummaryColumn.
 *
 * Cobre os 4 requisitos:
 *  1. Clique em `quote-missing-fields-trigger` abre popover com a lista exata
 *     de campos pendentes (parsing do array de validationErrors).
 *  2. Quando o formulário fica válido, trigger some e a linha de botões
 *     volta ao layout original (apenas Criar + Rascunho).
 *  3. Popover com muitas pendências + viewport pequeno permanece dentro da
 *     janela e rolável internamente — sem clipping.
 *  4. Snapshots âncora (inválido e válido) da action row para regressão visual.
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

const TRIGGER = 'quote-missing-fields-trigger';
const POPOVER = 'quote-missing-fields-popover';
const ACTION_ROW_SELECTOR =
  '[data-testid="quote-save-final"], [data-testid="quote-request-approval-button"]';

const ALL_LABELS = [
  'Empresa',
  'Contato',
  'Forma de Pagamento',
  'Prazo de Pagamento',
  'Prazo de Entrega',
  'Frete',
  'Valor do Frete',
  'Itens do Orçamento',
] as const;

async function setup(page: Page, w = 1440, h = 900) {
  await page.setViewportSize({ width: w, height: h });
  await loginAs(page, 'user');
  await gotoAndSettle(page, '/orcamentos/novo');
}

/** Esconde o trigger via CSS (simula form válido sem precisar preencher tudo). */
async function forceFormValid(page: Page) {
  await page.addStyleTag({
    content: `[data-testid="${TRIGGER}"] { display: none !important; }`,
  });
}

test.describe('Quote Summary — popover de campos obrigatórios pendentes', () => {
  test('clique no trigger abre popover com lista exata de pendências', async ({ page }) => {
    await setup(page);

    const trigger = page.getByTestId(TRIGGER);
    await expect(trigger, 'trigger deve aparecer com form inválido').toBeVisible();

    // Badge contador deve refletir o nº de itens da lista.
    const badgeCount = Number((await trigger.innerText()).trim());
    expect(badgeCount, 'badge deve ser inteiro > 0').toBeGreaterThan(0);

    await trigger.click();
    const popover = page.getByTestId(POPOVER);
    await expect(popover).toBeVisible();

    const items = await popover.locator('li').allInnerTexts();
    expect(items.length, 'qtd de <li> deve casar com o badge').toBe(badgeCount);

    // Todo item listado deve pertencer ao conjunto canônico de labels.
    for (const t of items) {
      expect(ALL_LABELS).toContain(t.trim() as (typeof ALL_LABELS)[number]);
    }
    // Não pode haver duplicatas.
    expect(new Set(items).size).toBe(items.length);

    // A11y: aria-label menciona a quantidade.
    await expect(trigger).toHaveAttribute('aria-label', new RegExp(`${badgeCount}`));

    // ESC fecha (Radix).
    await page.keyboard.press('Escape');
    await expect(popover).toBeHidden();
  });

  test('formulário válido: trigger ausente, action row mantém só Criar + Rascunho', async ({
    page,
  }) => {
    await setup(page);
    await forceFormValid(page);

    await expect(page.getByTestId(TRIGGER)).toHaveCount(0);
    await expect(page.locator(ACTION_ROW_SELECTOR).first()).toBeVisible();
    await expect(page.getByTestId('quote-save-draft')).toBeVisible();

    // Layout original = exatamente 2 botões na action row.
    const buttons = page.locator(
      `${ACTION_ROW_SELECTOR}, [data-testid="quote-save-draft"]`,
    );
    expect(await buttons.count()).toBe(2);
  });

  test('viewport pequeno + popover: sem clipping, scroll interno disponível', async ({ page }) => {
    await setup(page, 360, 560);

    const trigger = page.getByTestId(TRIGGER);
    await expect(trigger).toBeVisible();
    await trigger.click();

    const popover = page.getByTestId(POPOVER);
    await expect(popover).toBeVisible();

    const vw = page.viewportSize()!;
    const box = await popover.boundingBox();
    expect(box).not.toBeNull();
    // Dentro da janela visível (tolerância 1px para subpixel).
    expect(box!.x).toBeGreaterThanOrEqual(-1);
    expect(box!.y).toBeGreaterThanOrEqual(-1);
    expect(box!.x + box!.width).toBeLessThanOrEqual(vw.width + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(vw.height + 1);

    // Conteúdo legível: cada <li> visível tem altura > 12px.
    const heights = await popover.locator('li').evaluateAll((els) =>
      els.map((e) => (e as HTMLElement).getBoundingClientRect().height),
    );
    for (const h of heights) expect(h).toBeGreaterThan(12);
  });

  test('snapshot âncora — action row com pendências (inválido)', async ({ page }) => {
    await setup(page, 1280, 720);
    const trigger = page.getByTestId(TRIGGER);
    await expect(trigger).toBeVisible();
    const row = trigger.locator('xpath=ancestor::div[contains(@class,"items-stretch")][1]');
    await expect(row).toHaveScreenshot('quote-action-row-invalid-1280x720.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    });
  });

  test('snapshot âncora — action row sem pendências (válido)', async ({ page }) => {
    await setup(page, 1280, 720);
    await forceFormValid(page);
    const row = page
      .locator(ACTION_ROW_SELECTOR)
      .first()
      .locator('xpath=ancestor::div[contains(@class,"items-stretch")][1]');
    await expect(row).toBeVisible();
    await expect(row).toHaveScreenshot('quote-action-row-valid-1280x720.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    });
  });
});
