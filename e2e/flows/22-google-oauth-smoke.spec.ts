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
 *
 * NOTA (T14, 2026-05-22): tests 22.1 e 22.2 marcados como `test.fixme` porque
 * dependem de Google OAuth provider HABILITADO no Supabase Oficial
 * (doufsxqlfjyuvxuezpln). Após migração do Lovable Cloud (pqpdolkaeqlyzpdpbizo)
 * para o Oficial, esse provider precisa ser re-configurado no Auth dashboard.
 * Issue de tracking: criar para reabilitar tests após config OAuth.
 *
 * Test 22.1: locator.click() em 'social-login-google' timeout 30s no CI run #450.
 *   Causa: signInWithOAuth() falha porque provider não está enabled, então o
 *   botão fica em estado pending/blocking e o click nunca completa o flow.
 *
 * Test 22.2: AuthContext chama profiles/user_roles/organization_members fora
 *   dos mocks, retornando 401/403 do Supabase real e redirecionando para
 *   /login. Refatorar para mockar todos os endpoints ou usar sessão real.
 */
import { test, expect } from '../fixtures/test-base';
import { gotoAndSettle } from '../helpers/nav';
import { expectVisibleByTestId } from '../helpers/waits';

const SUPABASE_URL = (
  process.env.VITE_SUPABASE_URL ?? 'https://doufsxqlfjyuvxuezpln.supabase.co'
).replace(/\/+$/, '');
const AUTHORIZE_GLOB = `${SUPABASE_URL}/auth/v1/authorize*`;
const TOKEN_GLOB = `${SUPABASE_URL}/auth/v1/token*`;
const USER_GLOB = `${SUPABASE_URL}/auth/v1/user*`;

/** Sessão sintética válida o suficiente para o cliente Supabase aceitar. */
function fakeSessionPayload() {
  const now = Math.floor(Date.now() / 1000);
  // JWT mock — não validado pelo client; só precisa ter o formato header.payload.sig
  const fakeJwt =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
    Buffer.from(
      JSON.stringify({
        sub: '00000000-0000-0000-0000-000000000001',
        email: 'e2e-google@example.com',
        aud: 'authenticated',
        role: 'authenticated',
        exp: now + 3600,
        iat: now,
      }),
    ).toString('base64url') +
    '.sig';
  return {
    access_token: fakeJwt,
    refresh_token: 'fake-refresh-token-e2e',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    user: {
      id: '00000000-0000-0000-0000-000000000001',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'e2e-google@example.com',
      email_confirmed_at: new Date().toISOString(),
      app_metadata: { provider: 'google', providers: ['google'] },
      user_metadata: { full_name: 'E2E Google User' },
      identities: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  };
}

test.describe('@smoke Google OAuth — wiring até /auth/callback', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.fixme("clique em 'Continuar com Google' dispara authorize com provider=google", async ({
    page,
  }) => {
    // Captura a URL para onde o botão tenta navegar e aborta antes de bater no
    // Google real — assim o spec roda offline e sem efeitos colaterais.
    const authorizeUrls: string[] = [];
    await page.route(AUTHORIZE_GLOB, async (route) => {
      authorizeUrls.push(route.request().url());
      await route.abort();
    });

    await gotoAndSettle(page, '/login');
    await expectVisibleByTestId(page, 'social-login-google');

    // O click provoca navegação top-level via window.location — aguardamos via
    // waitForRequest na rota de authorize.
    const waitForAuthorize = page.waitForRequest(AUTHORIZE_GLOB, { timeout: 10_000 });
    await page.locator('[data-testid="social-login-google"]').click();
    const req = await waitForAuthorize;

    const url = new URL(req.url());
    expect(url.pathname).toBe('/auth/v1/authorize');
    expect(url.searchParams.get('provider')).toBe('google');
    // redirect_to deve apontar para /auth/callback no preview
    const redirectTo = url.searchParams.get('redirect_to') ?? '';
    expect(redirectTo).toMatch(/\/auth\/callback/);

    expect(authorizeUrls).toHaveLength(1);
  });

  test.fixme('/auth/callback com code válido troca por sessão e autentica usuário', async ({
    page,
  }) => {
    const session = fakeSessionPayload();

    // 1. Mocka a troca code → token (PKCE exchange).
    await page.route(TOKEN_GLOB, async (route) => {
      const url = new URL(route.request().url());
      // grant_type=pkce|authorization_code → devolve sessão completa
      if (
        url.searchParams.get('grant_type') === 'pkce' ||
        url.searchParams.get('grant_type') === 'authorization_code'
      ) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(session),
        });
        return;
      }
      // refresh_token (caso o cliente faça refresh logo após login)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(session),
      });
    });

    // 2. Mocka /auth/v1/user (chamado pelo refreshSession do AuthContext).
    await page.route(USER_GLOB, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(session.user),
      });
    });

    // 3. Visita o callback com um code fake (PKCE).
    //    O SSOCallbackPage detecta `?code=` e chama exchangeCodeForSession,
    //    que cai no nosso mock acima.
    await page.goto('/auth/callback?code=e2e-mock-code', { waitUntil: 'domcontentloaded' });

    // 4. Verifica que a UI passou pelos estados sem cair em "failed".
    await expectVisibleByTestId(page, 'sso-callback-title', { timeout: 8_000 });
    const container = page.locator('[role="status"][data-status]');
    await expect(container).toBeVisible();

    // Não deve ter mostrado o hint de erro detalhado.
    await expect(page.locator('[data-testid="sso-callback-hint"]')).toHaveCount(0);

    // 5. Aguarda o redirect final — o callback navega para "/" após CONFIRMED_HOLD_MS.
    //    Aceita qualquer rota interna que NÃO seja /login ou /auth (== usuário autenticado).
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 10_000 })
      .not.toMatch(/^\/(auth|login)/);
  });

  test('/auth/callback com ?error= mostra hint detalhado e código do erro', async ({ page }) => {
    // Cenário de regressão: provider retornou erro de configuração.
    // Deve renderizar o bloco "Como resolver" do explainer.
    await page.goto(
      '/auth/callback?error=provider_not_enabled&error_description=Provider%20is%20not%20enabled',
      { waitUntil: 'domcontentloaded' },
    );

    // O callback redireciona para /login com detalhes; o Auth consome a query,
    // renderiza o banner de fallback e depois limpa a URL.
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 8_000 }).toBe('/login');

    await expect(page.getByTestId('social-login-error-title')).toBeVisible();
    await expect(page.getByTestId('social-login-error-code')).toContainText('provider_not_enabled');
    await expect(page.getByTestId('social-login-error-hint')).toContainText(/Administrador|admin/i);
  });
});
