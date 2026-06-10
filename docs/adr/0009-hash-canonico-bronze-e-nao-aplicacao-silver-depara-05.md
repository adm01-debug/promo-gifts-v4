# ADR 0009 — Hash canônico no Bronze e não-aplicação das migrações silver_depara no banco

**Data:** 2026-06-10
**Status:** Aceito (executado em produção)
**Relacionados:** ADR 0007 (de-para pipeline único), ADR 0008, `docs/AUDITORIA_ARQUITETURA_MEDALLION_DB_2026-06-10.md`, `docs/EXECUCAO_CORRECOES_MEDALLION_2026-06-10.md`

## Contexto

A auditoria de 2026-06-10 provou que o change-detection do Bronze estava quebrado:

1. `content_hash` era **coluna gerada** (`sha256(raw_data)` cheio) — a lógica de hash "com strip de metadados" no trigger `fn_spr_before_write` era código morto desde a criação.
2. O enrich de estoque XBZ escrevia estado volátil (`QuantidadeDisponivel`, etc.) e um timestamp sempre-novo (`_ruiz_sync_at`) dentro de `raw_data`, com tipos JSON corrompidos (números→strings via `->>`).
3. Consequências medidas: ~375 mil versões/dia no histórico (3,16M linhas/5 GB em 7 dias, 100% ruído), e um carrossel `pending↔processed` reprocessando o catálogo XBZ continuamente (12,7M updates acumulados no Bronze).

## Decisão 1 — Hash canônico configurável por fornecedor

- `content_hash` deixa de ser coluna gerada (`DROP EXPRESSION`) e passa a ser mantido por `fn_spr_before_write`.
- Definição: `content_hash = sha256(raw_data − chaves '_%' − supplier_settings.hash_excluded_fields)`.
- `hash_excluded_fields` é **configuração, não hard-code** (XBZ: `Disponivel`, `QuantidadeDisponivel`, `QuantidadeDisponivelEstoquePrincipal`, `ReposicaoDataPrevista`, `StatusConfiabilidade` — derivados de censo de volatilidade em 8.000 pares de versões reais).
- Contrato dos ingestores (`insert_supplier_product_raw`, `fn_ingest_supplier_raw`): re-disparar pipeline (`status='pending'`) **somente** quando o hash canônico muda. Estado volátil de estoque flui pelos canais próprios (`stock_data`/`stock_hash`/`stock_status`), nunca re-dispara padronização de produto.
- Escritores de enriquecimento DEVEM preservar tipos JSON (`item->'campo'`, nunca `item->>'campo'`) e não gravar chaves de metadado em `raw_data` (qualquer chave `_%` é removida pelo trigger antes da persistência).

## Decisão 2 — silver_depara_01..06 (PR #693) permanecem NÃO aplicadas no banco

As migrações estão no repositório, porém aplicá-las hoje regrediria produção:

1. `silver_depara_05` reescreve `fn_standardize_variant` cobrindo apenas 8 campos — perde `capacity_ml`, tiers (`cost_price_1..5`, `min_qty_1..5`), `next_*`, `sale_multiplier` e mídia (`supplier_thumbnail/images/videos`) que a versão viva popula;
2. o `ON CONFLICT` da versão de-para sobrescreve `color_id` sem o `COALESCE(EXCLUDED.color_id, pv.color_id)`;
3. desfaria o hotfix `spot_canonical_code_guard_in_standardize_variant` aplicado em produção em 2026-06-10 10:53.

**Caminho para concluir o ADR 0007:** rebasear a `silver_depara_05` sobre a função viva (incluindo guard SPOT, tiers e mídia), re-semear o de-para com esses campos e exigir parity check (`silver_depara_06`) verde com diff zero contra produção antes do apply.

## Consequências

- Histórico do Bronze caiu de ~375 mil para ~0 gravações/dia; particionado por mês com purga via `DROP PARTITION` (legado em `supplier_products_raw_history_legacy` até esvaziar).
- O significado de `status='pending'` volta a ser confiável: fila drena e `processed` permanece.
- Falhas de promoção agora marcam o Bronze (`failed`→`quarantined` em 5 tentativas) com requeue horário — sem loops infinitos silenciosos.
- Qualquer novo fornecedor declara seus campos voláteis em `supplier_settings.hash_excluded_fields`; nenhuma alteração de função é necessária.
