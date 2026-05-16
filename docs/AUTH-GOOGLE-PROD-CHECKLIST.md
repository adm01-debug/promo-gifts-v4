# Checklist — Validação do Login com Google em Produção

> Execute **em ordem**. Só libere o app quando **todos os itens estiverem ✅**.
> Tempo estimado: 10–15 min. Pré-requisito: app publicado (`*.lovable.app` ou domínio custom ativo).

---

## 0. Pré-voo (1 min)

- [ ] App **publicado** (botão "Publish" → status `Active`).
- [ ] URL pública anotada: `https://_______________________________` (chamada de `APP_URL` abaixo).
- [ ] Domínio custom (se houver) em status **Active** em Project Settings → Domains.
- [ ] Projeto Supabase ativo (Dashboard → Project Settings → Status = Active).

---

## 1. Configuração do Provider (Supabase Dashboard)

Supabase Dashboard → **Authentication** → **Providers** → **Google**.

- [ ] Provider **Google** está **Enabled** (toggle ligado).
- [ ] Campo `Client ID` preenchido (formato `XXXX-XXXX.apps.googleusercontent.com`).
- [ ] Campo `Client Secret (for OAuth)` preenchido (não vazio, não placeholder).
- [ ] Anote a **Callback URL** mostrada pelo painel:
      `https://_______________.supabase.co/auth/v1/callback` → chame de `CALLBACK_URL`.

---

## 2. Configuração no Google Cloud Console

Em https://console.cloud.google.com → projeto correto.

### 2.1 OAuth Consent Screen
- [ ] Status **Published / In production** (não "Testing", senão só usuários da allowlist entram).
- [ ] **Authorized domains** contém:
  - [ ] `lovable.app` (cobre `*.lovable.app`)
  - [ ] Seu domínio custom raiz, se houver (ex: `meuapp.com.br`)
- [ ] Scopes habilitados: `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`.

### 2.2 OAuth Client ID (Credentials → Web application)
- [ ] **Authorized JavaScript origins** contém **cada** uma das URLs do app:
  - [ ] `https://<projeto>.lovable.app`
  - [ ] `https://<dominio-custom>` (se houver)
  - [ ] `https://www.<dominio-custom>` (se cadastrado)
- [ ] **Authorized redirect URIs** contém **exatamente** o `CALLBACK_URL` do passo 1 (copy/paste, sem barra extra no final).

> ⚠️ Erro mais comum: `redirect_uri_mismatch`. Causa quase sempre = string do redirect URI diferente por 1 char (http vs https, barra final, subdomínio errado).

---

## 3. Teste funcional no browser (modo anônimo)

Use **janela anônima** (sem sessão prévia do Google).

### 3.1 Fluxo feliz
1. [ ] Abra `APP_URL/login`.
2. [ ] Clique em **Continuar com Google**.
3. [ ] É redirecionado para `accounts.google.com/o/oauth2/...` (não fica em loop em `/login`).
4. [ ] Selecione uma conta Google → autoriza.
5. [ ] Volta para `APP_URL/auth/callback` e em seguida cai em `/` (ou na última página).
6. [ ] Header mostra o usuário logado; menu "Sair" funciona.

### 3.2 Fluxo de cancelamento
1. [ ] Repita o passo 1–3.
2. [ ] Na tela do Google, clique em **Cancelar**.
3. [ ] Volta para `APP_URL/login` com banner amarelo:
       - Título: **Login cancelado**
       - Descrição amigável + dica.
       - URL **não contém mais** `?error=…` (foi limpo).

### 3.3 Deep-link preservado
1. [ ] Cole `APP_URL/produtos` na barra (anônimo).
2. [ ] Você é redirecionado para `/login`.
3. [ ] Logue com Google.
4. [ ] É enviado **direto para `/produtos`**, não para `/`.

### 3.4 Logout
1. [ ] Estando logado, abra o menu do usuário → **Sair**.
2. [ ] Cai em `/login`. Tentar voltar com botão "back" do navegador **não** restaura a sessão.

