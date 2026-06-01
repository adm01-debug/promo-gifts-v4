# Testes de integração LIVE das Edge Functions

Suíte que exercita **cada** Edge Function deployada via HTTP real, validando
**status codes, saídas (shape), contrato de erro, CORS e fronteira de
autenticação**. Complementa os testes *mockados* em
`tests/edge-functions/integration/` (rápidos, determinísticos) com cobertura
contra o ambiente real.

- Local da suíte: `tests/edge-functions/live/<fn>.test.ts` (um arquivo por função)
- Harness: `tests/edge-functions/live/_live-client.ts`, `_authz.ts`, `_schemas.ts`, `_live-suite.ts`
- Conteúdo por função: `tests/edge-functions/live/descriptors.ts`
- Scaffold de novos arquivos: `node scripts/gen-edge-live-tests.mjs`
- Gate de CI (bloqueia merge): `npm run check:edge-live-coverage`

## Como rodar

```bash
# Sem credenciais → skip silencioso (valida só que tudo compila).
npm run test:edge:live

# LIVE contra o ambiente (use STAGING para happy-paths):
VITE_SUPABASE_URL=https://<ref>.supabase.co \
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_... \
npm run test:edge:live
```

Para os happy-paths de funções autenticadas/admin/dev, defina contas de teste
(`E2E_USER_*`, `E2E_ADMIN_*`, `E2E_DEV_*` — ver `.env.e2e.example`). Sem a conta
do tier, o happy-path daquele tier faz **skip gracioso**.

## O que cada spec valida

1. **CORS preflight** (OPTIONS) → headers `Access-Control-*`.
2. **Fronteira de auth** (derivada de `verify_jwt` em `config.toml` + manifest):
   - `verify_jwt=true` → chamada anônima rejeitada (401/403).
   - `verify_jwt=false` / public / scoped → handler alcançado; contrato = **sem 5xx**.
3. **Validação de input** — 6+ payloads malformados (JSON inválido, body vazio,
   array, string, null, número) → nunca 500 (quebra silenciosa). Com JWT do tier,
   espera 4xx + contrato de erro `{code|error|message}`.
4. **Happy-path** (saída) — só para funções **não-destrutivas** (ou destrutivas
   com `dry_run` seguro), com role disponível e, se cara, `EDGE_LIVE_COSTLY=1`.

## Segurança — NUNCA disparar efeito real

Funções com efeito colateral externo (envio de e-mail/push, sync com CRM,
limpeza, reset de senha, logout global, bloqueio de IP, churn de chave) estão
em `DESTRUCTIVE` (`_authz.ts`) e são testadas **negative-only**: fronteira de
auth + validação de input. O happy-path delas é suprimido, exceto via `dry_run`
explícito (`SUPPORTS_DRY_RUN`). Por isso é seguro rodar a suíte mesmo apontando
para produção — todas as chamadas positivas destrutivas são bloqueadas no harness.

## Adicionando uma função nova

1. Crie a edge em `supabase/functions/<fn>/index.ts` e registre no manifest.
2. Rode `node scripts/gen-edge-live-tests.mjs` (cria o shim sem clobber).
3. (Opcional) Enriqueça o descritor em `descriptors.ts` (happy-path/inputs).
4. O gate `check:edge-live-coverage` falha no CI se o passo 2 for esquecido.
