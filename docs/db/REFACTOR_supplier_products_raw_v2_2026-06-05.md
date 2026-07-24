# Refactor arquitetural v2 — `supplier_products_raw` (2026-06-05)

- **Projeto:** `doufsxqlfjyuvxuezpln`
- **Branch:** `claude/supplier-products-raw-design-L9UON`
- **Escopo:** continuação do refactor de 2026-06-04. Corrige a **integridade da
  máquina de estados**, liga a **máquina de retry** (que existia só como
  scaffolding), elimina colunas derivadas/mortas, torna a **quarentena terminal**
  no motor, ajusta o **histórico temporal** e a manutenção. Aplicado direto em
  produção em 5 migrations atômicas, com verificação entre as fases e teste E2E
  (com rollback).

## Estado inicial (medições 2026-06-05)
16.508 linhas; 73 MB; planner superestimando ~20% (reltuples 19.837 vs 16.508);
**499 linhas `status='processed'` COM `process_errors`** (estado mentiroso);
`attempts`/`claimed_at` 100% vazios; `images_processed` mantido por trigger
(drift atual 0); histórico 1:1 (32 MB, nenhuma versão real capturada).

## Causa-raiz descoberta
O motor `fn_process_raw_v2` gravava `process_errors` no handler de exceção
**sem** refletir no `status` e **sem** contar a tentativa. Logo: (a) linhas com
erro continuavam `processed`/`pending`; (b) `attempts`/`last_error`/`claimed_at`
eram scaffolding de uma fila com retry/poison-pill que nunca foi ligada; (c) a
fila (`status <> 'processed'`) reprocessaria `failed`/`quarantined` para sempre.

## Mudanças aplicadas

### Fase 1 — Integridade do estado + wiring do retry (no trigger)
- `fn_spr_before_write` passou a, em UPDATE com **novo** `process_errors`:
  guardar `last_error`, **`attempts := attempts + 1`** e marcar
  **`failed`** (ou **`quarantined`** a partir de 5 tentativas — poison-pill).
  Wiring feito no trigger, **sem reescrever o motor** (risco mínimo).
- Reconciliadas as **499** linhas → `failed` (verdade). Drift atual: **0**.
- Invariante travado: `CHECK (NOT (status='processed' AND process_errors IS NOT NULL))`.

### Fase 2 — Colunas derivadas e mortas
- **`images_processed`** deixou de ser sincronizada por trigger e virou
  **coluna GERADA** `GENERATED ALWAYS AS (images_status = 'processed') STORED`
  (drift impossível por construção). Mesmo tratamento que `processed` recebeu na v1.
- **`claimed_at` removida** (100% NULL; o claim é via advisory lock +
  `FOR UPDATE SKIP LOCKED`; nenhuma função/view/app a usava).
- `imported_at`, `created_at`, `updated_at` → **`NOT NULL`**.

### Fase 3 — Quarentena terminal no motor
- Predicado da fila trocado de `status <> 'processed'` para
  `status NOT IN ('processed','quarantined')` (5 ocorrências) — feito por
  **substituição exata** sobre `pg_get_functiondef` (sem reescrever as ~200
  linhas à mão). Linhas quarentenadas não voltam mais à fila.

### Fase 4 — Histórico temporal + índices
- `fn_spr_history` passou a capturar a versão **SUPERSEDIDA (OLD)** apenas em
  **UPDATE** (a linha bronze já é a v1). Trigger recriado como `AFTER UPDATE`.
  Acaba a duplicação 1:1 e a write-amplification por INSERT.
- Removidos `idx_spr_reference` (1 MB, ~15 scans, redundante com a unique
  composta) e `idx_spr_hist_ref` (sinalizado pelo advisor como não usado).

### Fase 5 — Stats e autovacuum
- `autovacuum_analyze_scale_factor=0.02`, `autovacuum_vacuum_scale_factor=0.05`;
  `ANALYZE` imediato.

## Verificação final
- `processed` com erro: **0**. Constraint ativa. 499 → `failed` (attempts≥1).
- `images_processed`: GENERATED, drift **0**. `claimed_at`: removida.
- Timestamps `NOT NULL`. Motor: 5/5 predicados migrados, 0 antigos.
- Planner: reltuples **16.508 = real**. Tamanho **73 MB → 39 MB** (rewrite
  reclamou bloat).
- E2E (rollback): UPDATE simulando erro do motor numa linha `failed` →
  `attempts` incrementou, `last_error` capturado, `status` permaneceu verdadeiro. ✅

## Deliberadamente **não** feito (com justificativa)
- **`UNIQUE (supplier_id, content_hash)`**: a v1 já avaliou e recusou — bloquearia
  payloads idênticos legítimos (re-sync de produto inalterado) a menos que toda a
  ingestão use `ON CONFLICT`. Hoje há 0 colisões, mas o ganho não compensa o risco
  de quebrar a ingestão. Mantido sem unique.
- **Consolidar `imported_at`/`created_at`**: várias views dependem de `created_at`;
  dropar quebraria-as. Mantidas as duas (ambas `NOT NULL`).
- **Trocar default de `source_channel`** (`'n8n'` nunca usado): mexer no default
  tem acoplamento com inserters e **zero** benefício de dado. O `CHECK` atual é
  suficiente; o trigger já normaliza a partir de `raw_data->>'_source'`.
- **Particionar / GIN em `raw_data`**: desnecessário em 16k linhas / 39 MB e sem
  evidência de filtro por chave do JSON — seria over-engineering.

## Follow-ups (opcionais)
- Reprocessar os 499 `failed` do XBZ (rodar `fn_process_raw_v2` para o fornecedor);
  os que falharem 5x irão para `quarantined` automaticamente para revisão manual.
- Acelerar a fila de imagens (11.641 `images_status='pending'`) e a promoção
  bronze→silver (cobertura ~38%).
- Médio prazo: `source_channel` via tabela de referência (FK) no lugar do `CHECK`.