---

## 4. Validação de segurança (browser DevTools)

Com DevTools aberto **durante** o passo 3.1:

- [ ] **Network**: a chamada para `/auth/v1/callback` retorna **302** (não 4xx/5xx).
- [ ] **Network**: a chamada subsequente para `/auth/v1/user` retorna **200** com `email` correto.
- [ ] **Console**: sem erro vermelho relacionado a `auth`, `oauth`, `cors`, `csp` ou `state`.
- [ ] **Application → Cookies**: existe cookie `sb-*-auth-token` para o domínio do app.
- [ ] **Application → Storage**: nada sensível em `localStorage` além do esperado (`sb-*`).

---

## 5. Multi-dispositivo / multi-navegador

Replique **apenas o passo 3.1** em:

- [ ] **Chrome** desktop
- [ ] **Safari** desktop (cookies de terceiros têm regras mais estritas)
- [ ] **Firefox** desktop
- [ ] **Safari iOS** (mobile real, não simulador)
- [ ] **Chrome Android**
- [ ] **PWA instalado** (se aplicável) — abrir como app standalone e logar.

---

## 6. Casos de erro que devem mostrar mensagem amigável

Force cada um e confirme o banner em `/login`:

| Como forçar | Banner esperado |
|---|---|
| Cancelar na tela do Google | **Login cancelado** |
| Bloquear pop-up no navegador e clicar Google | **Pop-up bloqueado** |
| Editar URL manualmente: `APP_URL/login?error=redirect_uri_mismatch` | **URL de retorno não autorizada** (+ aviso "problema de configuração") |
| `APP_URL/login?error=admin_policy_enforced` | **Bloqueado pela política da sua organização** |
| `APP_URL/login?error=server_error` | **O Google está instável** |
| `APP_URL/login?error=xyz_desconhecido` | Fallback "Falha no login com Google" mostrando o texto bruto |

- [ ] Todos os 6 cenários acima exibem o banner correto e **limpam o `?error=` da URL** após render.

---

## 7. Telemetria / logs (pós-teste)

- [ ] Cloud → **Edge Functions** → logs sem `auth` / `oauth` em nível `error` nos últimos 15 min.
- [ ] `/admin/telemetria` → **Saúde da Aplicação** → janela 15 min: %5xx em rotas `/auth/*` = **0**.
- [ ] Nenhum alerta novo no Sentry (se configurado).

---

## 8. Go / No-Go

Libere o app **somente se**:

- [ ] Todos os blocos 0–6 marcados.
- [ ] Bloco 7 sem regressões.
- [ ] 2 pessoas diferentes conseguiram logar com Google em **contas distintas** (não só você).

Se qualquer item falhar, **NÃO publique** — registre em `docs/INCIDENTS/` com:
- Print do erro
- URL exata onde quebrou
- `X-Request-Id` da resposta (header)
- Trecho do log da edge function correspondente

---

### Apêndice — Mapa rápido de erros OAuth

| `?error=` na URL | Causa raiz provável | Onde corrigir |
|---|---|---|
| `redirect_uri_mismatch` | Redirect URI fora do Google Cloud | Google Cloud → Credentials |
| `invalid_client` | Client ID/Secret errados ou trocados | Supabase Dashboard → Authentication → Providers → Google |
| `access_denied` | Usuário cancelou | Nada — fluxo esperado |
| `admin_policy_enforced` | Workspace do user bloqueia o app | Admin do Google Workspace dele |
| `org_internal` | App restrito a uma org no Consent Screen | Google Cloud → OAuth Consent |
| `server_error` / `temporarily_unavailable` | Instabilidade Google | Aguardar; usar e-mail/senha |
| `state_mismatch` / `bad_oauth_state` | Aba ficou aberta > 10 min | Reiniciar fluxo |
| `signup_disabled` | Plataforma fechada (esperado aqui) | Provisionar usuário manualmente |
