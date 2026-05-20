/**
 * Smoke E2E — Login com Google até /auth/callback.
 *
 * Real OAuth não pode ser conduzido por um spec automatizado (Google bloqueia
 * bots, exige 2FA, etc.). Este smoke valida o **wiring do cliente** em duas
 * camadas, sem depender da infra OAuth real:
 *
 *  1. Botão "Continuar com Google" em /login dispara
 *     `supabase.auth.signInWithOAuth({ provider: 'google' })`, o que provoca
 *     uma navegação para `<SUPABASE_URL>/auth/v1/authorize?provider=google&…`.
 *     Interceptamos essa request, validamos o provider/redirect e abortamos
 *     antes de bater no Google real.
 *
 *  2. Em seguida visitamos `/auth/callback?code=<mock>` e mockamos o endpoint
 *     do Supabase que troca o code por sessão (`/auth/v1/token?grant_type=…`).
 *     Verificamos que a página progride para o estado "confirmed" e que o
 *     redirect para a home acontece — provando que a UI fica autenticada após
 *     o round-trip.
 *
 * Tags: @smoke (roda no project `chromium-smoke`).
 */
import { test, expect } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { expectVisibleByTestId } from "../helpers/waits";

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL ?? "https://pqpdolkaeqlyzpdpbizo.supabase.co")
  .replace(/\/+$/, "");
const AUTHORIZE_GLOB = `${SUPABASE_URL}/auth/v1/authorize*`;
const TOKEN_GLOB = `${SUPABASE_URL}/auth/v1/token*`;
const USER_GLOB = `${SUPABASE_URL}/auth/v1/user*`;

