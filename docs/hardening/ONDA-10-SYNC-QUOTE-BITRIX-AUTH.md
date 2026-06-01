# Onda 10 — sync-quote-bitrix auth hardening (B-2 encerrada)

> **🔄 ATUALIZACAO 2026-05-30 (ONDA-16):** O bloqueio descrito abaixo em
> *"Por que `authorize(req)` sem `requireRole`"* — o `ROLE_RANK['vendedor']`
> retornando `undefined` (NaN instavel) — **foi resolvido**. O `_shared/authorize.ts`
> agora conhece `vendedor` (rank 1) e `admin` (rank 2), e usa `rankOf()` que
> trata role desconhecida como 0. Portanto **`requireRole: 'vendedor'` ja e
> seguro** nesta edge e pode ser reativado para defesa-em-profundidade
> (restringe a chamada a usuarios internos, nao apenas "qualquer autenticado").
> Modelo de roles canonico: ver `docs/hardening/ONDA-16-ROLE-MODEL-AGENTE-VENDEDOR.md`.
> A tabela de roles abaixo (que listava `agente`/`supervisor` como "novas" com 0
> usuarios) esta historicamente desatualizada: as roles reais sao
> `vendedor`/`admin`/`dev`; `agente`/`supervisor` sao apenas aliases no codigo.

**Data:** 14 de maio de 2026  
**PR alvo:** cleanup/onda-10-sync-quote-bitrix-auth  
**Bloqueador resolvido:** B-2 da auditoria de 10/mai/2026 (ÚLTIMO BLOQUEADOR B-* PRÉ-PROD)  
**Tempo de execução:** ~45 minutos  
**Risco:** baixo (frontend já manda Authorization header, não precisa mudar)

## Contexto

A edge function `sync-quote-bitrix` envia orçamentos do PromoGifts para o CRM Bitrix24 via webhook n8n. Antes do fix, qualquer pessoa com acesso ao bundle JavaScript do frontend podia chamar este endpoint e poluir o CRM com deals falsos.

## O problema (B-2 da auditoria)

### Vetor de ataque

A edge não tinha entrada em `supabase/config.toml`, então herdava `verify_jwt = true` (default Supabase). **Mas isso só verifica que existe UM JWT válido — e o anon key do Supabase É um JWT válido.**

O `VITE_SUPABASE_PUBLISHABLE_KEY` está embutido no bundle do frontend (é obrigatório pro client funcionar). Portanto:

```bash
# Atacante abre DevTools, copia o anon key e:
curl -X POST https://<proj>.supabase.co/functions/v1/sync-quote-bitrix \
  -H "Authorization: Bearer <anon_key_publico>" \
  -H "Content-Type: application/json" \
  -d '{
    "sellerEmail": "comercial01@promobrindes.com.br",
    "bitrixCompanyId": "125240",
    "quote": { ... lixo ... },
    "proposalData": { "items": [{ "bitrix_product_id": 999, ... }] }
  }'
```

Resultado: deal falso criado no Bitrix atribuído ao vendedor `comercial01`. 

### Cenários de impacto

1. **Poluição do CRM:** flood de deals falsos atribuídos a vendedores reais
2. **Data poisoning competitivo:** concorrente cria entradas com nomes de empresas reais pra confundir analytics
3. **Vazamento da matriz vendedor→id Bitrix:** a constante `SELLER_EMAIL_MAP` está no source code do repo público — 7 emails reais + IDs Bitrix expostos
4. **SSRF parcial via `pdfUrl`:** se backend baixar o PDF (atualmente só repassa pro n8n, mas é risco se mudar)

## A solução

### Mudanças no `index.ts`

```diff
 import { getCorsHeaders } from '../_shared/cors.ts';
 import { z } from '../_shared/zod-validate.ts';
 import { fetchWithBreaker, CircuitOpenError, circuitOpenResponse } from '../_shared/external-fetch.ts';
+import { authorize } from '../_shared/authorize.ts';

 Deno.serve(async (req) => {
   const corsHeaders = getCorsHeaders(req);
   if (req.method === "OPTIONS") { ... }

   try {
+    // Onda 10 (B-2): hardening de auth
+    const auth = await authorize(req);
+    if (!auth.ok) return auth.response;
+    const authenticatedEmail = auth.user.email ?? null;

     let rawBody: unknown;
     try { rawBody = await req.json(); } catch { ... }

     const {
       quote, proposalData, pdfUrl, filename, bitrixCompanyId,
       shippingType, shippingCost,
-      sellerEmail,  // do body (não confiável)
     } = parsed.data;

     // ── 2. Resolve seller_id ──
+    // Onda 10: usa email AUTENTICADO, não do body
+    const sellerEmail = authenticatedEmail;
     const sellerId = sellerEmail ? SELLER_EMAIL_MAP[sellerEmail] : undefined;
```

### Por que `authorize(req)` sem `requireRole`

