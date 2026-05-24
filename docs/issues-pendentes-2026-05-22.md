# Issues a abrir manualmente — Pós-incidente 2026-05-22

> **Por que está aqui:** o MCP de criação de issues falhou durante a sessão. Os 3 specs estão prontos abaixo — basta clicar no link "Abrir no GitHub", o título e o body já vão pré-preenchidos.
>
> **Contexto:** todas derivam do post-mortem [`docs/incidents/2026-05-22-crm-db-bridge-url-malformada.md`](./incidents/2026-05-22-crm-db-bridge-url-malformada.md).

---

## Issue 1 — docs(operations): POP de cadastro de secrets externos no Supabase

**[→ Abrir no GitHub](https://github.com/adm01-debug/promo-gifts-v4/issues/new?title=docs(operations)%3A+POP+de+cadastro+de+secrets+externos+no+Supabase&body=Ver+spec+em+%60docs%2Fissues-pendentes-2026-05-22.md%60+%E2%80%94+se%C3%A7%C3%A3o+Issue+1.)**

**Resumo:** criar `docs/operations/cadastro-secrets-supabase.md` com checklist visual de 6 seções para evitar repetir o copy-paste da URL do Dashboard ao invés da URL da API.

**Conteúdo do POP:**

1. **Quando usar Edge Functions Secrets vs `integration_credentials`**
   - Edge Functions Secrets: bootstrap, credenciais de infra que não podem viver no DB
   - `integration_credentials` (DB-first via `resolveCredential`): integrações externas — permite rotação via SQL/MCP com auditoria

2. **Convenções de nomenclatura**
   - Prefixo `EXTERNAL_<TARGET>_` para integrações externas
   - Sufixos canônicos: `_URL`, `_SERVICE_ROLE_KEY`, `_ANON_KEY`, `_WEBHOOK_URL`, `_API_KEY`
   - Aliases legacy aceitos via `ALIASES` em `_shared/credentials.ts`

3. **Checklist antes de salvar uma URL**
   - [ ] Começa com `https://`
   - [ ] Para Supabase: regex `^https://[a-z0-9]{20}\.supabase\.co$`
   - [ ] Sem trailing slash, sem path
   - [ ] NÃO é a URL da barra do navegador (começa com `supabase.com/dashboard/`)
   - [ ] Copia de **Settings → API → Project URL**, não da barra do browser

4. **Checklist para chaves (anon / service_role)**
   - [ ] Começa com `eyJ` (JWT) ou `sb_publishable_`
   - [ ] Sem espaços / newlines
   - [ ] Copia do botão "Copy" da tela Settings → API

5. **Validação pós-cadastro**
   - Confirmar visualmente o digest SHA256 truncado mostrado pelo Dashboard
   - Disparar uma chamada real e confirmar 2xx nos logs

6. **Anti-padrões conhecidos**
   - Colar URL da barra de endereço → vai cadastrar URL do Dashboard (causou o incidente)
   - Colar chave de outro projeto → 401 do PostgREST
   - Colar JWT no campo de URL → função aceita mas qualquer fetch falha

**Critério de aceite:**
- [ ] `docs/operations/cadastro-secrets-supabase.md` criado
- [ ] Linkado a partir do README (seção "Operação")
- [ ] Linkado do post-mortem
- [ ] Cada checklist é lista markdown clicável

**Esforço:** ~1h. Documentação pura.

---

## Issue 2 — feat(observability): `connections-health-check` valida formato de URLs externas

**[→ Abrir no GitHub](https://github.com/adm01-debug/promo-gifts-v4/issues/new?title=feat(observability)%3A+connections-health-check+valida+formato+de+URLs+externas&body=Ver+spec+em+%60docs%2Fissues-pendentes-2026-05-22.md%60+%E2%80%94+se%C3%A7%C3%A3o+Issue+2.)**

**Resumo:** atualizar `connections-health-check` para validar formato das URLs configuradas, marcando `last_test_message: "URL_MALFORMED"` quando o valor não bate em padrão esperado. Falha cedo, não em produção.

**Motivação:** no incidente de 2026-05-22, a função `crm-db-bridge` aceitava a URL malformada porque a validação era apenas `!!CRM_URL`. Qualquer string não-vazia passava. A falha só aparecia no momento do `fetch()`, mascarando a causa-raiz.

**Especificação técnica:**

1. Em `supabase/functions/_shared/connection-test-runner.ts`, adicionar antes de cada `pingX()`:

```ts
function validateUrlFormat(url: string, type: ConnectionType, env_key?: "promobrind" | "crm"): string | null {
  if (type === "supabase") {
    const m = /^https:\/\/([a-z0-9]{20})\.supabase\.co$/.exec(url);
    if (!m) return `URL_MALFORMED: esperado https://<project_ref>.supabase.co, recebido "${url.slice(0, 40)}..."`;
  }
  if (type === "bitrix24" && !url.startsWith("https://")) {
    return "URL_MALFORMED: webhook Bitrix24 deve começar com https://";
  }
  if (type === "n8n" && !url.match(/^https?:\/\//)) {
    return "URL_MALFORMED: n8n base URL deve começar com http(s)://";
  }
  return null;
}
```

2. Em `runConnectionTest`, antes de chamar `pingSupabase/Bitrix/N8n`:

```ts
const urlErr = validateUrlFormat(url, type, env_key);
if (urlErr) {
  result = { ok: false, error: urlErr, error_kind: "config" };
} else {
  result = await pingSupabase(url, key, timeoutMs);
}
```

3. No `connections-auto-test`, o `last_test_message` agora vai mostrar `URL_MALFORMED: ...` no painel admin, permitindo detecção visual imediata.

**Critério de aceite:**
- [ ] Função `validateUrlFormat` adicionada em `_shared/connection-test-runner.ts`
- [ ] Aplicada antes de cada `pingX()` em `runConnectionTest`
- [ ] Teste unitário cobrindo: URL válida, URL do dashboard, URL com trailing slash, URL com path, URL vazia, URL sem https
- [ ] Painel `/admin/conexoes` exibe `URL_MALFORMED` quando aplicável
- [ ] Documentar no `_shared/credentials.ts` que apenas formato é validado, não conteúdo (project_ref pode existir ou não)

**Esforço:** ~3h (1h código + 1h testes + 1h validação no admin).

---

## Issue 3 — refactor(security): migrar `EXTERNAL_CRM_*` para `integration_credentials` (DB-first)

**[→ Abrir no GitHub](https://github.com/adm01-debug/promo-gifts-v4/issues/new?title=refactor(security)%3A+migrar+EXTERNAL_CRM_*+para+integration_credentials+(DB-first)&body=Ver+spec+em+%60docs%2Fissues-pendentes-2026-05-22.md%60+%E2%80%94+se%C3%A7%C3%A3o+Issue+3.)**

**Resumo:** mover os 3 secrets `EXTERNAL_CRM_URL`, `EXTERNAL_CRM_SERVICE_ROLE_KEY`, `EXTERNAL_CRM_ANON_KEY` do Edge Functions Secrets (Deno.env) para a tabela `public.integration_credentials`. Como `resolveCredential()` já é DB-first, isso permite rotação 100% via SQL/MCP, com auditoria + histórico.

**Motivação:** durante o incidente, a correção exigiu acesso ao Dashboard do Supabase. Se a URL estivesse em `integration_credentials`, eu (agente) poderia ter feito a correção em 5 segundos via `UPDATE integration_credentials SET secret_value = ... WHERE secret_name = 'EXTERNAL_CRM_URL'`, com log automático e versionamento.

**Especificação:**

1. **DDL** (já existe a tabela; verificar estrutura)
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'integration_credentials';
-- esperado: secret_name (text PK), secret_value (text), description, updated_at, updated_by
```

2. **Migração de dados** (via MCP, após sponsor aprovar):
```sql
INSERT INTO integration_credentials (secret_name, secret_value, description)
VALUES
  ('EXTERNAL_CRM_URL', 'https://pgxfvjmuubtbowutlide.supabase.co', 'CRM externo (Gestão de Clientes)'),
  ('EXTERNAL_CRM_SERVICE_ROLE_KEY', '<valor a ser fornecido pelo sponsor>', 'CRM service_role JWT'),
  ('EXTERNAL_CRM_ANON_KEY', '<valor a ser fornecido pelo sponsor>', 'CRM anon JWT')
ON CONFLICT (secret_name) DO UPDATE SET secret_value = EXCLUDED.secret_value, updated_at = now();
```

3. **Validação** — `resolveCredential` é DB-first por design (`credentials.ts` linha ~40):
```ts
// 1) DB
const { data } = await client.from("integration_credentials").select("secret_value")...
if (!error && data?.secret_value) {
  return { value: ..., source: "db" };
}
// 2) Env (fallback)
const envCanonical = Deno.env.get(name);
```
Após inserir no DB, a próxima invocação (após TTL de 60s do cache) já lê do DB. Verificável via `?op=creds_health` que retorna `source: "db"` quando vindo do DB.

4. **Remoção dos secrets do Edge Functions Secrets** (somente após confirmar `creds_health` retorna `source: "db"` em 5 requests consecutivas — período de canary).

5. **Estender padrão**: documentar em `docs/operations/cadastro-secrets-supabase.md` (Issue 1) que credenciais de integrações externas devem ir prioritariamente para `integration_credentials`, não para Edge Functions Secrets.

**Critério de aceite:**
- [ ] 3 secrets `EXTERNAL_CRM_*` inseridos em `integration_credentials`
- [ ] `creds_health` retorna `source: "db"` para os 3
- [ ] App continua funcionando normalmente (5 requests consecutivas 2xx)
- [ ] Após canary de 24h sem erros, remover os 3 secrets do Edge Functions Secrets
- [ ] Documentação atualizada no POP (Issue 1)
- [ ] Padrão estendido para `EXTERNAL_PROMOBRIND_*` em PR separado

**Esforço:** ~2h (verificar schema + inserir + canary de 24h, sendo a maior parte aguardando o canary).

**Bloqueador:** precisa que o sponsor (você, Abner) forneça os valores de `EXTERNAL_CRM_SERVICE_ROLE_KEY` e `EXTERNAL_CRM_ANON_KEY` para inserção. URL eu já tenho.

---

## Notas de processo

- O MCP de criação de issues falhou nesta sessão; quando estiver funcionando, posso re-tentar
- Recomendo abrir as 3 em sequência para o Project board mostrar a relação causa→efeito
- Issue 1 não bloqueia ninguém. Issue 2 e Issue 3 podem rodar em paralelo