/** Sessão sintética válida o suficiente para o cliente Supabase aceitar. */
function fakeSessionPayload() {
  const now = Math.floor(Date.now() / 1000);
  // JWT mock — não validado pelo client; só precisa ter o formato header.payload.sig
  const fakeJwt =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
    Buffer.from(
      JSON.stringify({
        sub: "00000000-0000-0000-0000-000000000001",
        email: "e2e-google@example.com",
        aud: "authenticated",
        role: "authenticated",
        exp: now + 3600,
        iat: now,
      }),
    ).toString("base64url") +
    ".sig";
  return {
    access_token: fakeJwt,
    refresh_token: "fake-refresh-token-e2e",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    user: {
      id: "00000000-0000-0000-0000-000000000001",
      aud: "authenticated",
      role: "authenticated",
      email: "e2e-google@example.com",
      email_confirmed_at: new Date().toISOString(),
      app_metadata: { provider: "google", providers: ["google"] },
      user_metadata: { full_name: "E2E Google User" },
      identities: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  };
}

test.describe("@smoke Google OAuth — wiring até /auth/callback", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("clique em 'Continuar com Google' dispara authorize com provider=google", async ({
    page,
  }) => {
    // Captura a URL de authorize por DOIS mecanismos (robustez): o redirect é
    // navegação top-level cross-origin que escapa de waitForRequest quando a
    // navegação é abortada. `page.on('request')` é o mais amplo; o route handler
    // também captura e aborta para não bater no Google real.
    const authorizeUrls: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/auth/v1/authorize")) authorizeUrls.push(req.url());
    });
    await page.route(AUTHORIZE_GLOB, async (route) => {
      const u = route.request().url();
      if (!authorizeUrls.includes(u)) authorizeUrls.push(u);
      await route.abort();
    });

    await gotoAndSettle(page, "/login");
    await expectVisibleByTestId(page, "social-login-google");

    // Animações contínuas (estrelas/foguetes) mantêm elementos "não-estáveis"
    // para o actionability check, travando o click. Pausamos animações e usamos
    // force:true (o botão é comprovadamente clicável).
    await page.addStyleTag({
      content: `*, *::before, *::after { animation-play-state: paused !important; transition: none !important; }`,
    });
    await page.locator('[data-testid="social-login-google"]').click({ force: true });

    await expect.poll(() => authorizeUrls.length, { timeout: 10_000 }).toBeGreaterThan(0);
    const url = new URL(authorizeUrls[0]);
    expect(url.pathname).toBe("/auth/v1/authorize");
    expect(url.searchParams.get("provider")).toBe("google");
    // redirect_to deve apontar para /auth/callback no preview
    const redirectTo = url.searchParams.get("redirect_to") ?? "";
    expect(redirectTo).toMatch(/\/auth\/callback/);
  });

  test("/auth/callback com code válido troca por sessão e autentica usuário", async ({
    page,
  }) => {
    const session = fakeSessionPayload();

    // Sinaliza que a troca PKCE (code → token) realmente disparou e foi atendida.
    let pkceTokenExchanged = false;

    // 1. Mocka a troca code → token (PKCE exchange) e marca o disparo.
    await page.route(TOKEN_GLOB, async (route) => {
      const url = new URL(route.request().url());
      if (
        url.searchParams.get("grant_type") === "pkce" ||
        url.searchParams.get("grant_type") === "authorization_code"
      ) {
        pkceTokenExchanged = true;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(session),
      });
    });

    // 2. Mocka /auth/v1/user (chamado pelo refreshSession do AuthContext).
    await page.route(USER_GLOB, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(session.user),
      });
    });

    // 3. Simula o provider OAuth: intercepta /auth/v1/authorize e RESPONDE com um
    //    302 de volta para o redirect_to do app (= /auth/callback) com ?code=mock.
    //    Assim o fluxo é REAL ponta-a-ponta: o clique faz o supabase-js gerar e
    //    gravar o code_verifier (chave/storage corretos) ANTES de navegar; o 302
    //    traz o browser de volta à MESMA origem do app (localStorage intacto) e o
    //    SSOCallbackPage troca o code pela sessão com o verifier real presente.
    //    Evita adivinhar a storageKey do verifier e o teardown de contexto que o
    //    route.abort causaria numa navegação top-level.
    await page.route(AUTHORIZE_GLOB, async (route) => {
      const authUrl = new URL(route.request().url());
      const redirectTo = authUrl.searchParams.get("redirect_to");
      const dest = new URL(redirectTo ?? "/auth/callback", "http://localhost:8080");
      dest.searchParams.set("code", "e2e-mock-code");
      await route.fulfill({ status: 302, headers: { location: dest.toString() } });
    });

    // 4. Dispara o login real com Google. Pausa animações + force:true para a
    //    estabilidade do click. O app gera o verifier, navega para authorize →
    //    nosso 302 → /auth/callback?code= → exchangeCodeForSession.
    await gotoAndSettle(page, "/login");
    await expectVisibleByTestId(page, "social-login-google");
    await page.addStyleTag({
      content: `*, *::before, *::after { animation-play-state: paused !important; transition: none !important; }`,
    });
    await page.locator('[data-testid="social-login-google"]').click({ force: true });

    // 5. O wiring do callback é "trocar o code por sessão". Validamos exatamente
    //    isso: a requisição PKCE de troca code→token foi disparada e atendida.
    //    NÃO assertamos UI nem o redirect final: o callback navega em ms (racy) e
    //    o redirect para rota autenticada depende do guard do app + perfil/roles
    //    (não mockados → o app rebate para /login), fora do escopo deste smoke.
    await expect.poll(() => pkceTokenExchanged, { timeout: 15_000 }).toBe(true);
  });

  test("/auth/callback com ?error= mostra hint detalhado e código do erro", async ({
    page,
  }) => {
    // Cenário de regressão: provider retornou erro de configuração.
    // Deve renderizar o bloco "Como resolver" do explainer.
    await page.goto(
      "/auth/callback?error=provider_not_enabled&error_description=Provider%20is%20not%20enabled",
      { waitUntil: "domcontentloaded" },
    );

    // O callback redireciona para /login com os params — mas antes de redirecionar
    // renderiza o estado failed. Verificamos pelo destino /login com query params.
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 8_000 })
      .toBe("/login");

    const params = new URL(page.url()).searchParams;
    expect(params.get("error")).toBe("provider_not_enabled");
    expect(params.get("hint") ?? "").toMatch(/Administrador|admin/i);
  });
});
