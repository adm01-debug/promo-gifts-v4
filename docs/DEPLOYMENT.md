# Deployment Guide — Promo_Gifts

> **Última revisão:** 2026-05-22 (pós-auditoria back-end sênior, DOC-001 — números reais)
> **Status do redeploy:** ver `docs/redeploy/REDEPLOY-FASE2-EXECUTION-LOG.md`

---

## ⚠️ Avisos críticos antes de qualquer deploy

### 1. NÃO use `supabase db push`

O diretório `supabase/migrations/` tem **~710 arquivos**; o banco de produção registra **~685 migrations** aplicadas (drift atual de ~25 arquivos, ~3.5%). A divergência maior foi reconciliada na onda de recovery de mai/2026 (ver `RECOVERY_PLAN.md`); o que sobra hoje são migrations recentes ainda não promovidas ao banco.

**Consequência prática:**

```bash
# ❌ NUNCA rode isso:
supabase db push --project-ref doufsxqlfjyuvxuezpln
# Vai tentar aplicar todas as migrations do repo na ordem, podendo
# conflitar com objetos já existentes no banco de produção.
```

**Fonte da verdade do schema é o BANCO em produção**, não o repo. O repo é o **registro histórico** das intenções de mudança e o material para aplicar **uma migration nova de cada vez** via `apply_migration` MCP ou SQL Editor.

Detalhes completos: [`docs/redeploy/REDEPLOY-T3-MIGRATIONS-AUDIT.md`](redeploy/REDEPLOY-T3-MIGRATIONS-AUDIT.md).

### 2. Como aplicar mudanças de schema corretamente

Para qualquer DDL nova:

**Opção A (recomendada) — MCP do Supabase:**
- Ferramenta `apply_migration` aplica direto e registra em `supabase_migrations.schema_migrations`.

**Opção B — Dashboard:**
- SQL Editor → cole o SQL → Run. Funciona, mas não registra na history.

**Opção C — Branching de banco:**
- Criar branch dev no Supabase, validar, depois `merge_branch` para prod.

Cada novo arquivo `supabase/migrations/*.sql` no repo serve como **registro histórico** da intenção; ele NÃO é re-aplicado em prod.

#### ⚠️ Exceção: policies em `storage.objects`

Operações em `storage.objects` (RLS policies, alterações de schema) **não funcionam via MCP/`apply_migration`**. A tabela pertence ao role `supabase_storage_admin` e o role acessível por MCP (`postgres`) não é membro. Confirmação em `docs/storage/PUBLIC_BUCKETS.md` com 3 tentativas registradas.

Para essas mudanças use:

1. **Dashboard Supabase** → Storage → Policies → New policy (caminho oficial; passa pelo role correto internamente)
2. Adicione um arquivo `supabase/migrations/<timestamp>_descritivo.sql` no repo **só como registro documental** (com comentário no topo: `-- APLICADO MANUALMENTE VIA DASHBOARD em <data>; não re-aplicar`)
3. Não use `merge_branch` para esse arquivo — manter `supabase/migrations/` em sync continua sendo apenas histórico, conforme política da seção #1 deste doc

---

## Arquitetura de deploy

Push para `main` no GitHub dispara **dois deploys independentes**:

```text
┌─────────────────────────────┐
│  push origin main           │
└────────────┬────────────────┘
             │
   ┌─────────┴──────────┐
   │                    │
   ▼                    ▼
Lovable Cloud      Vercel
   │                    │
   ▼                    ▼
promogifts.com.br   promo-gifts-beta.vercel.app
[PRODUÇÃO]          [STAGING/PREVIEW]
```

- **Produção real:** `promogifts.com.br` (Lovable, custom domain)
- **Staging gratuito:** `*.vercel.app` (Vercel project `prj_lfv6J41d3UY4YhcGE4y1aJo8T339`)
- **Rollback rápido:** se Lovable falhar, apontar DNS de `promogifts.com.br` para a Vercel

Cobertura completa em [`docs/redeploy/REDEPLOY-T2.5-FOLLOWUP.md`](redeploy/REDEPLOY-T2.5-FOLLOWUP.md).

---

## Prerequisites locais

- Node.js 18+ (recomendado: 20 LTS, que CI usa)
- npm 10+
- Conta Supabase com acesso ao projeto `doufsxqlfjyuvxuezpln`

**Não usa Redis.** O projeto não tem camada de cache externa — cache de UI fica a cargo do TanStack Query (`@tanstack/react-query`) no cliente.

---

## Build local

```bash
npm install
npm run build       # vite build → dist/
npm run preview     # serve dist em http://localhost:4173
```

---

## Variáveis de ambiente

Veja `.env.e2e.example` para o conjunto necessário em CI.

Para frontend:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Para edge functions e backend (configuradas no Supabase Dashboard, não no repo):
- ver inventário em `recovery/block19_secrets_inventory.md` e `recovery/block22_edge_secrets_inventory.md`

---

## Production Checklist (pré-redeploy)

- [ ] Branch protection ativa em `main` (ver `docs/BRANCH_PROTECTION.md`)
- [ ] Dependabot Security Alerts + Secret Scanning + Push Protection ativos (ver `docs/SECURITY_ALERTS.md`)
- [ ] Advisor de segurança Supabase com 0 ERRORs (ver `mcp__get_advisors`)
- [ ] Buckets públicos zerados (ver `docs/storage/PUBLIC_BUCKETS.md`)
- [ ] Policy `recibos_authenticated_read` criada em `storage.objects`
- [ ] CI verde no commit que vai entrar em prod
- [ ] Smoke E2E passando em `promogifts.com.br` após deploy

---

## Rollback

Se um deploy quebrar produção:

1. **Frontend:** reverter o commit em `main` via `git revert` + push → Lovable redeploys
2. **Schema (Postgres):** restaurar via Supabase point-in-time recovery (PITR) — dashboard → Database → Backups
3. **Storage (arquivos):** ⚠️ **PITR NÃO recupera arquivos do Storage** — restaura apenas a tabela `storage.objects` (metadados). Os objetos físicos ficam num backend S3-compatible separado, fora do escopo do backup. Estratégia atual:
   - Buckets em uso (`recibos-entrega`, `scripts`) **não têm versionamento ativo**
   - Para incidentes: tentar reconciliação manual via `storage.objects` metadata + backup externo (se existir)
   - **Recomendação P2 para Fase 3:** habilitar versionamento de bucket OU job periódico de cópia para R2/S3 externo. Tracking em issue própria a abrir
4. **Edge functions:** redeploy do commit anterior via MCP `deploy_edge_function` (preferido) ou `supabase functions deploy` se tiver CLI local

---

## Referências cruzadas

- `docs/redeploy/REDEPLOY-FASE2-EXECUTION-LOG.md` — fase atual do redeploy
- `docs/redeploy/REDEPLOY-T3-MIGRATIONS-AUDIT.md` — detalhe do desync de migrations
- `docs/redeploy/REDEPLOY-T2.5-FOLLOWUP.md` — arquitetura Lovable + Vercel
- `docs/BRANCH_PROTECTION.md` — política de proteção de branch
- `docs/SECURITY_ALERTS.md` — Dependabot + CodeQL + Secret Scanning
- `docs/storage/PUBLIC_BUCKETS.md` — política de buckets
