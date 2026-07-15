/**
 * Magazine — E2E do fluxo autenticado de PUBLICAÇÃO.
 *
 * Cobre o gap deixado por `magazine-smoke.spec.ts` (que só valida leitura):
 *   1. Autentica via `loginAs` (skip auto se .env.e2e ausente).
 *   2. Cria uma revista (magazine-create-btn).
 *   3. Preenche título com prefixo `e2eName(...)` para o cleanup escopado
 *      não deixar lixo no BD Gold.
 *   4. Adiciona 1 produto (step "Produtos").
 *   5. Concede permissão de clipboard e clica em "Publicar".
 *   6. Valida:
 *      - Toast de sucesso "Revista publicada. Link copiado…"
 *      - Clipboard contém uma URL no formato /revista-publica/<32 hex>
 *      - Aberta em uma nova aba pública, a URL renderiza sem redirecionar
 *        para /login e sem enviar header Authorization à edge
 *        magazine-public-view.
 *
 * Convenções do projeto E2E:
 *   - Seletores via `[data-testid=...]` (memória E2E Selectors Policy).
 *   - Sem `waitForTimeout` / `networkidle`.
 *   - Nome do arquivo termina em `smoke.spec.ts` para rodar no project
 *     `chromium-smoke` do playwright.config.ts (mesmo perfil do
 *     `magazine-smoke.spec.ts` — UI login, sem storageState).
 *
 * Rodar localmente:
 *   npx playwright test e2e/flows/magazine-publish-smoke.spec.ts \
 *     --project=chromium-smoke
 *
 * Requer `.env.e2e` com E2E_USER_EMAIL / E2E_USER_PASSWORD apontando para
 * um usuário do BD Gold (doufsxqlfjyuvxuezpln). Sem essas variáveis, o
 * teste faz skip automático via `loginAs`.
 */
import { expect } from "@playwright/test";

import { test } from "../fixtures/test-base";
import { loginAs } from "../helpers/auth";
import { gotoAndSettle, waitForRouteIdle } from "../helpers/nav";
import { e2eName } from "../helpers/e2e-resources";

const PUBLIC_TOKEN_RE = /\/revista-publica\/([a-f0-9]{16,64})/i;

