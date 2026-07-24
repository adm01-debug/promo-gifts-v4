/**
 * Fluxo: Onboarding tour só é disparado pelo botão "Reiniciar Tour".
 *
 * Regressão: clicar na logo do sidebar costumava abrir o tour. Agora a
 * logo apenas navega para "/" e o ÚNICO gatilho de reabertura é o botão
 * "Reiniciar Tour" (visível só após o usuário ter concluído o tour).
 *
 * Cobre:
 *  1. Após carregar a home, clicar na logo do sidebar NÃO mostra o overlay
 *     do tour e mantém/leva a URL para "/".
 *  2. Quando o botão "Reiniciar Tour" está disponível (usuário já completou
 *     o tour), clicá-lo abre o overlay no passo 1.
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle, expectOnRoute } from "../helpers/nav";

test.describe("Fluxo: Onboarding tour disparo", () => {
  test.beforeEach(() => requireAuth());

  test("clicar na logo do sidebar não inicia o tour e leva para /", async ({ page }) => {
    await gotoAndSettle(page, "/catalogo");
    // tour não deve estar visível ao chegar numa rota interna
    await expect(page.getByTestId("onboarding-tour")).toHaveCount(0);

    await page.getByTestId("sidebar-brand-header").click();
    await expectOnRoute(page, "/");

    // pequena janela para garantir que NADA disparou o tour
    await page.waitForTimeout(500);
    await expect(page.getByTestId("onboarding-tour")).toHaveCount(0);
  });

  test('botão "Reiniciar Tour" inicia o tour do passo 1', async ({ page }) => {
    await gotoAndSettle(page, "/");
    const restart = page.getByTestId("restart-tour-button");

    // só faz sentido quando o usuário já completou o tour
    if ((await restart.count()) === 0) {
      test.skip(true, 'Usuário ainda não completou o tour — botão "Reiniciar" não está visível.');
    }

    await restart.first().click();
    const tour = page.getByTestId("onboarding-tour");
    await expect(tour).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Passo\s+1\s+de/i)).toBeVisible();
  });
});
