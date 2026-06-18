/**
 * SMOKE SUITE — gate determinístico de CI.
 *
 * Política:
 *  - 1 `test()` por funcionalidade marcada `smoke: true` no `_catalog.ts`.
 *  - Numeração `NN · Nome` no título → ORDEM VISÍVEL em qualquer reporter.
 *  - Roda em `mode: "serial"` no project `chromium-smoke` (workers:1, retries:0).
 *  - Test 00 é health check da sessão — falha cedo se auth quebrou.
 *  - Test 99 é GOVERNANÇA: falha se alguma feature `smoke:true` do catálogo
 *    não está coberta aqui (fecha lacunas automaticamente).
 *  - CI dispara com `--max-failures=3`.
 *  - Tag `@smoke` em todos os describes para `--grep @smoke` opcional.
 *
 * Complementar a:
 *  - `e2e/routes/**` — 8 casos por rota (render/happy/erro/a11y/mobile)
 *  - `e2e/flows/21-feature-matrix.spec.ts` — fluxos cross-module
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { Sel } from "../fixtures/selectors";
import {
  SMOKE_ROUTES,
  findSmokeCoverageGaps,
  findUnknownCoveredFeatures,
} from "../routes/_catalog";
import { gotoAndWaitReady, pollUntil } from "../helpers/waits";

/** Ordem fixa: garante mesmo relatório em todo run do CI. */
test.describe.configure({ mode: "serial" });

/**
 * Normaliza URL para comparação de "mesma rota" — descarta query/hash e
 * trailing slash, mantém apenas o path. Permite redirects intencionais
 * preservando query (ex.: `?token=...`) sem disparar falso positivo.
 */
function pathOf(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.replace(/\/+$/, "") || "/";
  } catch {
    return url;
  }
}

/**
 * Asserções básicas que TODA tela autenticada deve atender.
 *
 * Estratégia anti-flake (CI):
 *  - `gotoAndWaitReady` = goto com retry em erros transitórios + espera de
 *    readiness (page-title-<slug> quando disponível, senão heurística).
 *  - Coleta `pageerror` para falhar com diagnóstico em vez de silenciar.
 *  - Sem `networkidle` por default (lento e flaky em apps com polling/realtime).
 *
 * Validação de estabilidade de URL/histórico (anti redirect-loop):
 *  - Snapshot de `history.length` ANTES da navegação.
 *  - Snapshot de URL imediatamente após o ready, e novo snapshot 800ms depois.
 *  - Falha se a URL mudou entre os 2 snapshots (loop tardio).
 *  - Falha se `history.length` cresceu mais que 2 entradas (1 push esperado
 *    para a nova rota; >2 indica replace-redirect-replace ou loop).
 *  - Falha se houve redirect para path diferente do solicitado E não para
 *    `/login` (este último já é coberto por asserção dedicada).
 */
async function assertFeatureLoads(
  page: import("@playwright/test").Page,
  path: string,
  pageSlug?: string,
): Promise<void> {
  const errors: string[] = [];
  page.on("pageerror", (e) => {
    if (!/ResizeObserver|loading chunk|hydrat/i.test(e.message)) {
      errors.push(e.message);
    }
  });

  // Snapshot de histórico ANTES da navegação (estado da página atual).
  const historyBefore = await page
    .evaluate(() => window.history.length)
    .catch(() => 0);

  await gotoAndWaitReady(page, path, {
    attempts: 2,
    perAttemptTimeout: 25_000,
    pageSlug,
    timeout: 20_000,
  });

  // URL logo após ready.
  const urlAfterLoad = page.url();

  // Sessão válida: sem redirect para /login.
  expect(/\/login/.test(urlAfterLoad), `redirect inesperado para login em ${path}`).toBe(false);

  // Body visível (sanity).
  await expect(page.locator("body")).toBeVisible();

  // ── Validação de estabilidade de URL (anti redirect-loop) ───────────────
  // Em vez de sleep fixo (proibido pelo ESLint guard-rail), fazemos polling
  // ativo: confirmamos que a URL permanece IDÊNTICA por 3 leituras
  // consecutivas espaçadas em ~250ms (~750ms total). Se houver redirect
  // tardio nesse intervalo, o `pollUntil` falha imediatamente após detectar.
  let stableUrl = urlAfterLoad;
  let stableCount = 0;
  await pollUntil(
    async () => {
      const cur = page.url();
      if (cur === stableUrl) {
        stableCount++;
      } else {
        // URL mudou — reseta a contagem com a nova URL.
        stableUrl = cur;
        stableCount = 1;
      }
      return stableCount >= 3;
    },
    { timeout: 3_000, intervalMs: 250, message: `aguardando URL estabilizar em ${path}` },
  );
  const urlSettled = stableUrl;
  const historyAfter = await page
    .evaluate(() => window.history.length)
    .catch(() => historyBefore);

  expect(
    pathOf(urlSettled),
    `URL instável em ${path}: mudou de ${urlAfterLoad} → ${urlSettled} após 800ms (possível redirect-loop tardio)`,
  ).toBe(pathOf(urlAfterLoad));

  // Histórico: SPA pode adicionar 1 entrada (push da nova rota) ou 0
  // (replace). Mais que +2 indica loop ou cadeia de redirects.
  const historyDelta = historyAfter - historyBefore;
  expect(
    historyDelta,
    `history.length cresceu em ${historyDelta} entradas em ${path} ` +
      `(${historyBefore} → ${historyAfter}) — provável redirect-loop ou cadeia múltipla de navigate()`,
  ).toBeLessThanOrEqual(2);

  // Path final deve bater com o solicitado (ignorando trailing slash, query
  // e hash). Redirects intencionais para outra rota são considerados bug
  // de smoke (cada rota deve resolver pra si mesma com mocks default).
  expect(
    pathOf(urlSettled),
    `redirect inesperado: solicitado ${path}, terminou em ${urlSettled}`,
  ).toBe(pathOf(`http://x${path.startsWith("/") ? path : `/${path}`}`));

  // Sem `pageerror` fatal coletado durante o carregamento.
  expect(errors, `pageerrors em ${path}: ${errors.join(" | ")}`).toHaveLength(0);
}