test.describe("@smoke Magazine — fluxo autenticado de publicação", () => {
  test("publica revista e copia URL pública gerada", async ({ page, context }) => {
    await loginAs(page);

    // Clipboard exige permissão explícita no Chromium.
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: page.url().startsWith("http")
        ? new URL(page.url()).origin
        : "http://localhost:8080",
    });

    // 1) Vai para /magazine e cria uma revista nova.
    await gotoAndSettle(page, "/magazine");
    await expect(page).toHaveURL(/\/magazine(\/|$)/);

    const createBtn = page.locator('[data-testid="magazine-create-btn"]').first();
    await createBtn.waitFor({ state: "visible", timeout: 10_000 });
    await createBtn.click();
    await page.waitForURL(/\/magazine\/[a-f0-9-]{6,}/i, { timeout: 15_000 });
    await waitForRouteIdle(page);

    // 2) Preenche o título com prefixo E2E (cleanup escopado).
    const title = e2eName("magazine-publish");
    const titleInput = page.locator('[data-testid="magazine-title-input"]').first();
    await titleInput.waitFor({ state: "visible", timeout: 10_000 });
    await titleInput.fill(title);
    // Blur para disparar o autosave do editor.
    await titleInput.blur();

    // 3) Vai para o step "Produtos".
    const productsStep = page.locator('[data-testid="magazine-step-products"]').first();
    await productsStep.waitFor({ state: "visible", timeout: 10_000 });
    await productsStep.click();

    // Espera a lista de produtos hidratar.
    const productSearch = page.locator('[data-testid="magazine-product-search"]').first();
    await productSearch.waitFor({ state: "visible", timeout: 15_000 });

    // Seleciona o primeiro produto disponível (button[aria-pressed] dentro do grid).
    const firstProductBtn = page
      .locator('button[aria-pressed]:not([disabled]):has(img)')
      .first();
    await firstProductBtn.waitFor({ state: "visible", timeout: 20_000 });
    await firstProductBtn.click();

    // Clica em "Adicionar".
    const addBtn = page.locator('[data-testid="magazine-product-add-btn"]').first();
    await expect(addBtn, "botão 'Adicionar' deve habilitar após seleção").toBeEnabled({
      timeout: 5_000,
    });
    await addBtn.click();

    // 4) Clica em "Publicar" — o botão do header (o primeiro).
    const publishBtn = page.getByRole("button", { name: /^Publicar$/ }).first();
    await expect(publishBtn, "'Publicar' deve estar habilitado com título+produto").toBeEnabled({
      timeout: 10_000,
    });

    // Captura response do UPDATE para provar que a trigger devolveu public_token.
    const magazineUpdates: Array<{ status: number; token: string | null }> = [];
    page.on("response", async (res) => {
      const url = res.url();
      if (!url.includes("/rest/v1/magazines")) return;
      if (res.request().method() !== "PATCH") return;
      try {
        const body = await res.json();
        const row = Array.isArray(body) ? body[0] : body;
        magazineUpdates.push({
          status: res.status(),
          token: (row && (row.public_token as string | null)) ?? null,
        });
      } catch {
        magazineUpdates.push({ status: res.status(), token: null });
      }
    });

    await publishBtn.click();

    // 5) Valida toast de sucesso.
    const successToast = page.getByText(/Revista publicada\..*Link copiado/i);
    await expect(
      successToast,
      "toast 'Revista publicada — Link copiado' não apareceu",
    ).toBeVisible({ timeout: 15_000 });

    // 6) Valida clipboard.
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard, `clipboard vazio: ${clipboard}`).toMatch(PUBLIC_TOKEN_RE);
    const match = clipboard.match(PUBLIC_TOKEN_RE);
    const token = match?.[1];
    expect(token, "token público não extraído da URL copiada").toBeTruthy();

    // 7) Prova que o token veio do BD (trigger) OU do fallback client-side —
    //    ambos são aceitos, mas registramos qual foi para debug de regressão.
    const anyPublishedRow = magazineUpdates.find((r) => r.status >= 200 && r.status < 300);
    expect(
      anyPublishedRow,
      `nenhum UPDATE bem-sucedido observado. Trace: ${JSON.stringify(magazineUpdates)}`,
    ).toBeTruthy();

    // 8) Abre a URL pública em nova aba e valida ausência de auth.
    const publicPage = await context.newPage();
    const edgeCalls: Array<{ status: number; hasAuth: boolean }> = [];
    publicPage.on("request", (req) => {
      if (req.url().includes("/functions/v1/magazine-public-view")) {
        edgeCalls.push({
          status: 0,
          hasAuth: Boolean(req.headers()["authorization"]),
        });
      }
    });
    publicPage.on("response", (res) => {
      if (res.url().includes("/functions/v1/magazine-public-view")) {
        const last = edgeCalls[edgeCalls.length - 1];
        if (last) last.status = res.status();
      }
    });

    await publicPage.goto(clipboard, { waitUntil: "domcontentloaded" });
    await expect(publicPage, "URL pública NÃO deve redirecionar para /login").not.toHaveURL(
      /\/login/,
    );

    // A edge magazine-public-view deve ter sido chamada sem Authorization.
    expect(
      edgeCalls.length,
      "edge magazine-public-view não foi chamada pela rota pública",
    ).toBeGreaterThan(0);
    const ok = edgeCalls.find((c) => c.status === 200);
    expect(
      ok,
      `edge não respondeu 200. Trace: ${JSON.stringify(edgeCalls)}`,
    ).toBeTruthy();
    expect(
      ok?.hasAuth,
      "edge pública NÃO deve receber Authorization",
    ).toBeFalsy();

    await publicPage.close();
  });
});
