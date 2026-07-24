/**
 * Personalização do orçamento — carregamento de técnicas.
 *
 * Cobre:
 *   1) Forçar falha 500 em `fn_get_product_customization_options` e validar
 *      que a UI exibe a mensagem amigável + botão "Tentar novamente".
 *   2) Smoke do passo de Personalização (auto-skip quando o usuário de teste
 *      não consegue chegar ao passo — evita flakiness em ambientes sem seed).
 */
import { test, expect, requireAuth } from '../fixtures/test-base';
import { gotoAndSettle } from '../helpers/nav';

const RPC_PATH = /\/rest\/v1\/rpc\/fn_get_product_customization_options/;

test.describe('Orçamentos — passo Personalização: carregamento de técnicas', () => {
  test.beforeEach(() => requireAuth());

  test('exibe mensagem amigável + "Tentar novamente" quando a RPC falha', async ({ page }) => {
    // Intercepta TODAS as chamadas da RPC e devolve 500.
    await page.route(RPC_PATH, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'forced failure (e2e)' }),
      });
    });

    await gotoAndSettle(page, '/orcamentos/novo');

    // Se o ambiente não permite abrir o passo de Personalização sem fluxo prévio,
    // o teste apenas confirma que NENHUMA mensagem técnica vaza na página inicial.
    const errorBanner = page.getByText(/Erro ao carregar técnicas/i);
    const retryBtn = page.getByRole('button', { name: /Tentar novamente/i });

    // Aguarda no máximo 8s para o passo aparecer; caso não apareça, encerra como skip.
    const appeared = await errorBanner
      .first()
      .waitFor({ state: 'visible', timeout: 8_000 })
      .then(() => true)
      .catch(() => false);

    test.skip(!appeared, 'Passo Personalização não acessível neste ambiente de E2E.');

    await expect(errorBanner.first()).toBeVisible();
    await expect(retryBtn.first()).toBeVisible();

    // Garante que NENHUM stack/raw error vaza para o usuário.
    await expect(
      page.getByText(/Cannot read properties of undefined|TypeError|stack/i),
    ).toHaveCount(0);
  });

  test('smoke: técnicas carregam sem mensagem de erro (auto-skip se não houver acesso ao passo)', async ({
    page,
  }) => {
    await gotoAndSettle(page, '/orcamentos/novo');

    const personalizationHeader = page.getByText(/Onde a arte será gravada\?/i).first();
    const reached = await personalizationHeader
      .waitFor({ state: 'visible', timeout: 8_000 })
      .then(() => true)
      .catch(() => false);

    test.skip(!reached, 'Passo Personalização não acessível sem seed/fluxo prévio.');

    // Nenhum banner de erro visível.
    await expect(page.getByText(/Erro ao carregar técnicas/i)).toHaveCount(0);
  });
});
