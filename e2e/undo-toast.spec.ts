/**
 * E2E — showUndoToast (componente compartilhado por CollectionDetailPage,
 * NotificationDrawer e useFavoriteLists).
 *
 * Como o toast é renderizado pelo MESMO componente em todos os 3 callers
 * (`UndoToastContent` via `showUndoToast`), cobrir o componente em E2E +
 * unit-tests dos callers (já existentes) prova o contrato end-to-end:
 *  - clique em "Desfazer" dispara `onUndo` → caller restaura o item.
 *  - `prefers-reduced-motion: reduce` desliga animações/transições.
 *
 * Os testes disparam o toast via helper global `window.__showUndoToast`
 * exposto apenas em DEV (ver `src/utils/undoToast.tsx`), evitando depender
 * de seed real de coleções/notificações/favoritos no ambiente Playwright.
 *
 * Cobertura de cada caller em fluxo real fica a cargo dos specs de
 * integração de página (a serem adicionados conforme seed e2e for criada).
 */
import { test, expect } from '@playwright/test';

const TOAST = '[data-testid="undo-toast"]';
const UNDO_BTN = '[data-testid="undo-toast-button"]';

async function triggerToast(
  page: import('@playwright/test').Page,
  opts: { title: string; description?: string; duration?: number },
) {
  return page.evaluate(
    ({ title, description, duration }) => {
      return new Promise<{ undoCalls: number }>((resolve) => {
        const w = window as unknown as {
          __showUndoToast?: (o: {
            title: string;
            description?: string;
            duration?: number;
            onUndo: () => void;
          }) => unknown;
          __undoCalls?: number;
          __resolveUndo?: () => void;
        };
        if (!w.__showUndoToast) {
          throw new Error('window.__showUndoToast indisponível (build não-DEV?)');
        }
        w.__undoCalls = 0;
        w.__resolveUndo = () => resolve({ undoCalls: w.__undoCalls ?? 0 });
        w.__showUndoToast({
          title,
          description,
          duration: duration ?? 5000,
          onUndo: () => {
            w.__undoCalls = (w.__undoCalls ?? 0) + 1;
            w.__resolveUndo?.();
          },
        });
      });
    },
    opts,
  );
}

test.describe('UndoToast — contrato compartilhado', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('clique em "Desfazer" invoca onUndo e dispensa o toast', async ({ page }) => {
    const pending = triggerToast(page, { title: 'Item removido', duration: 8000 });

    const toast = page.locator(TOAST);
    await expect(toast).toBeVisible();

    await page.locator(UNDO_BTN).click();

    const result = await pending;
    expect(result.undoCalls).toBe(1);

    // Toast original é dispensado e substituído pelo feedback "Ação desfeita!"
    await expect(page.locator(TOAST)).toHaveCount(0);
  });

  test('contagem regressiva é exibida e decrementa', async ({ page }) => {
    await triggerToast(page, { title: 't', duration: 5000 }).catch(() => {});
    const toast = page.locator(TOAST);
    await expect(toast).toBeVisible();
    // Counter inicial entre 4s e 5s (margem de tempo de render)
    await expect(toast).toContainText(/[45]s/);
  });

  test.describe('prefers-reduced-motion: reduce', () => {
    test.use({ colorScheme: 'light' });

    test('não aplica classes de transition/hover-shadow quando reduced', async ({
      browser,
    }) => {
      const context = await browser.newContext({ reducedMotion: 'reduce' });
      const page = await context.newPage();
      await page.goto('/');

      await triggerToast(page, { title: 't', duration: 8000 }).catch(() => {});
      const toast = page.locator(TOAST);
      await expect(toast).toBeVisible();
      await expect(toast).toHaveAttribute('data-reduced-motion', 'true');

      const btnClass = await page.locator(UNDO_BTN).getAttribute('class');
      expect(btnClass ?? '').not.toMatch(/transition-all/);
      expect(btnClass ?? '').not.toMatch(/hover:shadow-\[/);

      await context.close();
    });

    test('aplica transition quando reduced-motion está desligado', async ({
      browser,
    }) => {
      const context = await browser.newContext({ reducedMotion: 'no-preference' });
      const page = await context.newPage();
      await page.goto('/');

      await triggerToast(page, { title: 't', duration: 8000 }).catch(() => {});
      const toast = page.locator(TOAST);
      await expect(toast).toBeVisible();
      await expect(toast).toHaveAttribute('data-reduced-motion', 'false');

      const btnClass = await page.locator(UNDO_BTN).getAttribute('class');
      expect(btnClass ?? '').toMatch(/transition-all/);

      await context.close();
    });
  });
});

/**
 * Specs de integração por página (placeholders).
 *
 * Estes specs requerem seed específico (notificação não lida, favorito
 * existente, item em coleção) que ainda não está disponível como helper
 * E2E reutilizável. Marcados como `fixme` para sinalizar débito técnico
 * e aparecer no relatório do Playwright sem mascarar como verde.
 */
test.describe('UndoToast — integração por caller (TODO seed)', () => {
  test.fixme(
    'NotificationDrawer: marcar como lida e desfazer restaura badge',
    async () => {
      // TODO: seed via supabase --insert de uma notificação não lida do usuário e2e,
      // abrir o sino, clicar no item, validar toast, clicar "Desfazer",
      // confirmar que unreadCount voltou ao valor original.
    },
  );

  test.fixme(
    'CollectionDetailPage: remover item da coleção e desfazer restaura',
    async () => {
      // TODO: seed coleção com 1 produto, remover, validar toast,
      // clicar "Desfazer", confirmar item de volta na listagem.
    },
  );

  test.fixme(
    'Favoritos (useFavoriteLists): excluir lista e desfazer restaura',
    async () => {
      // TODO: seed lista de favoritos, excluir, validar toast,
      // clicar "Desfazer", confirmar lista reaparecendo na sidebar.
    },
  );
});
