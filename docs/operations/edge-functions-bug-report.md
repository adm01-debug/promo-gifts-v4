# Edge Functions — Bug Report & Audit

> **Gerado em:** 26/05/2026  
> **Escopo:** 80 Edge Functions + 15 arquivos `_shared`  
> **Metodo:** Analise estatica automatizada + inspecao manual de funcoes criticas

---

## CRITICAL

### BUG-EF-001 · `verify-email` — API errada para verificacao de email

**Status:** CORRIGIDO em fix/edge-functions-audit-20260526

**Descricao:** A funcao chamava `supabase.auth.admin.getUserById(token)` onde `token` era o hash OTP do link de verificacao de email. Este metodo espera um UUID de usuario, nao um token de OTP. A funcao retornava erro 400 em 100% dos casos — nenhum usuario conseguia verificar email via link.

**Correcao:** Substituido por `supabase.auth.verifyOtp({ token_hash, type })`, que e a API correta.

---

## HIGH

### BUG-EF-002 · `bulk-random-passwords` — Timing attack na autenticacao do token admin

**Status:** CORRIGIDO

**Descricao:** `adminTokenHeader !== expectedAdminToken` — comparacao direta de strings. Permite a um atacante medir o tempo de resposta para descobrir bytes do token via timing oracle.

**Correcao:** `timingSafeEqual()` via TextEncoder + XOR byte-a-byte.

---

### BUG-EF-003 · `send-notification` — Double OPTIONS handler (CORS preflight quebrado)

**Status:** CORRIGIDO

**Descricao:** Dois handlers `if (req.method === "OPTIONS")` no mesmo Deno.serve:
- Linha 26: `return new Response(null, { status: 204 })` sem headers CORS, executa primeiro
- Linha 31: `return new Response('ok', { headers: corsHeaders })` — nunca alcancado

**Efeito:** Browser recebia 204 sem Access-Control-Allow-Origin, bloqueando toda chamada subsequente.

---

### BUG-EF-004 · `sync-external-db` — Versao supabase-js nao pinada

**Status:** CORRIGIDO

**Descricao:** `import from "https://esm.sh/@supabase/supabase-js@2"` sem versao fixa.

---

### BUG-EF-005 · `sync-external-db` — Endpoint destrutivo sem autenticacao

**Status:** CORRIGIDO

**Descricao:** Endpoint que faz upsert de ate 1000 registros em qualquer tabela nao tinha nenhuma autenticacao.

**Correcao:** `authorizeCron` — apenas pg_cron com CRON_SECRET pode invocar.

---

### BUG-EF-006 · `e2e-cleanup` — supabase-js@2.45.0 (obsoleto)

**Status:** CORRIGIDO -> @2.49.4

---

### BUG-EF-007 · `quote-followup-reminders` — supabase-js@2.45.0 (obsoleto)

**Status:** CORRIGIDO -> @2.49.4

---

### BUG-EF-008 · `mcp-keys-issue`, `rls-audit`, `generate-mockup` — supabase-js@2.95.0 (versao inexistente)

**Status:** IDENTIFICADO — Pendente PR separado

**Descricao:** `@2.95.0` nao existe no npm. Provavel typo de `@2.49.4` -> `@2.95.0`.
Deno runtime pode resolver para versao mais proxima ou falhar no cold-start.

**Acao necessaria:** Alterar as tres funcoes para `@2.49.4`.

---

## MEDIUM

### BUG-EF-009 · `quote-sync` — supabase-js@2.49.1 (divergente)

**Status:** Identificado — para correcao em proximo PR

**Correcao:** Atualizar para `@2.49.4`.

---

### BUG-EF-010 · `bulk-random-passwords` — supabase-js@2.49.8 (versao futura/typo)

**Status:** CORRIGIDO -> @2.49.4

---

### BUG-EF-011 · `verify-email` — Import Zod via `deno.land/x` em vez de `npm:`

**Status:** CORRIGIDO -> `npm:zod@3.23.8`

---

### BUG-EF-012 · `sync-external-db` — console.log vaza nome de tabela em logs publicos

**Status:** CORRIGIDO — substituido por `createStructuredLogger`

---

## LOW / Backlog

### BUG-EF-013 · `categories-api` — Ainda usa EXTERNAL_SUPABASE_URL (Caminho A)

**Status:** Aguardando decisao de migracao para Caminho B (F2-F5 pendentes)

---

### BUG-EF-014 · Multiplas funcoes — `Deno.env.get(...)!` sem try/catch no escopo de modulo

**Funcoes afetadas:** bitrix-sync, block-ip, crm-db-bridge, detect-new-device, e2e-cleanup,
force-global-logout, log-login-attempt, manage-users, mcp-keys-issue, mcp-server,
product-webhook, quote-followup-reminders, quote-sync, rate-limiter, rls-audit,
secrets-manager, security, step-up-verify, sync-external-db, validate-access,
verify-email, webhook-inbound

**Risco:** Se env var obrigatoria nao estiver configurada, TypeError no cold-start.
**Acao:** Criar helper `requireEnv(name)` e aplicar progressivamente.

---

### BUG-EF-015 · `quote-sync` — Sem transacao explicita em updates concorrentes

**Status:** Risco LOW com volume atual
**Acao:** Avaliar RPC transacional ou advisory lock.

---

## Resumo da Auditoria

| Categoria | Total | Corrigidos | Pendentes |
|---|---|---|---|
| CRITICAL | 1 | 1 | 0 |
| HIGH | 7 | 6 | 1 (BUG-EF-008) |
| MEDIUM | 4 | 3 | 1 |
| LOW | 3 | 0 | 3 |
| **Total** | **15** | **10** | **5** |

---

## Arquivos Modificados no PR fix/edge-functions-audit-20260526

| Arquivo | Bugs Corrigidos |
|---|---|
| `supabase/functions/verify-email/index.ts` | BUG-EF-001, BUG-EF-011 |
| `supabase/functions/bulk-random-passwords/index.ts` | BUG-EF-002, BUG-EF-010 |
| `supabase/functions/send-notification/index.ts` | BUG-EF-003 |
| `supabase/functions/sync-external-db/index.ts` | BUG-EF-004, BUG-EF-005, BUG-EF-012 |
| `supabase/functions/e2e-cleanup/index.ts` | BUG-EF-006 |
| `supabase/functions/quote-followup-reminders/index.ts` | BUG-EF-007 |

---

*Documento gerado por Claude (Abner/TIPROMO) em 26/05/2026.*
