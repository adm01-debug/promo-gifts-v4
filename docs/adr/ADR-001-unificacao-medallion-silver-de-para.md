# ADR-001 — Unificação da normalização na Silver de-para (pipeline Medallion 3 fases)

- **Status**: Aceito e implantado (2026-06-05; hardening 2026-06-11)
- **Decisores**: TI Promobrindes
- **PRs**: #675 (unificação), #679 (patches pós-unificação), follow-up 2026-06-11 (hardening pós-simulação)

## Contexto

Existiam **3 caminhos concorrentes** de normalização fornecedor→catálogo:

| Caminho | Funções | Gravava em | Problema |
|---|---|---|---|
| Silver de-para | `fn_standardize_raw/parent/variant` → `fn_promote_padronizacao` | `produtos_padronizacao(+_variantes)` → Gold | nenhum — arquitetura-alvo |
| motor_v2 | `fn_process_raw_v2` | **direto no Gold** | pulava a Silver (violava as 3 fases) |
| Silver legado | `fn_spot/xbz/asia/sm_to_silver` → `fn_silver_to_gold` | `silver_products/variants/print_areas` | hardcoded por fornecedor, tabelas paralelas |

Três escritores no Gold = colisões de regra (locked_fields, sku, custo),
impossibilidade de auditar origem e drift entre caminhos.

## Decisão

**Um único caminho oficial**, com fases obrigatórias e sem atalhos B→G:

```
FASE 1 — BRONZE   supplier_products_raw (status='pending')
   │  fn_standardize_supplier(supplier, limit)        ← orquestrador B→S
   │    ├─ fn_standardize_variant (variante, de-para)
   │    └─ fn_standardize_parent → fn_standardize_raw (produto pai, de-para)
   ▼
FASE 2 — SILVER   produtos_padronizacao (+_variantes) (status='standardized'|'rejected')
   │  fn_promote_supplier(supplier, limit)             ← orquestrador S→G
   │    ├─ fn_promote_padronizacao  (merge soberano: locked_fields nunca sobrescritos)
   │    ├─ fn_promote_variants_of_parent (variantes + variant_supplier_sources)
   │    └─ sweep de variantes órfãs (2026-06-11)
   ▼
FASE 3 — GOLD     products · product_variants · variant_supplier_sources
```

Entry points que delegam ao par oficial (assinaturas preservadas):
- cron `process-pending-products` (*/5) → `process_pending_batches()`
- cron `medallion-promote-tick` (*/10) → `fn_pipeline_promote_tick(300)`
- `fn_process_raw_v2` (DEPRECATED/redirecionada)
- `process_supplier_products_batch` (DEPRECATED/redirecionada)
- `process_supplier_product` (DEPRECATED/neutralizada)

Silver legado (`fn_*_to_silver`, `fn_silver_to_gold`, tabelas `silver_*`):
`COMMENT DEPRECATED`, sem chamadores, mantidos para auditoria, candidatos a DROP.

## Garantias (validadas por simulação massiva — 546 cenários, 2026-06-11)

1. **Idempotência**: UPSERT em todas as folhas; re-import atualiza (não duplica).
2. **Advisory lock por fornecedor**: crons sobrepostos não colidem.
3. **Merge soberano**: campos em `products.locked_fields` jamais sobrescritos.
4. **Atomicidade pai+variantes**: falha de variante reverte o pai (subtransação).
5. **Sem estado invisível**: pós-padronização o pai é `standardized` ou
   `rejected` (com `validation_errors`); `pending` pós-processamento não existe.
6. **Clamps de domínio na Silver**: custo ∈ (0, 99.999.999,99] no pai e
   (0, 999.999,9999] na variante (teto do VSS); estoque `GREATEST(0, x)`.
   Lixo numérico (`1e99`, negativos) não alcança a promoção.
7. **`raw.status='processed'`** somente com variante promovida e
   `process_errors=NULL` (CHECK `chk_spr_no_processed_with_errors`).
8. **De-para genérico**: fornecedor sem branch dedicado lê
   `supplier_field_mappings` + fallbacks convencionais (`nome`, `preco_custo`,
   `estoque`, `sku_fornecedor`, `imagem_principal`) — onboarding sem código.

## Consequências

- Re-padronizações fora do fluxo `pending` (backfills) são promovidas pelo
  sweep de órfãs do `fn_promote_supplier`.
- Pais sem nome são rejeitados **visivelmente** (antes: sucesso falso +
  raw pendente eterno).
- Os 2 crons coexistem; o tick é o "vassoura" de 10 min e o batches o de 5.
- `fn_dryrun_standardize_supplier` executa em subtransação revertida
  (preview sem efeitos), para validar mappings antes de re-sync em massa.

## Incidentes corrigidos pela simulação (2026-06-11)

| # | Bug | Impacto medido | Correção |
|---|---|---|---|
| 1 | `v_fcode/v_fhex` engolidos por comentário (patch 2026-06-09) | 12.3k variantes sem color_code/hex | linhas próprias + backfill |
| 2 | Variantes órfãs nunca promovidas | backfills presos no Silver | sweep no `fn_promote_supplier` |
| 4 | Pai sem mapping → `pending` + sucesso falso | fila invisível | `rejected` + `success=false` |
| 5 | `1e99` estourava `numeric(10,2)` na promoção | pais presos em retry eterno | clamp na padronização |
| 6 | Estoque negativo atravessava ao Gold | `-50` em `product_variants` | `GREATEST(0,stock)` universal |