O helper `_shared/authorize.ts` (modelo SSOT usado por `bitrix-sync`, `cors-audit`) reconhece apenas roles novas: `agente`, `supervisor`, `dev`.

Mas o banco hoje tem roles **legadas** coexistindo:

| Role | Quantos |
|---|---|
| `dev` | 1 |
| `admin` (legado) | 2 |
| `vendedor` (legado) | 5 |
| `agente` (nova) | 0 |
| `supervisor` (nova) | 0 |

Se eu passasse `requireRole: 'agente'`, o helper compararia `ROLE_RANK['vendedor']` (undefined) com `ROLE_RANK['agente']` (1) — comportamento NaN instável. Para não depender disso e não quebrar vendedores reais, omiti `requireRole`.

> **Nota (ONDA-16, 2026-05-30):** este paragrafo descreve o estado de 14/mai.
> O NaN foi corrigido — ver callout no topo. Hoje `requireRole: 'vendedor'` e
> deterministico e seguro.

**Mas isso ainda resolve B-2** porque `authorize()` chama `supabase.auth.getUser(token)` que retorna `null` para anon key (o anon key não representa um usuário real). Portanto:

- ✅ Anon (anon key do bundle) → 401 `invalid_token`
- ✅ JWT válido de vendedor real → passa, `sellerEmail` = email do token
- ✅ Atacante não pode mais forjar `sellerEmail` no body

Quando o tema "dual admin pattern" for resolvido (memória do PO sobre PR-A da fase F2), reativar `requireRole: 'agente'`.

## Escopo intencionalmente limitado

| Item | Onda 10 | Future Work |
|---|---|---|
| Auth (B-2 principal) | ✅ Resolvido | — |
| `sellerEmail` derivado do JWT | ✅ Resolvido | — |
| `SELLER_EMAIL_MAP` mover pra tabela | ⏸ Defer | Onda futura |
| SSRF allowlist em `pdfUrl` | ⏸ Defer | B-7 trata `generate-mockup`; aqui pdfUrl só repassa pro n8n |
| Rate limit | ⏸ Defer | Tem `fetchWithBreaker` (circuit breaker no upstream) |

## Compatibilidade com frontend

Os 2 callers do frontend (`QuoteBitrixSync.ts`, `QuoteActionHandlers.ts`) **não precisam mudar**. Eles usam `supabase.functions.invoke("sync-quote-bitrix", { body: {...} })` que **já inclui** o `Authorization: Bearer <jwt_do_usuario>` header automaticamente via SDK.

O campo `sellerEmail` no body continua sendo enviado pelo frontend (compat retroativa), mas é ignorado pelo backend. Em Onda futura podemos remover do frontend também.

## Validação

### Testes manuais pós-deploy

```bash
# 1. Teste anon (deve dar 401)
curl -X POST https://<proj>.supabase.co/functions/v1/sync-quote-bitrix \
  -H "Authorization: Bearer <anon_key>" \
  -H "Content-Type: application/json" \
  -d '{}'
# Esperado: 401 {"error":"invalid_token"}

# 2. Teste com JWT válido (vendedor real)
# Esperado: 200/500 (depende do payload, mas passa pelo authorize)

# 3. Teste sem header Authorization
curl -X POST https://<proj>.supabase.co/functions/v1/sync-quote-bitrix \
  -H "Content-Type: application/json" \
  -d '{}'
# Esperado: 401 {"error":"missing_authorization"}
```

## Deploy

Mudança está em `supabase/functions/sync-quote-bitrix/index.ts`. Workflow `deploy-edge-functions.yml` detecta mudança em `supabase/functions/**` e redeploya automaticamente ao mergear em main.

## Rollback

Reverter via Git:
```bash
git revert <merge_commit_sha>
```

Vai voltar o estado vulnerável. **Não recomendado** — reabre B-2.

## Próximos passos

Com B-2 encerrada, **8 dos 9 bloqueadores B-* da auditoria estão resolvidos**:

| Bloqueador | Status |
|---|---|
| B-1 Erros silenciosos | ✅ Ondas 4+5 |
| B-2 sync-quote-bitrix sem auth | ✅ **Onda 10** |
| B-3 RLS overly-permissive | ✅ Onda 8 |
| B-4 Discount NULL bypass | ✅ Onda 7 |
| B-5 Hook órfão | ✅ Sessão anterior |
| B-7 AI quota fail-open | ✅ Onda 6 |
| B-8 Public token tables | ✅ Onda 9 |
| B-9 quote-public-view stub | ✅ Onda 3 |
| **B-6 login rate-limit client-side** | ⏳ Onda 13 |

Onda 11 (E2E baseURL) e 12 (npm audit) são hardening adicional não-bloqueante. Onda 13 fecha B-6, mas é conhecida como não-bloqueante absoluto (Supabase Auth tem rate limit nativo por IP).
