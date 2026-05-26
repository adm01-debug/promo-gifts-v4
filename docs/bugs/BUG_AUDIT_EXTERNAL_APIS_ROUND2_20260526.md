# 🔍 Auditoria Exaustiva Round 2 — APIs Externas

**Data:** 26/05/2026  
**PR Round 1:** #429 (7 bugs)  
**Este PR:** #2 de auditoria da sessão

---

## Bugs Encontrados na Segunda Varredura

### BUG-008 🔴 CRÍTICO — `ai-recommendations`: mesmo type mismatch do BUG-001

**Arquivo:** `supabase/functions/ai-recommendations/index.ts`  
**Status:** ✅ CORRIGIDO

Mesmo padrão do BUG-001 (elevenlabs-tts): `resolveCredential()` retorna `CredentialResolution` (objeto), não string. O check `if (!HF_API_KEY)` nunca disparava, e o header `Authorization: Bearer [object Object]` era enviado para o HuggingFace → **100% das solicitações de recomendação de IA falhavam com 401**.

**Fix:** `const { value: HF_API_KEY } = await resolveCredential('HUGGINGFACE_API_KEY');`

---

### BUG-009 🟠 ALTO — `bi-copilot`: leitura de credencial em escopo de módulo

**Arquivo:** `supabase/functions/bi-copilot/index.ts`  
**Status:** ✅ CORRIGIDO

`const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')` na linha 18 estava em **escopo de módulo** (fora do handler). Isso significa:
- A chave era lida UMA vez no cold start e mantida pelo lifetime do isolate
- Rotações via `/admin/conexoes` não surtiam efeito até o isolate ser recriado
- Se a variável não estivesse setada no boot, TODOS os requests falhavam até o próximo restart

**Fix:** Movida para dentro do handler com `resolveCredential()` (DB-first SSOT + suporte a rotação em tempo real).

---

### BUG-010 🟠 ALTO — `quote-sync`: URL N8N em escopo de módulo + SDK version drift

**Arquivo:** `supabase/functions/quote-sync/index.ts`  
**Status:** ✅ CORRIGIDO

Dois problemas:
1. `const n8nWebhookUrl = Deno.env.get("N8N_QUOTE_WEBHOOK_URL");` em escopo de módulo — mesmo padrão do BUG-009. URL configurada via DB nunca era encontrada.
2. SDK `npm:@supabase/supabase-js@2.49.1` em vez do padrão `@2.49.4` de todas as outras functions.
3. `SALESPRO_WEBHOOK_URL` e `QUOTE_SYNC_API_KEY` via `Deno.env.get()` em `sendToSalesPro()` — bypassam SSOT.

**Fixes:**
- SDK alinhado para `@2.49.4`
- `n8nWebhookUrl` resolvido dentro de `sendToN8N()` via `resolveCredential()`
- `SALESPRO_WEBHOOK_URL` e `QUOTE_SYNC_API_KEY` migrados para `resolveCredential()`

---

### BUG-011 🟡 MÉDIO — `expert-chat`: aliases legados `EXTERNAL_SUPABASE_URL` bypassam SSOT

**Arquivo:** `supabase/functions/expert-chat/index.ts` (linhas 1140, 1141, 1439, 1440)  
**Status:** ✅ CORRIGIDO

Duas rotas dentro do expert-chat usavam:
```typescript
const EXT_URL = Deno.env.get('EXTERNAL_SUPABASE_URL');
const EXT_KEY = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_KEY');
```

Enquanto as outras rotas do mesmo arquivo já usavam `resolveCredential('EXTERNAL_PROMOBRIND_URL')`. Inconsistência: se a credencial estiver no banco, as rotas legadas falham enquanto as outras funcionam normalmente.

**Fix:** Migrado para `resolveCredential()` com os aliases canonínicos (`EXTERNAL_PROMOBRIND_URL`, `EXTERNAL_PROMOBRIND_SERVICE_ROLE_KEY`).

---

## Não-Problemas (falsos positivos investigados)

| Item | Conclusão |
|---|---|
| `LOVABLE_API_KEY` via `Deno.env.get` em 10+ funções (analyze-logo, compare-ai, etc.) | ✅ Intencional — chave gerenciada pela plataforma Lovable, não pelo usuário |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` via `Deno.env.get` | ✅ Correto — são segredos de plataforma sempre injetados pelo runtime Deno/Supabase |
| `image-proxy` usa `Deno.env.get('IMAGE_PROXY_MAX_BYTES')` | ✅ Flag de configuração operacional, não credencial de API |

---

## Métricas da Auditoria (Round 2)

- **Funções adicionais analisadas:** 15
- **Novos bugs encontrados:** 4 (1 crítico, 2 altos, 1 médio)
- **Total acumulado (Round 1 + 2):** 11 bugs corrigidos