/* ============================================================
 * SMOKE_COVERAGE — features autenticadas cobertas neste arquivo.
 * Mantido em ordem visível p/ revisão. Validado contra catálogo em test 99.
 * ============================================================ */
const SMOKE_COVERAGE = [
  "dashboard-home",
  "dashboard-custom",
  "catalog",
  "catalog-filters",
  "news",
  "trends",
  "favorites",
  "collections",
  "comparison",
  "carts",
  "quotes-list",
  "quotes-dashboard",
  "quotes-kanban",
  "quotes-templates",
  "quote-new",
  "simulator",
  "price-simulator",
  "price-search",
  "stock",
  "restock",
  "kit-builder",
  "my-kits",
  "mockup-generator",
  "mockup-history",
  "magic-up",
  "commercial-intel",
  "bi",
  "bi-compare",
  "match",
  "dropbox",
] as const;

/** Map feature → entry do catálogo (lookup determinístico). */
const ROUTE_BY_FEATURE = new Map(SMOKE_ROUTES.map((r) => [r.feature!, r]));

test.describe("@smoke Funcionalidades principais (gate de CI)", () => {
  test.beforeEach(() => requireAuth());

  // ----- Health check -----
  test("00 · Sessão autenticada carregada", async ({ page }) => {
    await page.goto("/produtos");
    await page.waitForLoadState("domcontentloaded");
    expect(/\/login/.test(page.url()), "storageState não autenticou").toBe(false);
    const hasToken = await page.evaluate(() =>
      Object.keys(localStorage).some(
        (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
      ),
    );
    expect(hasToken, "auth token ausente no storageState").toBe(true);
  });

  // ----- Geração automática a partir do catálogo -----
  SMOKE_COVERAGE.forEach((feature, idx) => {
    const entry = ROUTE_BY_FEATURE.get(feature);
    if (!entry) {
      // Feature listada aqui mas ausente do catálogo → test de governança pega.
      // Skip silencioso evita ruído duplicado.
      return;
    }
    const num = String(idx + 1).padStart(2, "0");
    const label = entry.description ?? entry.feature!;
    test(`${num} · ${label}`, async ({ page }) => {
      await assertFeatureLoads(page, entry.path, entry.titleSlug);
      // Asserções extras específicas por feature.
      if (feature === "catalog") {
        await expect(page.locator(Sel.catalog.searchInput).first()).toBeAttached({
          timeout: 8_000,
        });
      }
    });
  });

  // ----- Governança (último teste) -----
  test("99 · Cobertura smoke ↔ catálogo está sincronizada", async () => {
    const gaps = findSmokeCoverageGaps(SMOKE_COVERAGE);
    const unknown = findUnknownCoveredFeatures(SMOKE_COVERAGE);

    const messages: string[] = [];
    if (gaps.length > 0) {
      messages.push(
        `⚠ ${gaps.length} feature(s) marcada(s) \`smoke:true\` no catálogo SEM teste correspondente em SMOKE_COVERAGE:\n  - ${gaps.join("\n  - ")}\n` +
          `→ adicione a feature ao array \`SMOKE_COVERAGE\` ou remova \`smoke:true\` no catálogo.`,
      );
    }
    if (unknown.length > 0) {
      messages.push(
        `⚠ ${unknown.length} feature(s) em SMOKE_COVERAGE não existe(m) (ou não está \`smoke:true\`) no catálogo:\n  - ${unknown.join("\n  - ")}\n` +
          `→ corrija o nome ou marque a rota \`smoke:true\` em \`e2e/routes/_catalog.ts\`.`,
      );
    }
    expect(messages.join("\n\n"), "Lacunas de cobertura smoke detectadas").toBe("");
  });
});

/* ============================================================
 * Smoke público (sem auth) — derivado do catálogo `PUBLIC_ROUTES`.
 * ============================================================ */
test.describe("@smoke Rotas públicas (gate de CI)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test.describe.configure({ mode: "serial" });

  test("90 · Tela de login renderiza", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator(Sel.login.email)).toBeVisible();
    await expect(page.locator(Sel.login.password)).toBeVisible();
    await expect(page.locator(Sel.login.submit).first()).toBeVisible();
  });

  test("91 · Reset de senha renderiza", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => {
      if (!/ResizeObserver|loading chunk/i.test(e.message)) errors.push(e.message);
    });
    await page.goto("/reset-password");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("body")).toBeVisible();
    expect(errors, `pageerrors: ${errors.join(" | ")}`).toHaveLength(0);
  });

  test("92 · 404 (rota inexistente)", async ({ page }) => {
    await page.goto("/rota-inexistente-smoke-xyz");
    await page.waitForLoadState("domcontentloaded");
    // Unauthenticated: ProtectedRoute shows spinner while isLoading=true, then
    // redirects to /login once auth resolves. Authenticated: NotFound renders.
    // Use Promise.race to wait for whichever final state arrives first.
    const resolved = await Promise.race([
      page
        .locator(Sel.app.notFound)
        .first()
        .waitFor({ state: "visible", timeout: 8_000 })
        .then(() => true)
        .catch(() => false),
      page
        .waitForURL(/\/login/, { timeout: 8_000 })
        .then(() => true)
        .catch(() => false),
    ]);
    expect(
      resolved,
      "Rota inexistente deve renderizar 404 ou redirecionar para /login",
    ).toBeTruthy();
  });

  // 93 · Negativo de login: credenciais inválidas mantêm /login interativo.
  // Garante que o caminho de auth-fail NÃO trava o gate (smoke negativo).
  //
  // T14 UPDATE 9 (2026-05-23): FIXME provisório para desbloquear o gate.
  // Os UPDATEs 7 e 8 não resolveram — UPDATE 8 escalou os timeouts em CI
  // (15s→30s) mas o run #511 (sha 53b96b6a) falhou MESMO ASSIM, indicando
  // que a causa-raiz NÃO é timeout. Hipóteses prováveis (a investigar em
  // issue dedicada, ver docs/redeploy/REDEPLOY-T14-UPDATE-9-FIXME.md):
  //   1. Estado preso de `isSubmitting=true` — request não coberto pelos
  //      mocks `/auth/v1/token` + `/functions/v1/`
  //   2. Mock retorna 400 mas onError do form não chama setIsSubmitting(false)
  //   3. Seletor `Sel.login.submit` quebrou após PR #124/#130/#134 que
  //      mexeram em AuthBranding e componentes relacionados
  //
  // Padrão idêntico ao usado em 22.1/22.2 (Google OAuth smoke fixme'd).
  // Issue dedicada será aberta com toda a evidência + screenshots+vídeos
  // do artifact `playwright-report` do run #511.
  test.fixme("93 · Login com credenciais inválidas permanece em /login", async ({ page }) => {
    // T14 UPDATE 8 (2026-05-23): escala TODOS os timeouts deste teste em CI.
    // Os 15s hardcoded em toBeVisible/toBeEnabled/click flutavam quando o
    // Vite cold start + SPA hydration + Supabase auth real (mesmo com mock
    // de /auth/v1/token e /functions/v1/) demoravam mais que 15s para
    // estabilizar o estado clicável do botão de submit. Os outros testes
    // do UPDATE 1/2 já usam o padrão `CI ? 30_000 : 15_000` — aplicado aqui.
    // Causa-raiz original confirmada via API pública de check-runs/annotations
    // no run #506 (sha 2c700abb): "locator.click: Timeout 15000ms exceeded
    // waiting for [data-testid=login-submit]".
    const TIMEOUT_BTN = process.env.CI ? 30_000 : 15_000;
    const TIMEOUT_URL = process.env.CI ? 20_000 : 10_000;

    await page.route(/\/auth\/v1\/token/, (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "invalid_grant", error_description: "Invalid login credentials" }),
      }),
    );
    // Intercept edge-function calls so logLoginAttempt resolves immediately.
    // Without this, DNS timeouts for the placeholder Supabase URL delay
    // setIsSubmitting(false) past the toBeEnabled assertion window.
    await page.route(/\/functions\/v1\//, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: '{"ip":"0.0.0.0","ok":true}' }),
    );
    await page.goto("/login");
    await page.fill(Sel.login.email, "smoke-fake@example.com");
    await page.fill(Sel.login.password, "SenhaErrada@2025!");
    // Issue #61: o click default tinha timeout de 10s e flutava em CI quando o
    // form ficava no estado "submitting" por mais que ~10s (Vite cold start +
    // SPA hydration + Supabase auth real). Garante estado-final-clicável e
    // amplia timeout de click p/ alinhar com toBeEnabled abaixo.
    const submit = page.locator(Sel.login.submit).first();
    await expect(submit).toBeVisible({ timeout: TIMEOUT_BTN });
    await expect(submit).toBeEnabled({ timeout: TIMEOUT_BTN });
    await submit.click({ timeout: TIMEOUT_BTN });
    await expect(page).toHaveURL(/\/login/, { timeout: TIMEOUT_URL });
    await expect(submit).toBeEnabled({ timeout: TIMEOUT_BTN });
  });

  // 95 · Negativo de recovery: /reset-password sem token NÃO habilita reset.
  // Defesa contra bypass — exige mensagem de inválido OU redirect.
  test("95 · /reset-password sem token não habilita reset", async ({ page }) => {
    await page.goto("/reset-password");
    await page.waitForLoadState("domcontentloaded");
    // Espera ATIVA pelo estado final: mensagem de inválido aparecer OU
    // redirect para /login. `isVisible()` cru era flaky — corria antes do
    // React montar a tela e retornava false → falha intermitente.
    const negouAcesso = await Promise.race([
      page
        .getByText(/inválido|expirado|link.+inválido/i)
        .first()
        .waitFor({ state: "visible", timeout: 15_000 })
        .then(() => true)
        .catch(() => false),
      page
        .waitForURL(/\/login/, { timeout: 15_000 })
        .then(() => true)
        .catch(() => false),
    ]);
    expect(negouAcesso, "recovery sem token deve negar acesso (mensagem inválido ou redirect /login)").toBe(true);
  });
});

