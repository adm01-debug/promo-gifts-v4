# Refactor arquitetural — `supplier_products_raw` (2026-06-04)

- **Projeto:** `doufsxqlfjyuvxuezpln`
- **Branch:** `claude/supplier-products-raw-design-9hrwC`
- **Escopo:** eliminar o modelo de estado duplo (booleanos legados × enums), colunas
  mortas, índices redundantes, satélites pesadas e exposição excessiva do `anon`,
  consolidando os triggers. Aplicado **direto em produção** em 7 migrations atômicas,
  com verificação entre as fases e teste E2E (com rollback).

## Estado inicial (medições)
16.508 linhas; 78 MB; `n_tup_upd ≈ 69.531` (~4,2 updates/linha); 6 triggers;
13 índices; satélites `_history` (32 MB) + `_bkp_20260604` (36 MB).

## Mudanças aplicadas

### P0 — Correção
- **`images_processed`** estava dessincronizado de `images_status` em **11.641 linhas**
  (70%). Passou a ser **espelho unidirecional** do enum (fonte da verdade) no trigger
  consolidado + backfill. Drift atual: **0**.
- **Cutover da fila para `status`**: motor (`fn_process_raw_v2`) e demais funções/views
  liam/escreviam o booleano `processed`; tudo migrado para o enum `status`.

### P1 — Redundância de colunas
- **`processed` removida** (era derivável de `status`; ponte de sincronização eliminada).
  Reescritos 11 views + 8 funções + triggers; reconciliação da janela de transição.
- **`raw_hash` removida** (92% NULL). A detecção de mudança na ingestão passou a usar
  `content_hash` (hash "limpo", ignorando metacampos voláteis `_source`/`_imported_at`/
  `_api_fields_count`) — menos reprocessamentos falsos.

### P2 — Índices
- `idx_spr_supplier` (prefixo redundante) removido.
- `idx_spr_processed` (parcial sobre o booleano) caiu junto com a coluna e foi
  substituído por **`idx_spr_unprocessed`** `(supplier_id, imported_at) WHERE status <> 'processed'`
  — fila enxuta (8 KB, pois quase tudo fica `processed`).

### P3 — Manutenção / crescimento
- `_bkp_20260604` (36 MB) removida.
- **Retenção de `_history`**: `fn_purge_spr_history(keep_days=90)` + cron diário
  `purge-spr-history-daily` (03:30). `_history` incluída no `vacuum-analyze-weekly`.
- `fillfactor=90` + autovacuum mais agressivo (favorece HOT-update).
- **6 → 3 triggers**: os 4 BEFORE (`normalize` + `initial_state` + `sync_status` +
  `set_updated_at`) foram fundidos em **`trg_spr_before_write`** (`fn_spr_before_write`,
  `search_path` fixo). Mantidos os 2 AFTER (`auto_sync_dimensions`, `history`).
  `set_updated_at` **não** foi removida (compartilhada por 65 tabelas).

### P4 — Segurança (RLS / grants)
- Revogado `INSERT/UPDATE/REFERENCES` de `anon` e `authenticated` (bomba latente; a
  ingestão é por `service_role`/funções `SECURITY DEFINER`).
- Revogado `SELECT` de `anon` em colunas internas (`last_error`, `claimed_at`,
  `attempts`, `source_event_id`, `source_endpoint`) — não usadas pelas views públicas.

## Verificação final
- `processed`/`raw_hash`: **0** colunas restantes; **0** funções/views referenciando.
- 16.508 linhas intactas; `content_hash` 100% preenchido; `images` mismatch = 0.
- E2E de ingestão (rollback): `status=pending`, `content_hash` calculado, `images`
  espelhado, `source_channel` normalizado, metacampos removidos. ✅

## Follow-ups (opcionais)
- Avaliar `UNIQUE (supplier_id, content_hash)` para dedup forte (hoje único de fato,
  mas há risco de bloquear payloads idênticos legítimos — mantido como índice simples).
- Reavaliar `idx_spr_content_hash` (4 MB, baixo uso) após o novo fluxo estabilizar.
