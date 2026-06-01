# Security Headers — Promo Gifts

> Bug P3-01 da auditoria 24/05/2026

## Source of truth

**Produção roda em Vercel** → `vercel.json` é a fonte autoritativa.

`public/_headers` existe para compatibilidade com builds Netlify/Cloudflare
Pages (preview deploys e fallback). Os dois arquivos devem ficar **alinhados**
sempre que houver mudança em headers.

## Headers ativos (validados em produção via `curl -I`)

### `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`

Forçar HTTPS por 1 ano em qualquer subdomínio (`*.promogifts.com.br`).
`preload` permite inclusão na [HSTS preload list](https://hstspreload.org/).

### `X-Content-Type-Options: nosniff`

Impede o browser de "adivinhar" o Content-Type. Mitiga ataques onde um
upload `.png` malicioso é servido com mime `image/png` mas o atacante
tenta forçar interpretação como `script/javascript`.

### `X-Frame-Options: DENY`

Página NÃO pode ser embeddable em `<iframe>` de outro origin. Anti-clickjacking.
Redundante com CSP `frame-ancestors 'none'` (mais novo) mas mantido para
compatibilidade com browsers legados.

### `Referrer-Policy: strict-origin-when-cross-origin`

Em navegação cross-origin, só envia a origin (não o path completo). Protege
contra vazamento de URLs internas em logs de terceiros.

### `Permissions-Policy: camera=(), microphone=(self), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()`

Bloqueia features sensíveis em iframes terceiros E exige permissão explícita
em mesmo-origem:

| Feature | Política | Razão |
|---|---|---|
| `camera=()` | Negado totalmente | Não usamos câmera |
| `microphone=(self)` | Só self | Voice commands (hooks/voice/*) — pode revisar pra `()` se feature descontinuada |
| `geolocation=()` | Negado | Não usamos GPS |
| `payment=()` | Negado | Não temos checkout direto (PIX/cartão é redirect) |
| `usb=()` | Negado | Não usamos WebUSB |
| `magnetometer=()`, `gyroscope=()`, `accelerometer=()` | Negado | Não usamos sensores de movimento |

### `Content-Security-Policy` (multilinha — fonte: `vercel.json`)

Defesa principal contra XSS:

- `default-src 'self'`: por padrão, só carrega de promogifts.com.br
- `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.gpteng.co https://vercel.live https://*.vercel.app`
  - `unsafe-inline` + `unsafe-eval` são necessários por React + Vite dev/prod
  - Whitelist: gpteng (Lovable dev tools), Vercel preview
- `connect-src` whitelist:
  - `*.supabase.co wss://*.supabase.co` (DB)
  - `*.ingest.sentry.io *.glitchtip.io` (error monitoring)
  - `*.elevenlabs.io wss://*.elevenlabs.io` (voice features)
  - `api.cnpja.com` (CNPJ lookup)
  - `*.bitrix24.com.br *.bitrix24.com` (CRM integration)
- `frame-ancestors 'none'`: ninguém pode embed esse site
- `object-src 'none'`: bloqueia `<object>` (Flash legacy)
- `upgrade-insecure-requests`: força HTTPS pra subrecursos

## Como atualizar headers

Quando precisar mudar QUALQUER header:

```bash
# 1. Edite os 2 arquivos juntos
$EDITOR vercel.json public/_headers

# 2. Valide localmente
npm run build && npx serve dist/  # check via curl -I

# 3. Após deploy, valide produção
curl -sI https://www.promogifts.com.br/ | grep -iE 'content-security|x-frame|permissions-policy'
```

## CI guard (futuro)

Sugestão: criar `scripts/check-security-headers.mjs` que:
1. Parse `vercel.json` e `public/_headers`
2. Falha CI se houver divergência entre eles
3. Falha CI se algum header essencial sumir

## Histórico de mudanças significativas

- **24/05/2026** (auditoria zero-bug): adicionou `magnetometer=()`,
  `gyroscope=()`, `accelerometer=()` no Permissions-Policy (vercel.json
  já tinha; alinhamento _headers pendente). Documentado em P3-01.
- **24/05/2026** (PR #294): mojibake fix afetou comentários no index.html
  mas não tocou em headers.
- **anterior**: CSP atualizada para incluir `*.elevenlabs.io` (voice
  features) e `*.bitrix24.com.br` (CRM).
