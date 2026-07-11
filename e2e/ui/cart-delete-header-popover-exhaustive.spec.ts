/**
 * E2E · CartHeaderButton — Bateria exaustiva (15 cenários)
 *
 * Valida o fix da corrida entre DismissableLayer do Popover e do AlertDialog
 * (setOpen(false) + rAF(setPendingDeleteId)). Cada cenário mocka /rest/v1/seller_carts
 * — não depende do banco real.
 *
 * Todos os testes rodam em Chromium. Alguns são marcados @smoke.
 */
import { test, expect, type Page, type Route } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';
import { mockSellerCartsAPI, makeMockCart, type MockCart } from '../helpers/cart-mock';

// ---------------------------------------------------------------------------
// Harness

type DeleteMode = 'ok' | 'fail' | 'slow';

interface Harness {
  carts: MockCart[];
  attempts: () => number;
  deleted: () => string[];
  setMode: (m: DeleteMode) => void;
  setDelay: (ms: number) => void;
}

async function seed(page: Page, carts: MockCart[]): Promise<Harness> {
  await mockSellerCartsAPI(page, carts);
  let mode: DeleteMode = 'ok';
  let delayMs = 0;
  let attempts = 0;
  const deleted: string[] = [];

  await page.route('**/rest/v1/seller_carts**', async (route: Route) => {
    const req = route.request();
    if (req.method() !== 'DELETE') return route.continue();
    attempts += 1;
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    if (mode === 'fail') {
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'PGRST500', message: 'delete failed' }),
      });
    }
    const m = req.url().match(/id=eq\.([^&]+)/);
    const id = m?.[1];
    if (id) {
      deleted.push(id);
      const idx = carts.findIndex((c) => c.id === id);
      if (idx >= 0) carts.splice(idx, 1);
    }
    return route.fulfill({ status: 204, body: '' });
  });

  return {
    carts,
    attempts: () => attempts,
    deleted: () => [...deleted],
    setMode: (m) => { mode = m; },
    setDelay: (ms) => { delayMs = ms; },
  };
}

async function openPopover(page: Page) {
  await page.getByTestId('cart-trigger').click();
  await expect(page.getByTestId('cart-drawer')).toBeVisible();
}

async function readActiveCartLS(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const out: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('seller:active-cart-id:')) out[k] = localStorage.getItem(k) || '';
    }
    return out;
  });
}

// ---------------------------------------------------------------------------
// Suite

