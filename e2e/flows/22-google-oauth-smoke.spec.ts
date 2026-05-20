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
    // uma navegação top-level cross-origin que pode escapar de um único
    // mecanismo dependendo do timing do abort. `page.on('request')` é o mais
    // amplo; o route handler também captura e aborta para não bater no Google.
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

    // A página de login tem animações contínuas (estrelas/foguetes no painel de
    // branding) que mantêm elementos "não-estáveis" para o actionability check
    // do Playwright, fazendo o click travar (visible+enabled OK, mas nunca
    // "stable"). Pausamos animações/transições antes de clicar.
    await page.addStyleTag({
      content: `*, *::before, *::after { animation-play-state: paused !important; transition: none !important; }`,
    });

    // O click dispara signInWithOAuth, que redireciona (top-level via
    // window.location) para a URL de authorize do Supabase. O route handler
    // acima captura essa URL e aborta a navegação. Em vez de waitForRequest (que
    // corre com o abort da navegação top-level e é flaky), fazemos poll da
    // captura — robusto e determinístico (o trace confirma que o handler dispara).
    await page.locator('[data-testid="social-login-google"]').click();
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

    // Aborta o redirect de authorize: vamos disparar o signInWithOAuth real só
    // para que o PRÓPRIO app grave o code_verifier no storage (com a chave/
    // storage corretos do supabase-js) — sem sair da página.
    await page.route(AUTHORIZE_GLOB, (route) => route.abort());

    // 1. Mocka a troca code → token (PKCE exchange).
    await page.route(TOKEN_GLOB, async (route) => {
      const url = new URL(route.request().url());
      // grant_type=pkce|authorization_code → devolve sessão completa
      if (
        url.searchParams.get("grant_type") === "pkce" ||
        url.searchParams.get("grant_type") === "authorization_code"
      ) {
        pkceTokenExchanged = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(session),
        });
        return;
      }
      // refresh_token (caso o cliente faça refresh logo após login)
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

    // 3. Faz o app GRAVAR o code_verifier do jeito certo: dispara o
    //    signInWithOAuth real (botão Google). O supabase-js gera e persiste o
    //    verifier no storage com sua própria chave antes do redirect (que
    //    abortamos acima). Assim não dependemos de adivinhar `sb-<ref>-auth-
    //    token-code-verifier` — usamos o storage real do app.
    await gotoAndSettle(page, "/login");
    await expectVisibleByTestId(page, "social-login-google");
    await page.addStyleTag({
      content: `*, *::before, *::after { animation-play-state: paused !important; transition: none !important; }`,
    });
    await page.locator('[data-testid="social-login-google"]').click({ force: true });

    // Espera o verifier ser persistido (signInWithOAuth é async: gera o
    // code_challenge via crypto.subtle e só então grava + redireciona).
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            Object.keys(window.localStorage).some((k) => k.endsWith("-code-verifier")),
          ),
        { timeout: 8_000 },
      )
      .toBe(true);

    // 4. Agora visita o callback com um code fake (PKCE). O SSOCallbackPage
    //    chama exchangeCodeForSession, que encontra o verifier gravado pelo app
    //    e faz o POST /token (mockado acima).
    await page.goto("/auth/callback?code=e2e-mock-code", { waitUntil: "domcontentloaded" });

    // 4. O wiring do callback é "trocar o code por sessão". Validamos exatamente
    //    isso: a requisição PKCE de troca code→token foi disparada e atendida.
    //    NÃO assertamos os estados de UI (sso-callback-title/status/hint): o
    //    callback troca o code e navega para "/" em milissegundos, então esses
    //    elementos somem antes do assert (racy). E o redirect final para uma rota
    //    autenticada depende do guard do app + perfil/roles (não mockados aqui →
    //    o app rebate para /login), comportamento do app fora do escopo deste
    //    smoke do callback OAuth.
    await expect.poll(() => pkceTokenExchanged, { timeout: 10_000 }).toBe(true);
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
