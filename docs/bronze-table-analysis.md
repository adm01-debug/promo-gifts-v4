# 📊 Análise Exaustiva — Tabela Bronze

> Análise gerada em 2026-06-04 sobre o banco de dados de produção.

**Projeto:** `doufsxqlfjyuvxuezpln` (supabase-fuchsia-kite) · região sa-east-1 · PostgreSQL 17.6
**Tabela bronze identificada:** `public.supplier_products_raw`

> Não existe objeto literalmente chamado "bronze". A camada bronze da arquitetura **medallion** está
> implementada em `supplier_products_raw`, cujo comentário no banco é:
> *"Bronze/landing de ingestão. GRÃO: 1 linha = 1 variante/SKU"*.
> As camadas adjacentes são `supplier_products_raw_history` (histórico append-only do bronze) e
> `produtos_padronizacao` (SILVER).

---

## 1. Visão geral física

| Métrica | Valor |
|---|---|
| Linhas (exatas) | **16.508** |
| Tamanho total | **78 MB** (dados 67 MB + índices 12 MB) |
| Colunas ativas | 25 (a posição 14 foi removida — coluna dropada) |
| Índices | 13 |
| Triggers | 6 |
| FKs | 4 |
| RLS | **ativada, 3 policies** ✅ |
| Janela de ingestão | 29/jan/2026 → 16/mar/2026 |

## 2. Modelo de dados (medallion)

- **Chave primária:** `id uuid`
- **Unicidade de negócio:** `(supplier_id, supplier_reference)` e `(supplier_id, supplier_sku)`
- **Payload imutável:** `raw_data jsonb` (CHECK garante que seja objeto)
- **Dedup/mudança:** `content_hash` (SSOT, md5 do raw_data limpo) — **100% preenchido e 100% único**
  (16.508 distintos). `raw_hash` está **DEPRECADO** (só 1.257 linhas preenchidas).
- **Proveniência de 1ª classe:** `source_channel`, `source_endpoint`, `source_event_id`
- **Máquina de estados:** enum `supplier_raw_status` =
  `pending, processing, processed, failed, skipped, quarantined`.
  Campos `processed` e `images_processed` são **derivados** (mantidos por triggers;
  SSOT são `status`/`images_status`).
- **Pipeline de triggers (ordem alfabética importa):**
  `trg_aa_spr_normalize` (limpa JSON + calcula content_hash) →
  `trg_set_initial_state` →
  `trg_zz_sync_raw_status` (sincroniza flags derivadas) →
  `trg_spr_history` (grava histórico) →
  `trg_auto_sync_product_dimensions` →
  `set_updated_at_trigger`.

### 2.1. Constraints

- `chk_spr_raw_object` — `CHECK (jsonb_typeof(raw_data) = 'object')`
- `chk_spr_source_channel` — `CHECK (source_channel IN ('n8n','file_upload','file_upload_retry','file_upload_fix','manual','api_direct','bitrix','mysql_sync','legacy'))`
- FKs: `supplier_id → suppliers(id)`, `product_id → products(id)`, `variant_id → product_variants(id)`, `import_batch_id → supplier_import_batches(id)`

## 3. Distribuição dos dados

### Por fornecedor (5 fornecedores)

| Fornecedor | Linhas | c/ product_id | c/ variant_id | Imagens OK | Erros |
|---|--:|--:|--:|--:|--:|
| XBZ Brindes | 10.394 | 10.390 | 0 | 0 | **499** |
| Spot \| Stricker | 3.612 | 3.612 | 0 | 3.612 | 0 |
| Asia Import | 1.245 | 1.244 | 1.245 | 0 | 0 |
| Só Marcas | 1.217 | 1.217 | 1.215 | 1.215 | 0 |
| 88 Brindes | 40 | 40 | 0 | 40 | 0 |

### Estado do pipeline

- `status` = **processed em 100%** das linhas.
- `images_status`: 11.641 pending (70,5%) / 4.867 processed (29,5%).
- **Canal (`source_channel`):** file_upload 9.844 · legacy 6.613 · file_upload_retry 50 ·
  file_upload_fix 1 — **zero "n8n"**, apesar de ser o default da coluna.

## 4. 🔴 Achados e problemas de qualidade

