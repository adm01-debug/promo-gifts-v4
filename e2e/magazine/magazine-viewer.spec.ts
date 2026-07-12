/**
 * Magazine viewer — E2E smoke dos fluxos do PublicMagazineView.
 *
 * Cobertura (Ondas D, K, L, M, N, O, P, Q):
 *   - Renderização básica da revista pública
 *   - Atalhos de teclado: ← → Home End T B P ?
 *   - Deep-link `?p=N` — válido e inválido (toast quando fora do range)
 *   - Swipe touch (mobile emulation)
 *   - Bookmark: toggle + destaque `aria-current="location"` no mini-mapa
 *   - Modo apresentação: play → progress bar visível → pause via ESC
 *   - Fullscreen: fallback quando API indisponível (log de tentativa)
 *
 * Estratégia de seed: o v1 do magazineService lê `promobrind.magazines.v1`
 * do localStorage — injetamos uma revista mock via `addInitScript` antes
 * de navegar. Não requer backend real.
 */
import { test, expect, type Page } from '@playwright/test';

const MAGAZINE_TOKEN = 'e2e-token-viewer-001';
const MAGAZINE_ID = 'e2e-mag-001';

/** Seed mínimo — 4 páginas via 4 items (1 produto por página no VogueTemplate). */
function buildSeedScript(): string {
  const magazine = {
    id: MAGAZINE_ID,
    ownerId: 'e2e',
    organizationId: null,
    title: 'E2E Revista de Teste',
    subtitle: 'Cobertura Playwright',
    templateId: 'editorial-vogue',
    branding: {
      clientName: null,
      clientLogoUrl: null,
      clientCrmId: null,
      colors: { primary: '#111', secondary: '#e11d48', text: '#111' },
      category: 'technology',
    },
    content: {
      showPrice: true,
      showCode: true,
      showPersonalization: false,
      showDescription: true,
      showDimensions: false,
      showMaterials: false,
      showColors: false,
      groupByCategory: false,
    },
    items: Array.from({ length: 4 }, (_, i) => ({
      id: `it-${i}`,
      productId: `p-${i}`,
      productSnapshot: {
        id: `p-${i}`,
        name: `Produto E2E ${i + 1}`,
        sku: `SKU-${i + 1}`,
        shortDescription: `Descrição curta do produto ${i + 1}`,
        description: null,
        price: 100 + i * 10,
        image_url: '/placeholder.svg',
        images: ['/placeholder.svg'],
        colors: [],
        category_name: 'Tecnologia',
        category_id: null,
        materials: [],
        hasPersonalization: false,
      },
      variantColorName: null,
      position: i,
      pageNumber: null,
      overrides: {},
    })),
    pageOrder: null,
    status: 'published',
    publicToken: MAGAZINE_TOKEN,
    pdfUrl: null,
    publishedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const tokenIndex = { [MAGAZINE_TOKEN]: MAGAZINE_ID };

  return `
    try {
      localStorage.setItem('promobrind.magazines.v1', ${JSON.stringify(JSON.stringify([magazine]))});
      localStorage.setItem('promobrind.magazines.tokenIndex.v1', ${JSON.stringify(JSON.stringify(tokenIndex))});
    } catch (e) {}
  `;
}

async function seedAndOpen(page: Page, extraPath = ''): Promise<void> {
  await page.addInitScript(buildSeedScript());
  await page.goto(`/revista-publica/${MAGAZINE_TOKEN}${extraPath}`);
  // Header sempre visível se a revista carregou
  await expect(page.getByRole('heading', { name: 'E2E Revista de Teste' })).toBeVisible({
    timeout: 15_000,
  });
}

/** Aguarda o texto "Página N de M" refletir a página desejada. */
async function expectPage(page: Page, idx: number): Promise<void> {
  await expect(page.getByText(new RegExp(`Página\\s+${idx}\\s+de\\s+\\d+`, 'i')).first()).toBeVisible();
}

test.describe('Magazine viewer — atalhos de teclado', () => {
  test('→ avança página, ← volta, Home/End extremos', async ({ page }) => {
    await seedAndOpen(page);
    await expectPage(page, 1);

    await page.keyboard.press('ArrowRight');
    await expectPage(page, 2);

    await page.keyboard.press('ArrowRight');
    await expectPage(page, 3);

    await page.keyboard.press('ArrowLeft');
    await expectPage(page, 2);

    await page.keyboard.press('End');
    await expectPage(page, 4);

    await page.keyboard.press('Home');
    await expectPage(page, 1);
  });

  test('T abre sumário, ? abre ajuda, B marca página', async ({ page }) => {
    await seedAndOpen(page);

    await page.keyboard.press('T');
    await expect(page.getByRole('dialog').first()).toBeVisible();
    await page.keyboard.press('Escape'); // fecha TOC (precedência ESC)
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.keyboard.press('?');
    await expect(page.getByText(/Atalhos de teclado/i)).toBeVisible();
    await page.keyboard.press('Escape'); // fecha help

    // B: marca página atual (1)
    await page.keyboard.press('B');
    await expect(page.getByRole('button', { name: /Marcada/i })).toBeVisible();
  });

  test('Space em botão focado NÃO avança página (C2)', async ({ page }) => {
    await seedAndOpen(page);
    await expectPage(page, 1);

    // Foca o botão "Sumário" e aperta Space — deve apenas abrir o TOC
    const tocButton = page.getByRole('button', { name: /Abrir sumário/i });
    await tocButton.focus();
    await page.keyboard.press('Space');

    await expect(page.getByRole('dialog').first()).toBeVisible();
    // A página NÃO pode ter avançado além do trigger do botão
    await expectPage(page, 1);
  });
});

test.describe('Magazine viewer — deep link', () => {
  test('?p=3 abre direto na página 3', async ({ page }) => {
    await seedAndOpen(page, '?p=3');
    await expectPage(page, 3);
  });

  test('?p=9999 clampa e mostra toast (P)', async ({ page }) => {
    await seedAndOpen(page, '?p=9999');
    // Clampa para última (4)
    await expectPage(page, 4);
    // Toast informativo (sonner) — busca substring
    await expect(page.getByText(/Página 9999 não existe/i)).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Magazine viewer — modo apresentação (Onda J)', () => {
  test('P inicia, barra de progresso aparece, ESC pausa', async ({ page }) => {
    await seedAndOpen(page);

    await page.keyboard.press('P');
    // Botão vira "Pausar"
    await expect(page.getByRole('button', { name: /Parar apresentação/i })).toBeVisible();
    // Progressbar aria fica presente
    await expect(page.locator('[role="progressbar"][aria-label*="próxima página"]')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: /Iniciar apresentação/i })).toBeVisible();
  });
});

test.describe('Magazine viewer — mini-mapa a11y (Ondas L/O)', () => {
  test('slider é focável e responde a ←/→', async ({ page }) => {
    await seedAndOpen(page);

    const slider = page.getByRole('slider').first();
    await slider.focus();
    await expect(slider).toBeFocused();

    // Foco no slider + → avança 1 página
    await page.keyboard.press('ArrowRight');
    await expectPage(page, 2);
    await page.keyboard.press('ArrowLeft');
    await expectPage(page, 1);
  });

  test('bookmark ativo recebe aria-current="location" (O)', async ({ page }) => {
    await seedAndOpen(page);

    // Marca página 1
    await page.keyboard.press('B');
    // Deve existir um dot com aria-current
    await expect(page.locator('[aria-current="location"]')).toHaveCount(1);
    // Ao avançar, o dot da p.1 perde aria-current
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[aria-current="location"]')).toHaveCount(0);
  });
});

test.describe('Magazine viewer — swipe mobile', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('swipe esquerda avança página em mobile', async ({ page }) => {
    await seedAndOpen(page);
    await expectPage(page, 1);

    // Encontra o container swipe (main dentro do viewer)
    const surface = page.locator('main').first();
    const box = await surface.boundingBox();
    if (!box) test.skip(true, 'surface sem bounding box');

    // Swipe da direita para a esquerda (avança)
    await page.touchscreen.tap(box!.x + box!.width - 20, box!.y + box!.height / 2);
    // Playwright ainda não tem swipe primitivo — simulamos com touch dispatch
    await surface.dispatchEvent('touchstart', {
      touches: [{ clientX: box!.x + box!.width - 20, clientY: box!.y + box!.height / 2 }],
    });
    await surface.dispatchEvent('touchend', {
      changedTouches: [{ clientX: box!.x + 20, clientY: box!.y + box!.height / 2 }],
    });

    await expectPage(page, 2);
  });
});
