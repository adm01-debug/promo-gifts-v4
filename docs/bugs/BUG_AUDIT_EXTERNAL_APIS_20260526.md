# 🔍 Auditoria Exaustiva — APIs Externas

**Data:** 26/05/2026  
**Executor:** Agente IA — Gestão por Processos / Claude Sonnet 4.6  
**Escopo:** Todas as edge functions e utilitários que se comunicam com APIs externas

---

## Metodologia

1. Mapeamento completo da árvore de arquivos do repositório
2. Leitura de todos os arquivos de integração externa identificados
3. Análise de padrões de: autenticação, tratamento de erros, versionamento de dependências, consistência de credenciais
4. Cruzamento com o sistema SSOT de credenciais (`_shared/credentials.ts`)
5. Validação dos contratos cliente↔servidor (edge function ↔ `src/utils/`)

---

## APIs Externas Auditadas

| API | Edge Function(s) | Utilitário Frontend |
|---|---|---|
| ElevenLabs TTS | `elevenlabs-tts` | `hooks/voice/playTtsAudio.ts` |
| ElevenLabs Scribe | `elevenlabs-scribe-token` | `hooks/voice/scribeTokenCache.ts` |
| CNPJ.á | `cnpj-lookup` | `utils/cnpj-lookup.ts` |
| ViaCEP | — | `utils/viacep.ts` |
| Bitrix24 | `bitrix-sync`, `sync-quote-bitrix` | `pages/quotes/quote-view/QuoteBitrixSync.ts` |
| Dropbox | `dropbox-list` | `hooks/intelligence/useDropboxFiles.ts` |
| AI (Gemini/OpenAI) | `generate-mockup`, `generate-ad-image` | `hooks/mockup/` |
| Supabase CRM Externo | `crm-db-bridge` | `lib/crm-db.ts` |
| Supabase PromobrIND | `external-db-bridge` | `lib/external-db/` |

---

## Bugs Encontrados

### BUG-001 🔴 CRÍTICO — `elevenlabs-tts`: `resolveCredential` retorna objeto, não string

**Arquivo:** `supabase/functions/elevenlabs-tts/index.ts`  
**Linha original:** 48  
**Status:** ✅ CORRIGIDO

**Descrição:**  
A função `resolveCredential(name)` retorna `CredentialResolution` (objeto `{ value: string|null, source, resolved_name }`), **não** uma string. O código atribuía o objeto inteiro a `ELEVENLABS_API_KEY` e o passava diretamente como header HTTP.

**Impacto:**
- O check `if (!ELEVENLABS_API_KEY)` nunca dispara (objeto é sempre truthy)
- O header `xi-api-key` recebe a string `"[object Object]"` em vez da chave real
- **100% dos requests TTS falham com 401 Unauthorized na ElevenLabs API**
- Créditos NÃO são consumidos mas o recurso de TTS/voz está completamente inoperante

**Código problemático:**
```typescript
// ANTES (BUGADO)
const ELEVENLABS_API_KEY = await resolveCredential('ELEVENLABS_API_KEY');
// typeof === 'object' → sempre truthy
if (!ELEVENLABS_API_KEY) { /* nunca executa */ }
// ...
'xi-api-key': ELEVENLABS_API_KEY, // envia "[object Object]" → 401
```

**Fix aplicado:**
```typescript
// DEPOIS (CORRETO)
const { value: ELEVENLABS_API_KEY } = await resolveCredential('ELEVENLABS_API_KEY');
if (!ELEVENLABS_API_KEY) {
  throw new Error('ELEVENLABS_API_KEY is not configured');
}
// ...
'xi-api-key': ELEVENLABS_API_KEY, // envia o valor string correto
```

---

### BUG-002 🟠 ALTO — `elevenlabs-scribe-token`: Credential SSOT bypass

**Arquivo:** `supabase/functions/elevenlabs-scribe-token/index.ts`  
**Status:** ✅ CORRIGIDO

**Descrição:**  
Usava `Deno.env.get('ELEVENLABS_API_KEY')` diretamente, ignorando o sistema SSOT de credenciais (`_shared/credentials.ts`). O `elevenlabs-tts` (irmão) usa `resolveCredential` — inconsistência que cria comportamento imprevisível.

**Regra SSOT violada:**  
Todas as credenciais externas devem ser resolvidas via `resolveCredential()` (DB-first → env fallback). Se a chave estiver armazenada em `integration_credentials` (banco) mas não definida como env var do isolate, o endpoint falha silenciosamente.

