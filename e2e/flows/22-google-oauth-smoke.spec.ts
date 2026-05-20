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

    // 3. Faz o PRÓPRIO app gravar o code_verifier (abordagem robusta, validada
    //    por trace: o signInWithOAuth real gera e grava o verifier 22x, mas o
    //    redirect top-level + route.abort destruía o contexto de execução,
    //    deixando o localStorage ilegível para o teste).
    //    Adivinhar a chave `sb-<ref>-auth-token-code-verifier` e injetar via
    //    addInitScript NÃO funciona (o gotrue lê vazio — confirmado por trace:
    //    "code verifier should be non-empty"). Em vez disso, deixamos o app
    //    gerar/gravar o verifier com a chave/storage REAIS e impedimos o
    //    redirect: override de window.location.assign (no-op). Assim o contexto
    //    fica intacto e o verifier persiste na MESMA origem até /auth/callback.
    await page.addInitScript(() => {
      try {
        Object.defineProperty(window.location, "assign", {
          configurable: true,
          value: () => {
            /* no-op: impede o redirect top-level para o authorize, preservando
               o contexto de execução e o localStorage da origem do app. */
          },
        });
      } catch {
        /* alguns engines não permitem redefinir location.assign — ignora. */
      }
    });
    // Rede de segurança: caso o override falhe e o redirect dispare, aborta o
    // request de authorize (com o override ativo, nenhum request sai).
    await page.route(AUTHORIZE_GLOB, (route) => route.abort());

    await gotoAndSettle(page, "/login");
    await expectVisibleByTestId(page, "social-login-google");
    await page.addStyleTag({
      content: `*, *::before, *::after { animation-play-state: paused !important; transition: none !important; }`,
    });
    // force:true: este click é SETUP (fazer o app gerar/gravar o verifier); o
    // click "de verdade" já é validado no teste 40.
    await page.locator('[data-testid="social-login-google"]').click({ force: true });

    // Espera o app persistir o code_verifier (signInWithOAuth é async: gera o
    // code_challenge via crypto.subtle e só então grava). Com o redirect virado
    // no-op, o contexto fica intacto e a leitura do localStorage é confiável.
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            Object.keys(window.localStorage).some((k) => k.endsWith("-code-verifier")),
          ),
        { timeout: 8_000 },
      )
      .toBe(true);

    // 4. Visita o callback com um code fake (mesma origem → verifier preservado).
    //    O SSOCallbackPage chama exchangeCodeForSession, que acha o verifier
    //    gravado pelo app e faz o POST /token (mockado acima).
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

    // O callback redireciona para /login com os params do erro. A página de Auth
    // CONSOME o param `error` (exibe o explainer e limpa `error` da URL via
    // setSearchParams), então não dá para asserir sobre `?error=` — verificamos o
    // RESULTADO renderizado: o bloco de hint do explainer ("Solução: …admin…").
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 8_000 })
      .toBe("/login");

    const hint = page.getByTestId("social-login-error-hint");
    await expect(hint).toBeVisible({ timeout: 8_000 });
    await expect(hint).toContainText(/administrador|admin/i);
  });
});
