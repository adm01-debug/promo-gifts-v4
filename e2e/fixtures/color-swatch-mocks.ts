import type { Page } from '@playwright/test';

/**
 * STUB — `installColorStockMock` é referenciada por `color-swatch-sweep.spec.ts`,
 * porém o fixture original NUNCA foi commitado no repositório (foi adicionado por
 * um commit "Changes" do Lovable em `main` sem o arquivo de fixture). A ausência
 * do módulo quebrava a COLETA do Playwright com "Cannot find module", derrubando
 * TODOS os projetos e2e (smoke, card-parity em webkit/firefox/mobile, etc.) antes
 * mesmo de qualquer teste rodar.
 *
 * Este stub restabelece a resolução do import. O único teste que o consome
 * ("Cenário out-of-stock determinístico (mock)") está marcado como `.skip` no spec
 * até que o mock real de cor/estoque seja reimplementado (injetar a cor
 * "Preto Mock" como out-of-stock para um `productId`, interceptando a API de
 * variantes/estoque do produto).
 */
export function installColorStockMock(
  _page: Page,
  _opts: { productId: string },
): Promise<void> {
  // no-op — ver nota acima. Retorna Promise resolvida p/ casar com o `await` do spec
  // sem `async` vazio (evita require-await).
  return Promise.resolve();
}
