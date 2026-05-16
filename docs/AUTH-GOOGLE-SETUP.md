# Login com Google — Ativação

O front-end já está pronto (`SocialLoginButtons` em `src/pages/Auth.tsx`) e usa `supabase.auth.signInWithOAuth({ provider: 'google' })` direto no **Supabase externo de Gestão de Produtos** (SSOT). Para o botão funcionar em produção, é preciso habilitar o provider Google nesse Supabase externo.

## 1. Google Cloud Console

1. Acesse https://console.cloud.google.com/ → crie/escolha um projeto.
2. **APIs & Services → OAuth consent screen**
   - User type: **External**
   - App name, support email, developer contact
   - Authorized domains: adicione o domínio do app em produção e `supabase.co`
   - Scopes: `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - **Authorized JavaScript origins:**
     - `https://<seu-dominio-prod>`
     - `http://localhost:5173` (dev opcional)
   - **Authorized redirect URIs:**
     - `https://<REF-DO-SUPABASE-EXTERNO>.supabase.co/auth/v1/callback`
       (pegue o ref no dashboard do Supabase externo → Project Settings → General)
4. Copie **Client ID** e **Client Secret**.

## 2. Supabase externo (Gestão de Produtos)

1. Dashboard do Supabase externo → **Authentication → Providers → Google**
2. Ative o toggle, cole **Client ID** e **Client Secret**, salve.
3. **Authentication → URL Configuration**
   - **Site URL:** `https://<seu-dominio-prod>`
   - **Redirect URLs (allow list):** adicione todas as URLs que podem receber o callback:
     - `https://<seu-dominio-prod>/auth/callback`
     - `http://localhost:5173/auth/callback`
     - URLs de preview Lovable se for testar lá: `https://*.lovable.app/auth/callback`

## 3. Checklist de validação

- [ ] Click em "Continuar com Google" abre a tela de consentimento do Google.
- [ ] Após consentir, retorna para `/auth/callback` autenticado.
- [ ] Sessão persiste (refresh da página mantém logado).
- [ ] `auth.users` no Supabase externo registra o novo usuário com `provider = google`.

## Troubleshooting

- **`redirect_uri_mismatch`** → a URI cadastrada no Google Cloud não bate exatamente com `https://<ref>.supabase.co/auth/v1/callback`. Confira protocolo, ref e barra final.
- **Retorna para login sem sessão** → a URL final (`/auth/callback`) não está na allow list do Supabase. Adicione em URL Configuration.
- **`Unsupported provider`** → Google não foi ativado em Authentication → Providers no Supabase externo.

## Onde NÃO mexer

- Não usar Lovable Cloud para isso — o projeto é SSOT no Supabase externo.
- Não usar `@lovable.dev/cloud-auth-js`. O fluxo é Supabase Auth nativo.
- Não duplicar usuários no Supabase CRM. Auth é exclusiva do externo de Gestão de Produtos.