---

### BUG-003 🟠 ALTO — `cnpj-lookup`: Formato do mock de teste incorreto

**Arquivo:** `supabase/functions/cnpj-lookup/index.ts`  
**Status:** ✅ CORRIGIDO

**Descrição:**  
O mock para CNPJ `00000000000191` (usado em testes/smoke) retornava formato raw da API CNPJá:
```json
{ "cnpj": "00000000000191", "name": "TEST COMPANY LTDA", "alias": "TEST MOCK", "status": "ACTIVE" }
```

Mas o cliente `fetchCnpjData` em `src/utils/cnpj-lookup.ts` verifica:
```typescript
if (!data?.success) { throw new Error(data?.error || 'Erro na consulta do CNPJ'); }
return data.data as CnpjData;
```

Resultado: `data.success` é `undefined` (falsy) → cliente lança erro em TODO cenário de teste.

**Fix:** Mock retorna formato padrão `{ success: true, data: { razao_social, nome_fantasia, cnpj, ... } }`.

---

### BUG-004 🟡 MÉDIO — `generate-mockup`: Versão SDK Supabase divergente

**Arquivo:** `supabase/functions/generate-mockup/index.ts`  
**Status:** ✅ CORRIGIDO

**Descrição:**  
Usava `@supabase/supabase-js@2.95.0` enquanto **todas** as outras edge functions usam `@2.49.4`.

**Impacto potencial:**
- Diferenças de comportamento em contextos de auth
- Divergências no tratamento de erros de RLS
- Cache de schema PostgREST pode se comportar diferente entre versões
- Maior superfície de bugs no cache do esm.sh para versões não padronizadas

---

### BUG-005 🟡 MÉDIO — `dropbox-list`: Credential SSOT bypass

**Arquivo:** `supabase/functions/dropbox-list/index.ts`  
**Status:** ✅ CORRIGIDO

**Descrição:**  
`Deno.env.get("DROPBOX_ACCESS_TOKEN")` bypassa o SSOT. Se o token estiver no banco (`integration_credentials`) mas não como env var, a integração com Dropbox falha com "não configurado" mesmo o token estando corretamente cadastrado via `/admin/conexoes`.

---

### BUG-006 🟡 MÉDIO — `sync-quote-bitrix`: N8N webhook URL sem SSOT

**Arquivo:** `supabase/functions/sync-quote-bitrix/index.ts`  
**Status:** ✅ CORRIGIDO

**Descrição:**  
`Deno.env.get("N8N_QUOTE_WEBHOOK_URL")` bypassa o SSOT. A URL do webhook n8n configurada via `/admin/conexoes` não é encontrada, levando a erro mesmo com a credencial ativa no banco.

---

### BUG-007 🔵 BAIXO — `viacep.ts`: Fetch sem timeout

**Arquivo:** `src/utils/viacep.ts`  
**Status:** ✅ CORRIGIDO

**Descrição:**  
Nenhum `AbortController` no fetch para a API ViaCEP. Se o serviço estiver lento ou indisponível, o request pendura indefinidamente bloqueando fluxos de UI que dependem de auto-preenchimento de endereço.

**Fix:** Timeout de 5 segundos via `AbortController`.

---

## Não-Problemas (falsos positivos investigados)

| Item | Conclusão |
|---|---|
| `cors.ts` — `promo-gifts-beta.vercel.app` não listado | ✅ OK — pattern `[a-z0-9-]+\.vercel\.app` já cobre |
| `bitrix-sync` — `getSupabaseClient()` com `!` | ✅ Aceitável — SUPABASE_URL/SERVICE_ROLE_KEY são sempre injetados pelo runtime Deno |
| `elevenlabs-tts` — voiceId não validado contra lista | ✅ Intencional por design (suporte a custom voices) |
| `crm-db-bridge` — singleton client | ✅ Pattern correto e documentado |
| `external-db-bridge` — versão SDK | ✅ Consistente em @2.49.4 |

---

## Métricas da Auditoria

- **Arquivos analisados:** 23 edge functions + 6 utilitários frontend
- **APIs externas cobertas:** 9
- **Bugs encontrados:** 7 (1 crítico, 2 altos, 3 médios, 1 baixo)
- **Bugs corrigidos:** 7 (100%)
- **Falsos positivos:** 5