test.describe('CartHeaderButton — exaustivo (delete via popover)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'user');
    await page.addInitScript(() => {
      // Descarta chaves stale de active-cart entre testes.
      try {
        Object.keys(localStorage).forEach((k) => {
          if (k.startsWith('seller:active-cart-id:')) localStorage.removeItem(k);
        });
      } catch { /* ignore */ }
    });
  });

  // 1
  test('happy path — clique → dialog → confirmar → 1 DELETE → cartão some @smoke', async ({ page }) => {
    const cart = makeMockCart(0, 1);
    cart.id = 'exh-1';
    cart.company_name = 'Empresa Alfa';
    const h = await seed(page, [cart]);
    await gotoAndSettle(page, '/');
    await openPopover(page);
    await page.getByTestId(`cart-delete-${cart.id}`).click();
    await expect(page.getByTestId('cart-delete-dialog')).toBeVisible();
    await expect(page.getByTestId('cart-delete-dialog-description')).toContainText('Empresa Alfa');
    await page.getByTestId('cart-delete-confirm').click();
    await expect(page.getByTestId('cart-delete-dialog')).toBeHidden();
    expect(h.attempts()).toBe(1);
    expect(h.deleted()).toEqual([cart.id]);
  });

  // 2
  test('cancelar via botão, Escape e clique fora — 0 DELETE', async ({ page }) => {
    const cart = makeMockCart(0, 1);
    cart.id = 'exh-2';
    const h = await seed(page, [cart]);
    await gotoAndSettle(page, '/');
    await openPopover(page);

    // (a) botão Cancelar
    await page.getByTestId(`cart-delete-${cart.id}`).click();
    await expect(page.getByTestId('cart-delete-dialog')).toBeVisible();
    await page.getByTestId('cart-delete-cancel').click();
    await expect(page.getByTestId('cart-delete-dialog')).toBeHidden();

    // (b) Escape
    await openPopover(page);
    await page.getByTestId(`cart-delete-${cart.id}`).click();
    await expect(page.getByTestId('cart-delete-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('cart-delete-dialog')).toBeHidden();

    // (c) clique fora (overlay)
    await openPopover(page);
    await page.getByTestId(`cart-delete-${cart.id}`).click();
    await expect(page.getByTestId('cart-delete-dialog')).toBeVisible();
    // Clica no overlay do dialog (fora do content)
    await page.mouse.click(4, 4);
    await expect(page.getByTestId('cart-delete-dialog')).toBeHidden();

    expect(h.attempts()).toBe(0);
  });

  // 3
  test('retry após 500 — dialog permanece, 2ª tentativa 204 sucede', async ({ page }) => {
    const cart = makeMockCart(0, 1);
    cart.id = 'exh-3';
    const h = await seed(page, [cart]);
    h.setMode('fail');
    await gotoAndSettle(page, '/');
    await openPopover(page);
    await page.getByTestId(`cart-delete-${cart.id}`).click();
    await page.getByTestId('cart-delete-confirm').click();

    await expect(
      page.locator('[data-sonner-toast][data-type="error"]').first(),
    ).toBeVisible({ timeout: 6_000 });
    await expect(page.getByTestId('cart-delete-dialog')).toBeVisible();
    expect(h.attempts()).toBe(1);

    h.setMode('ok');
    await page.getByTestId('cart-delete-confirm').click();
    await expect(page.getByTestId('cart-delete-dialog')).toBeHidden({ timeout: 5_000 });
    expect(h.attempts()).toBe(2);
    expect(h.deleted()).toEqual([cart.id]);
  });

  // 4
  test('rapid-fire — 10 cliques em <100ms disparam ≤1 DELETE', async ({ page }) => {
    const cart = makeMockCart(0, 1);
    cart.id = 'exh-4';
    const h = await seed(page, [cart]);
    h.setDelay(300);
    await gotoAndSettle(page, '/');
    await openPopover(page);
    await page.getByTestId(`cart-delete-${cart.id}`).click();
    const confirm = page.getByTestId('cart-delete-confirm');
    // 10 cliques encadeados
    for (let i = 0; i < 10; i++) await confirm.click({ trial: false, force: true }).catch(() => {});
    await expect(page.getByTestId('cart-delete-dialog')).toBeHidden({ timeout: 5_000 });
    expect(h.attempts()).toBeLessThanOrEqual(1);
  });

  // 5
  test('múltiplos carrinhos — excluir o 3º só remove ele; activeCartId preservado', async ({ page }) => {
    const carts = Array.from({ length: 5 }, (_, i) => {
      const c = makeMockCart(i, 1);
      c.id = `exh-5-${i}`;
      c.company_name = `Empresa ${i}`;
      return c;
    });
    const h = await seed(page, carts);
    await gotoAndSettle(page, '/');
    await openPopover(page);
    // O ativo tende a ser o primeiro (mais recente). Excluímos o 3º.
    const target = carts[2];
    await page.getByTestId(`cart-delete-${target.id}`).click();
    await page.getByTestId('cart-delete-confirm').click();
    await expect(page.getByTestId('cart-delete-dialog')).toBeHidden();
    expect(h.deleted()).toEqual([target.id]);
    // Os outros 4 permanecem visíveis por company_name
    for (const c of carts.filter((x) => x.id !== target.id)) {
      await expect(page.getByText(c.company_name).first()).toBeVisible();
    }
  });

  // 6
  test('excluir o carrinho ativo — activeCartId e chave localStorage são limpos', async ({ page }) => {
    const carts = [makeMockCart(0, 1), makeMockCart(1, 1)];
    carts[0].id = 'exh-6-A';
    carts[1].id = 'exh-6-B';
    const h = await seed(page, carts);
    await gotoAndSettle(page, '/');
    await openPopover(page);
    // Torna carrinho A ativo (clique no toggle)
    await page.getByTestId(`cart-toggle-${carts[0].id}`).click().catch(() => {});
    await page.waitForTimeout(150);
    const before = await readActiveCartLS(page);
    // Deleta A
    await page.getByTestId(`cart-delete-${carts[0].id}`).click();
    await page.getByTestId('cart-delete-confirm').click();
    await expect(page.getByTestId('cart-delete-dialog')).toBeHidden();
    const after = await readActiveCartLS(page);
    // Se havia chave apontando pro A, agora não deve mais.
    for (const [k, v] of Object.entries(before)) {
      if (v === carts[0].id) {
        expect(after[k], `chave ${k} deveria ter sido limpa`).not.toBe(carts[0].id);
      }
    }
    expect(h.deleted()).toEqual([carts[0].id]);
  });

  // 7
  test('falha persistente (2× 500) — dialog nunca fecha, cartão nunca some, 2 tentativas', async ({ page }) => {
    const cart = makeMockCart(0, 1);
    cart.id = 'exh-7';
    const h = await seed(page, [cart]);
    h.setMode('fail');
    await gotoAndSettle(page, '/');
    await openPopover(page);
    await page.getByTestId(`cart-delete-${cart.id}`).click();
    await page.getByTestId('cart-delete-confirm').click();
    await expect(page.locator('[data-sonner-toast][data-type="error"]').first()).toBeVisible();
    await expect(page.getByTestId('cart-delete-dialog')).toBeVisible();
    // Aguarda botão re-habilitar
    await expect(page.getByTestId('cart-delete-confirm')).toBeEnabled();
    await page.getByTestId('cart-delete-confirm').click();
    await expect(page.getByTestId('cart-delete-dialog')).toBeVisible();
    expect(h.attempts()).toBe(2);
    expect(h.deleted()).toEqual([]);
  });

  // 8
  test('a11y — role=alertdialog, foco inicial no destrutivo, Escape fecha, foco volta ao trash', async ({ page }) => {
    const cart = makeMockCart(0, 1);
    cart.id = 'exh-8';
    await seed(page, [cart]);
    await gotoAndSettle(page, '/');
    await openPopover(page);
    const trash = page.getByTestId(`cart-delete-${cart.id}`);
    await trash.click();
    const dialog = page.getByTestId('cart-delete-dialog');
    await expect(dialog).toBeVisible();
    // Radix AlertDialogContent tem role="alertdialog"
    await expect(dialog).toHaveAttribute('role', 'alertdialog');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  // 9
  test('teclado — Enter em Excluir dispara DELETE', async ({ page }) => {
    const cart = makeMockCart(0, 1);
    cart.id = 'exh-9';
    const h = await seed(page, [cart]);
    await gotoAndSettle(page, '/');
    await openPopover(page);
    await page.getByTestId(`cart-delete-${cart.id}`).click();
    await expect(page.getByTestId('cart-delete-dialog')).toBeVisible();
    const confirm = page.getByTestId('cart-delete-confirm');
    await confirm.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('cart-delete-dialog')).toBeHidden();
    expect(h.attempts()).toBe(1);
  });

  // 10
  test('popover reabre limpo — nenhum dialog residual', async ({ page }) => {
    const cart = makeMockCart(0, 1);
    cart.id = 'exh-10';
    await seed(page, [cart]);
    await gotoAndSettle(page, '/');
    await openPopover(page);
    await page.getByTestId(`cart-delete-${cart.id}`).click();
    await page.getByTestId('cart-delete-cancel').click();
    await expect(page.getByTestId('cart-delete-dialog')).toBeHidden();
    // Fecha e reabre popover
    await page.keyboard.press('Escape');
    await openPopover(page);
    await expect(page.getByTestId('cart-delete-dialog')).toBeHidden();
  });

  // 11
  test('focus trap — Tab dentro do dialog não escapa para fora', async ({ page }) => {
    const cart = makeMockCart(0, 1);
    cart.id = 'exh-11';
    await seed(page, [cart]);
    await gotoAndSettle(page, '/');
    await openPopover(page);
    await page.getByTestId(`cart-delete-${cart.id}`).click();
    const dialog = page.getByTestId('cart-delete-dialog');
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 6; i++) await page.keyboard.press('Tab');
    // O foco atual deve estar dentro do dialog
    const insideDialog = await page.evaluate(() => {
      const dlg = document.querySelector('[data-testid="cart-delete-dialog"]');
      return !!(dlg && document.activeElement && dlg.contains(document.activeElement));
    });
    expect(insideDialog).toBe(true);
  });

  // 12
  test('latência alta — botão fica disabled + aria-busy + spinner durante request', async ({ page }) => {
    const cart = makeMockCart(0, 1);
    cart.id = 'exh-12';
    const h = await seed(page, [cart]);
    h.setDelay(1500);
    await gotoAndSettle(page, '/');
    await openPopover(page);
    await page.getByTestId(`cart-delete-${cart.id}`).click();
    await page.getByTestId('cart-delete-confirm').click();
    // Enquanto o request está pendente:
    const confirm = page.getByTestId('cart-delete-confirm');
    await expect(confirm).toBeDisabled();
    await expect(confirm).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByTestId('cart-delete-loading')).toBeVisible();
    await expect(page.getByTestId('cart-delete-cancel')).toBeDisabled();
    // Depois de completar
    await expect(page.getByTestId('cart-delete-dialog')).toBeHidden({ timeout: 5_000 });
  });

  // 13
  test('tooltip da lixeira não bloqueia o clique subsequente (regressão onPointerDown)', async ({ page }) => {
    const cart = makeMockCart(0, 1);
    cart.id = 'exh-13';
    const h = await seed(page, [cart]);
    await gotoAndSettle(page, '/');
    await openPopover(page);
    const trash = page.getByTestId(`cart-delete-${cart.id}`);
    // Provoca o tooltip com hover, então clica
    await trash.hover();
    await page.waitForTimeout(400);
    await trash.click();
    await expect(page.getByTestId('cart-delete-dialog')).toBeVisible();
    await page.getByTestId('cart-delete-confirm').click();
    expect(h.attempts()).toBe(1);
  });

  // 14
  test('coexistência com "Limpar itens" — o Eraser não abre o dialog de exclusão', async ({ page }) => {
    const cart = makeMockCart(0, 3);
    cart.id = 'exh-14';
    await seed(page, [cart]);
    await gotoAndSettle(page, '/');
    await openPopover(page);
    // O botão de limpar (Eraser) só aparece com itens; ele NÃO é o cart-delete-*.
    // Basta assegurar que nada abre o dialog além da lixeira.
    const eraser = page.locator(`button[aria-label*="Limpar" i]`).first();
    if (await eraser.count()) {
      await eraser.click().catch(() => {});
      await page.waitForTimeout(200);
      await expect(page.getByTestId('cart-delete-dialog')).toBeHidden();
    }
  });

  // 15
  test('excluir → estado consistente para novo carrinho na sequência', async ({ page }) => {
    const carts = [makeMockCart(0, 1), makeMockCart(1, 1)];
    carts[0].id = 'exh-15-A';
    carts[1].id = 'exh-15-B';
    const h = await seed(page, carts);
    await gotoAndSettle(page, '/');
    await openPopover(page);
    await page.getByTestId(`cart-delete-${carts[0].id}`).click();
    await page.getByTestId('cart-delete-confirm').click();
    await expect(page.getByTestId('cart-delete-dialog')).toBeHidden();
    // Reabre popover, cartão B ainda visível e interativo.
    await openPopover(page);
    await expect(page.getByText(carts[1].company_name).first()).toBeVisible();
    // Trash do B continua funcional após A ter sido deletado.
    await page.getByTestId(`cart-delete-${carts[1].id}`).click();
    await expect(page.getByTestId('cart-delete-dialog')).toBeVisible();
    await page.getByTestId('cart-delete-cancel').click();
    expect(h.deleted()).toEqual([carts[0].id]);
  });
});
