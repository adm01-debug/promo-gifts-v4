# Plano — Enriquecedores Gold que leem Bronze (estoque & dimensões)

> Auditoria exaustiva do `pg_proc` (2026-06-05) após a unificação Medallion.
> Projeto `doufsxqlfjyuvxuezpln`. Investigação ao vivo.

Depois de adaptar a cadeia "staging" (Fase 7), **o banco tem ZERO caminhos
Bronze→Gold de _identidade_ de produto/variante** (única função que insere em
`products` lendo raw é `fn_promote_padronizacao` = Silver→Gold legítimo).

Restam **2 enriquecedores ATIVOS** que leem Bronze e escrevem Gold — fora do
fluxo de identidade. Este doc investiga e planeja a migração de cada um.

---

## 1. Estoque XBZ — `fn_import_stock_xbz` (cron `xbz-stock-sync`, `*/15`)

**O que faz (ao vivo):**
- Lê `supplier_products_raw.stock_data` (coluna JSONB **dedicada a estoque**,
  separada de `raw_data` de produto) para o fornecedor XBZ.
- `UPDATE variant_supplier_sources` → `quantity`, `stock_main_warehouse`,
  `next_date_1`, `source='xbz_api'` (match por `supplier_sku`).
- Fecha o Bronze (`stock_status='processed'`).
- Rollup → `products.stock_quantity` / `is_stockout`.

**Veredito:** **alinhado, não é violação.** Escreve na **camada canônica de
sourcing** (`variant_supplier_sources` = fonte-da-verdade de estoque, por ADR
0007 §4). Não cria produto/variante; só atualiza estoque de VSS já existentes.
É um **fast-path de estoque** (alta frequência, dado volátil).

**Plano (baixa prioridade):**
- **Manter** como fast-path documentado. Rotear estoque por
  `produtos_padronizacao_variantes` antes de promover adicionaria latência a
  cada 15 min sem ganho real.
- _Higiene opcional:_ padronizar o valor de `source` (`'xbz_api'` vs `'silver'`)
  e generalizar o padrão para outros fornecedores com estoque incremental
  (hoje só XBZ tem o fast-path).

---

## 2. Dimensões — trigger `trg_auto_sync_product_dimensions`

**O que faz (ao vivo):**
- `AFTER INSERT/UPDATE` em `supplier_products_raw`.
- Quando `product_id` é vinculado (ou `raw_data->>'CombinedSizes'` muda),
  chama `fn_sync_single_product_dimensions(product_id, raw_data)` →
  `UPDATE products` (length/width/height) **direto no Gold**.

**Veredito:** **redundante / impureza de fase.** A `fn_standardize_raw`
(de-para) já normaliza `length_cm/width_cm/height_cm/dimensions_display` na
Silver, e `fn_promote_padronizacao` já as promove ao Gold. O trigger é um
caminho **Bronze→Gold paralelo** só para dimensões.

**Plano (prioridade média — requer parity test):**
1. **Parity check**: comparar, por fornecedor, as dimensões geradas por
   `fn_standardize_raw` (de-para) vs as do trigger — com atenção ao caso
   especial **`CombinedSizes`/kits do XBZ** que o trigger trata.
2. Se o de-para **cobre** tudo → **`DROP TRIGGER trg_auto_sync_product_dimensions`**
   (dimensões passam a fluir 100% Bronze→Silver→Gold). Marcar
   `fn_sync_single_product_dimensions` / `fn_update_product_dimensions` /
   `fn_normalize_product_dimensions` como `DEPRECATED`.
3. Se houver caso especial não coberto (ex.: parsing de `CombinedSizes` para
   kits) → portar a lógica para um `transform_type='custom'` em
   `supplier_field_mappings` (chamando o parser existente) e **só então**
   aposentar o trigger.
4. Risco: **médio** (trigger ativo no caminho de ingestão). Fazer atrás de um
   teste de paridade dedicado e numa janela controlada.

---

## Resumo

| Enriquecedor | Status atual | Ação recomendada | Prioridade |
|---|---|---|---|
| `fn_import_stock_xbz` (estoque) | Escreve na camada canônica VSS | Manter (fast-path documentado) | Baixa |
| `trg_auto_sync_product_dimensions` (dimensões) | Bronze→Gold paralelo, redundante | Parity test → aposentar trigger; dimensões via Silver | Média |

> Itens fora de escopo desta rodada (backlog "de-para completo"): normalização
> de **categorias**, **materiais**, **áreas de gravação** e **imagens** no fluxo
> de-para da Silver (hoje cobertura parcial em `supplier_field_mappings`).