1. **499 erros silenciados (XBZ):** todas as 499 linhas com `process_errors` contêm SQL
   `UPDATE products …` **e** texto de erro, mas estão marcadas como `status='processed'`.
   São rows cuja escrita na camada silver **falhou**, porém o status não reflete isso.
   → Inconsistência entre `status` e `process_errors`. Deveriam estar `failed`/`quarantined`.
2. **Dados de teste em produção:** 4 registros `TESTE*` ("Teste de Variacao 01", "Tigela de Teste",
   "Produto Teste"…) poluindo o bronze do XBZ. 3 deles são órfãos (sem `product_id`).
3. **5 linhas órfãs sem `product_id`:** 4 do XBZ (testes) + 1 da Asia (`CM3870-VD`, com
   `Name`/`Nome` nulos — gap de dados real).
4. **Cobertura silver baixa:** silver (`produtos_padronizacao`) tem 6.235 linhas vs 16.508 no bronze
   → **só ~37,8%** padronizado. Gap grande de promoção bronze→silver.
5. **Imagens majoritariamente não processadas:** 70,5% pending. XBZ (10.394) e Asia (1.245) estão
   100% pendentes de imagem.
6. **`source_channel` semanticamente impreciso:** "legacy" abrange fornecedores inteiros
   (Stricker, Asia, Só Marcas, 88) + os 499 erros do XBZ; o default "n8n" nunca é usado.
7. **JSON heterogêneo por fornecedor** (esperado em bronze, mas relevante para silver):
   XBZ usa chaves PT (`Nome`, `PrecoVenda`, `Ncm`, `CodigoXbz`…); Stricker usa chaves EN
   (`BoxVolume`, `ColorHex1`, `Area1Image`…). A silver precisa de mapeamento por fornecedor.
8. **Histórico sem versões reais:** `supplier_products_raw_history` tem 16.508 linhas (1:1 com o
   bronze) e `max(attempts)=0` — ou seja, **nenhum row sofreu UPDATE pós-insert**. O mecanismo
   append-only existe mas ainda não capturou nenhuma 2ª versão. Ingestões foram cargas únicas por dia.

## 5. Índices — eficiência

| Situação | Índices |
|---|---|
| Quentes (muito usados) | `pkey` (254k scans), `import_batch_id` (113k), `idx_spr_processed` (43k), `product` (28k) |
| Ociosos no momento | `idx_spr_queue`, `idx_spr_images_queue`, `idx_spr_failed` — **0 scans** (índices parciais de fila; zerados porque nada está pending/failed agora — válidos, mas com custo de escrita) |
| Pouco usado p/ tamanho | `idx_spr_content_hash` (4 MB, só 3 scans) |

Lista completa de índices:

- `supplier_products_raw_pkey` — UNIQUE (id)
- `uq_supplier_product_raw` — UNIQUE (supplier_id, supplier_reference)
- `uq_spr_supplier_sku` — UNIQUE (supplier_id, supplier_sku)
- `idx_spr_content_hash` — (supplier_id, content_hash)
- `idx_spr_reference` — (supplier_reference)
- `idx_spr_supplier` — (supplier_id)
- `idx_spr_variant_id` — (variant_id) WHERE variant_id IS NOT NULL
- `idx_supplier_products_raw_product` — (product_id) WHERE product_id IS NOT NULL
- `idx_supplier_products_raw_import_batch_id` — (import_batch_id)
- `idx_spr_processed` — (processed) WHERE processed = false
- `idx_spr_queue` — (supplier_id, imported_at) WHERE status = 'pending'
- `idx_spr_images_queue` — (supplier_id) WHERE images_status = 'pending'
- `idx_spr_failed` — (supplier_id) WHERE status = 'failed'

---

## ✅ Recomendações prioritárias

1. **Reconciliar os 499 "processed" com erro** → reprocessar e mover para `failed`/`quarantined`,
   ou limpar `process_errors` se já resolvidos.
2. **Remover os ~4 registros `TESTE*`** do bronze de produção.
3. **Tratar o órfão `CM3870-VD`** (Asia) e investigar por que 5 rows ficaram sem `product_id`.
4. **Acelerar o pipeline de imagens** (11.641 pendentes) e a promoção para silver (gap de ~62%).
5. **Descontinuar `raw_hash`** (já marcado deprecado) e padronizar `source_channel`.
