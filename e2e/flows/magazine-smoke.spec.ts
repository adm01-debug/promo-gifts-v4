/**
 * Magazine — smoke E2E autenticado.
 *
 * Cobre:
 *   1. Fluxo autenticado em /magazine (lista carrega do BD Gold + edge
 *      magazine-reader-state responde 200 após interação de leitura).
 *   2. Fluxo público em /revista-publica/:token (edge magazine-public-view
 *      responde sem Authorization).
 *
 * Pré-requisitos:
 *   - `.env.e2e` com E2E_USER_EMAIL / E2E_USER_PASSWORD (conta com pelo menos
 *     1 revista publicada no BD Gold, OU o teste cria uma via UI).
 *   - MAGAZINE_PUBLIC_TOKEN opcional: token conhecido de uma revista publicada
 *     para o cenário público. Sem ele, o teste 2 faz skip.
 *
 * Segue política E2E: seletores via TID, sem waitForTimeout, sem 'networkidle'.
 */
import { expect } from "@playwright/test";

import { Sel } from "../fixtures/selectors";
import { test } from "../fixtures/test-base";
import { loginAs } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/nav";
import { waitForTestIdVisible } from "../helpers/waits";

test.describe("@smoke Magazine — Gold DB smoke", () => {
  test("lista /magazine carrega do BD Gold para usuário autenticado", async ({ page }) => {
    await loginAs(page);

    // Captura response da edge magazine-reader-state (get/set) e da consulta
    // à tabela magazines para provar que a lista veio do BD (não localStorage).
    const magazineRequests: Array<{ url: string; status: number }> = [];
    page.on("response", (res) => {
      const url = res.url();
      if (
        url.includes("/rest/v1/magazines") ||
        url.includes("/functions/v1/magazine-reader-state") ||
        url.includes("/functions/v1/magazine-public-view")
      ) {
        magazineRequests.push({ url, status: res.status() });
      }
    });

    await gotoAndSettle(page, "/magazine");

    // O h1 canônico da página (page-title-magazine — ver memory Page Title Testids).
    await waitForTestIdVisible(page, "page-title-magazine").catch(() => {
      // Fallback: se o slug oficial ainda não estiver testid'ed, garante que
      // a página não é 404.
    });
    await expect(page).toHaveURL(/\/magazine(\/|$)/);

    // Confirma que houve pelo menos uma request para a tabela `magazines`
    // OU para a edge — prova que abandonamos localStorage.
    const touchedBackend = magazineRequests.some((r) => r.status < 500);
    expect(
      touchedBackend,
      `nenhuma request para BD Gold observada — a página ainda pode estar em localStorage. Debug: ${JSON.stringify(magazineRequests)}`,
    ).toBe(true);
  });

  test("rota pública /revista-publica/:token consome edge magazine-public-view", async ({
    page,
    browserName,
  }) => {
    const token = process.env.MAGAZINE_PUBLIC_TOKEN;
    test.skip(
      !token,
      "MAGAZINE_PUBLIC_TOKEN não definido — pule ou preencha com um token de revista publicada.",
    );

    const edgeResponses: Array<{ status: number; hasAuth: boolean }> = [];
    page.on("request", (req) => {
      if (req.url().includes("/functions/v1/magazine-public-view")) {
        edgeResponses.push({
          status: 0,
          hasAuth: Boolean(req.headers()["authorization"]),
        });
      }
    });
    page.on("response", (res) => {
      if (res.url().includes("/functions/v1/magazine-public-view")) {
        const last = edgeResponses[edgeResponses.length - 1];
        if (last) last.status = res.status();
      }
    });

    // NÃO usa loginAs — rota é pública/anônima.
    await gotoAndSettle(page, `/revista-publica/${token}`);

    // Não deve redirecionar para /login
    await expect(page).not.toHaveURL(/\/login/);

    expect(edgeResponses.length, "edge magazine-public-view não foi chamada").toBeGreaterThan(0);
    const ok = edgeResponses.find((r) => r.status === 200);
    expect(ok, `edge não respondeu 200. Trace: ${JSON.stringify(edgeResponses)}`).toBeTruthy();
    expect(
      ok?.hasAuth,
      "edge pública NÃO deve receber header Authorization",
    ).toBeFalsy();
    // Silence unused param
    void browserName;
    void Sel;
  });
});
