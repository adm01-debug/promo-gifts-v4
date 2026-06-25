# Migration pendente — alinhar CHECK `valid_quote_status` (10 status)

**Status:** entregue (SQL pronto), **NÃO aplicada** no banco Gold.
**Banco alvo:** `doufsxqlfjyuvxuezpln` (Supabase Gold do PO — fonte da verdade).
**NÃO aplicar** no `pqpdolkaeqlyzpdpbizo` (projeto Lovable Cloud interno).

## Arquivos

- `20260625120000_align_quote_status_check.sql` — UP (alinha aos 10 status).
- `20260625120000_align_quote_status_check.down.sql` — DOWN (rollback lossy).

## Por quê

O FE (`src/types/quote.ts → QUOTE_STATUSES`) define **10** status, mas o
CHECK constraint no banco aceita apenas **7**. Tentativas de persistir
`pending_approval`, `viewed` ou `cancelled` falham com SQLSTATE `23514`.

O `sanitizeQuoteStatus` em `src/services/quoteService.ts` evita crash
fazendo fallback p/ `pending` em leitura, mas o gap de **escrita**
continua aberto e gera telemetria `quote_status_transition_blocked`
com `reason: 'db_check_violation'`.

## Aplicação (PO)

```bash
# 1. Conectado ao projeto Gold:
psql "$GOLD_DB_URL" -f docs/migrations/20260625120000_align_quote_status_check.sql

# 2. Confirmar:
psql "$GOLD_DB_URL" -c "\d+ public.quotes" | grep valid_quote_status
```

A migration **aborta automaticamente** se houver linha com status fora
do enum esperado (não coage silenciosamente).

## Rollback

```bash
psql "$GOLD_DB_URL" -f docs/migrations/20260625120000_align_quote_status_check.down.sql
```

**Operação lossy** — `pending_approval`/`viewed` → `pending`, `cancelled` → `rejected`.
Faça backup do recorte afetado antes (snippet COPY no header do `.down.sql`).