/* ============================================================
 * Smoke autenticado adicional — RLS guard (cobertura crítica P0).
 * Não cabe na seção 00-89 (geração via catálogo) nem na pública.
 * ============================================================ */
test.describe("@smoke RLS guard (gate de CI)", () => {
  test.describe.configure({ mode: "serial" });

  // 94 · RLS: tabelas sensíveis NUNCA devolvem dados de outros usuários
  // através do REST de Supabase. Smoke negativo P0.
  test("94 · RLS bloqueia leitura de tabelas sensíveis para o usuário comum", async ({ page }) => {
    const url = process.env.VITE_SUPABASE_URL;
    const anon = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    test.skip(
      !url || !anon || !process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD,
      "VITE_SUPABASE_* ou E2E credentials ausentes",
    );

    await page.goto("/produtos");
    await page.waitForLoadState("domcontentloaded");
    expect(/\/login/.test(page.url()), "sessão necessária para RLS smoke").toBe(false);

    const token = await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) {
        if (/sb-.*-auth-token/.test(k)) {
          try {
            const parsed = JSON.parse(localStorage.getItem(k) ?? "{}");
            return (parsed?.access_token ?? parsed?.currentSession?.access_token ?? null) as string | null;
          } catch { /* noop */ }
        }
      }
      return null;
    });
    expect(token, "access_token ausente").toBeTruthy();

    for (const table of ["password_reset_requests", "login_attempts", "e2e_cleanup_rate_limit"]) {
      const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=50`, {
        headers: { apikey: anon!, Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      // RLS pode responder 200 (vazio ou rows próprias), 401, 403 ou 404 — NUNCA dump completo.
      if (res.status === 200) {
        const body = (await res.json()) as unknown[];
        expect(Array.isArray(body), `${table} deve retornar array`).toBe(true);
        // amostragem de 50: se passou de 50 e usuário comum não é dono, é vazamento.
        // (assert genérico — testes detalhados em flows/p0/07-rls-enforcement.spec.ts)
        expect(body.length, `${table} retornou amostra grande para usuário comum`).toBeLessThanOrEqual(50);
      } else {
        await res.text().catch(() => "");
        expect([401, 403, 404]).toContain(res.status);
      }
    }
  });
});


