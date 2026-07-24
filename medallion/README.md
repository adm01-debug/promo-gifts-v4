# Arquitetura Medallion — PromoGifts

Pipeline de dados em 3 camadas para padronização de catálogo multi-fornecedor.

> ## ⚠️ ATUALIZAÇÃO 2026-06-05 — Pipeline unificado (ADR 0007)
>
> A normalização foi **unificada em um único caminho de-para**, respeitando as
> 3 fases (Bronze → Silver → Gold). A Silver canônica passou a ser
> **`produtos_padronizacao` + `produtos_padronizacao_variantes`** (de-para via
> `supplier_field_mappings` + `fn_apply_transform`).
>
> **Atualização 2026-06-10 (ADR 0008):** a normalização de **variante**
> (`fn_standardize_variant`) e a derivação do pai (`fn_derive_parent_ref`)
> deixaram de ter blocos hardcoded por fornecedor — passaram a ser 100%
> data-driven pelo de-para (`supplier_field_mappings`,
> `target_table='product_variants'`). Paridade verificável via
> `fn_parity_standardize_variant(limit)`. Ver
> `docs/adr/0008-silver-depara-variantes-derive-cor.md`.
>
> **Fluxo oficial (cron `process_pending_batches` a cada 5 min, por fornecedor `auto_sync`):**
> ```
> Bronze: supplier_products_raw (status='pending')
>   └─ fn_standardize_supplier()        Fase 1→2  (Bronze → Silver de-para)
>        ├─ fn_standardize_variant      → produtos_padronizacao_variantes
>        └─ fn_standardize_parent       → produtos_padronizacao
>   └─ fn_promote_supplier()            Fase 2→3  (Silver → Gold)
>        ├─ fn_promote_padronizacao         → products
>        └─ fn_promote_variants_of_parent   → product_variants + variant_supplier_sources
> Gold: products / product_variants / variant_supplier_sources (status='promoted')
> ```
>
> **Aposentados (deprecated, sem dropar):** o motor `fn_process_raw_v2`
> (gravava Bronze→Gold direto), `process_supplier_product(_batch)`, e **todo o
> Silver legado abaixo** (`silver_*` + `fn_*_to_silver` + `fn_silver_to_gold`).
> A seção a seguir descreve a estrutura **legada**, mantida apenas para histórico.
> Ver `docs/adr/0007-silver-de-para-pipeline-unico.md`.

## Estrutura de Camadas (LEGADO — ver aviso acima)

```
Bronze → Silver → Gold → Frontend
```

### 🟤 Bronze — Dados Crus
Tabela: `supplier_products_raw`
- Append-only, nunca modificada
- 1 registro por chamada API, por fornecedor
- `raw_data JSONB` armazena o payload original

### ⚪ Silver — Normalização
Tabelas:
- `silver_products` — produto normalizado (1 por supplier_reference)
- `silver_variants` — variante/SKU normalizada (1 por supplier_sku)
- `silver_print_areas` — área de gravação normalizada
- `silver_images_queue` — fila de imagens para CDN

**Regras fundamentais:**
- Todas dimensões em **CM** (nunca MM)
- Peso sempre em **gramas**
- `gold_product_id = NULL` até promoção via `fn_silver_to_gold()`
- Status pipeline: `raw → normalized → validated → promoted | rejected`

### 🟡 Gold — Frontend
Tabelas existentes: `products`, `product_variants`, `print_area_techniques`, `product_images`
- Fonte única para o frontend
- Somente leitura pelo frontend

---

## Fornecedores (Pipeline Status)

| Fornecedor | Código | Produtos | SKUs | Print Areas | Status |
|---|---|---|---|---|---|
| SPOT/Stricker | STRICKER | 1.200 | 3.612 | 4.438 | ✅ Concluído |
| XBZ Brindes | XBZ | 4.722 | 10.390 | 0 | ✅ Concluído |
| ASIA Import | ASIA | 432 | 1.245 | 0 | ✅ Concluído |
| Só Marcas | SOMARCAS | 1.215 | 1.215 | 1.197 | ✅ Concluído |
| **TOTAL** | | **7.569** | **16.462** | **5.635** | |

---

## Arquivos de Migração

### `migrations/`
- `001_create_silver_layer.sql` — DDL das 4 tabelas Silver + ENUM + triggers

### `functions/`
- `002_fn_spot_to_silver.sql` — Transformação SPOT → Silver
- `003_fn_silver_to_gold.sql` — Promoção Silver → Gold (genérica)
- `004_fn_xbz_to_silver.sql` — Transformação XBZ → Silver
- `005_fn_asia_to_silver.sql` — Transformação ASIA → Silver
- `006_fn_sm_to_silver.sql` — Transformação Só Marcas → Silver

---

## Descobertas Críticas por Fornecedor

### SPOT/Stricker
- `BoxLengthMM`, `BoxWidthMM`, `BoxHeightMM` estão em **METROS** (não MM)
  - Conversão: `× 100` para chegar em CM
- `CustomizationTypes{N}` pode ser multi-valor: `"Silk Screen, Laser CO2"`
- `"Silk screen têxtil"` = variante de Serigrafia para produtos têxteis

### XBZ
- `Altura`, `Largura`, `Profundidade` em **CM** direto
- `Peso` em **gramas**
- `CodigoComposto` = `PREFIXO@BASE-COR` → extrair BASE sem prefixo e sem cor
  - Prefixos: `$@`, `P@`, `P$`, numérico puro
- NCM sem formatação (8 dígitos): `"96081000"`

### ASIA Import
- 1 bronze = 1 variante (produto + cor específica)
- Sem dimensões estruturadas
- `previsao_entrega` = array JSON com datas de reposição
- `var_cor_hex` inclui `#` — remover antes de gravar

### Só Marcas
- 1 bronze = 1 produto (sem variantes de cor distintas)
- Dimensões em texto: `"24,5x7cm"` → parsear regex
- Caixa em MM: `"280x71x69 mm"` → dividir por 10 para CM
- Técnica em texto descritivo: `"Uma gravação a Laser."` → mapear por keyword
- Tem IPI explícito: campo `ipi` com alíquota %
- Preços com e sem gravação disponíveis

---

## Próximos Passos

1. **Promoção Silver → Gold**: executar `fn_silver_to_gold()` para cada produto Silver validado
2. **Fila de imagens**: processar `silver_images_queue` (16.321 imagens) via worker n8n → Cloudflare CDN
3. **Mapeamento de categorias**: expandir `supplier_category_mappings` (68 → cobertura completa)
4. **Rastrear tabelas de preço SPOT**: `TableCodes{N}` (ex: "SCR1", "PDP1") → mapear para `tabela_preco_gravacao_oficial`
5. **Color normalization**: usar `color_equivalences` (148 registros) para mapear cores XBZ/ASIA → `color_variations`
