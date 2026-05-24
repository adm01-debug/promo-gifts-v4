# POP — Cadastro de secrets externos no Supabase

> **Procedimento Operacional Padrão** para cadastrar credenciais externas
> sem repetir o incidente de 2026-05-22 (`crm-db-bridge` com URL malformada
> — colaram a URL do Dashboard ao invés da URL da API).
>
> **Origem**: [`docs/incidents/2026-05-22-crm-db-bridge-url-malformada.md`](../incidents/2026-05-22-crm-db-bridge-url-malformada.md)
> **Issue**: `docs/issues-pendentes-2026-05-22.md` § Issue 1

---

## 1. Quando usar Edge Functions Secrets vs `integration_credentials`

| Cenário | Onde guardar | Por quê |
|---|---|---|
| Bootstrap, credenciais de infra do próprio Supabase (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) | **Edge Functions Secrets** (Deno.env) | Não podem viver no DB — usadas para abrir conexão com o próprio DB |
| Integrações externas (CRM, Bitrix24, n8n, ERP, transportadoras) | **`public.integration_credentials`** (DB-first via `resolveCredential`) | Permite rotação via SQL/MCP com auditoria + histórico, sem precisar do Dashboard |
| Webhooks de bots/apps internos | `integration_credentials` | Idem |
| API keys de terceiros (Stripe, SendGrid, OpenAI) | `integration_credentials` | Idem |

> **Regra de ouro**: se você consegue cadastrar via SQL, use `integration_credentials`. Use Edge Functions Secrets apenas para o que precisa estar disponível ANTES da conexão com o DB.

---

## 2. Convenções de nomenclatura

- **Prefixo `EXTERNAL_<TARGET>_`** para integrações externas (ex: `EXTERNAL_CRM_*`, `EXTERNAL_PROMOBRIND_*`)
- **Sufixos canônicos**:
  - `_URL` — base da API REST
  - `_SERVICE_ROLE_KEY` — JWT de service role (Supabase) ou token admin
  - `_ANON_KEY` — JWT anon ou chave pública
  - `_WEBHOOK_URL` — endpoint inbound
  - `_API_KEY` — chave genérica (REST, etc)
- **Aliases legacy** são aceitos via `ALIASES` em `supabase/functions/_shared/credentials.ts` — não criar novos aliases sem documentar a razão.

---

## 3. Checklist antes de salvar uma URL

- [ ] Começa com `https://`
- [ ] Para Supabase: regex `^https://[a-z0-9]{20}\.supabase\.co$` (project_ref com 20 chars alfanuméricos)
- [ ] Sem trailing slash, sem path (`/rest/v1/...` é montado dinamicamente)
- [ ] **NÃO** é a URL da barra do navegador (começa com `supabase.com/dashboard/`)
- [ ] Copiei de **Settings → API → Project URL**, não da barra do browser

> ⚠️ **Anti-padrão #1 (causou o incidente)**: copiar a URL da barra de endereço enquanto o Dashboard está aberto cola `https://supabase.com/dashboard/project/<ref>`, não a URL da API.

---

## 4. Checklist para chaves (anon / service_role)

- [ ] Começa com `eyJ` (JWT) ou `sb_publishable_` ou `sb_secret_`
- [ ] Sem espaços / newlines na cola
- [ ] Copiei do botão **"Copy"** da tela Settings → API (não selecionando o texto)
- [ ] Para `service_role`: confirmar que veio de **Settings → API → Service Role Key** (não anon)

---

## 5. Validação pós-cadastro

1. **Confirmar visualmente o digest SHA256 truncado** mostrado pelo Dashboard. Se possível, recalcular localmente:
   ```bash
   echo -n "https://<ref>.supabase.co" | sha256sum | cut -c1-12
   ```
   Os primeiros 12 chars devem bater com o digest exibido.

2. **Disparar uma chamada real** e confirmar 2xx nos logs do Edge Function (ou no painel `/admin/conexoes`).

3. Se a integração tiver health-check (`connections-health-check`), rodar antes de declarar pronto.

---

## 6. Anti-padrões conhecidos (causaram incidentes)

| Anti-padrão | Sintoma | Detecção |
|---|---|---|
| Colar URL da barra de endereço do Dashboard | 500 "credentials not configured" — `fetch()` recebe HTML 404 do site supabase.com | `validateUrlFormat` (Issue 2 do post-mortem) |
| Colar chave de outro projeto | 401 do PostgREST | `creds_health` mostra `source: "env"` mas request falha |
| Colar JWT no campo URL (ou vice-versa) | Função aceita mas qualquer fetch falha | `validateUrlFormat` reclama do `eyJ...` no campo URL |
| Trailing slash em URL | Pode causar `//rest/v1/...` (dependendo da concat) | Validação regex |
| Whitespace invisível no início/fim | Função "funciona" às vezes, depende do parser | Trim no save |

---

## 7. Próximos passos para evolução do POP

- [ ] **Issue 2** (`feat(observability): connections-health-check valida formato de URLs externas`) — adiciona `validateUrlFormat` em `_shared/connection-test-runner.ts` para que `last_test_message: "URL_MALFORMED"` apareça no painel `/admin/conexoes` antes do incidente.
- [ ] **Issue 3** (`refactor(security): migrar EXTERNAL_CRM_* para integration_credentials DB-first`) — após migrar, o sponsor consegue rotacionar via `UPDATE integration_credentials SET secret_value = ...` em vez de depender do Dashboard.

---

## Referências

- Tabela `public.integration_credentials` — definição e RLS
- `supabase/functions/_shared/credentials.ts` — `resolveCredential` (DB-first + env fallback)
- `supabase/functions/_shared/connection-test-runner.ts` — `pingX()` por tipo de integração
- Painel admin: `/admin/conexoes` — visualiza `last_test_message` por credencial
- Post-mortem: `docs/incidents/2026-05-22-crm-db-bridge-url-malformada.md`
