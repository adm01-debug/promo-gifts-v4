# Arquitetura Bronze → Prata → Gold
## Dimensões Físicas de Componentes de Kits Nativos

**Data:** 2026-06-10 · **Status:** Implementado em produção

## Objetos criados em produção

### Tabelas
- `kit_component_enrichment_raw` (BRONZE) — 3.419 linhas
- `kit_component_padronizacao` (PRATA) — 3.419 linhas, status pending→approved→promoted

### Colunas adicionadas em product_kit_components (GOLD)
- `shape_type`, `diameter_mm`, `circumference_mm`
- `pkg_ext_length_mm`, `pkg_ext_width_mm`, `pkg_ext_height_mm`
- `pkg_int_length_mm`, `pkg_int_width_mm`, `pkg_int_height_mm`, `pkg_int_diameter_mm`
- `pkg_weight_g`, `pkg_material`, `pkg_color`, `pkg_finish`
- `enrichment_status` (missing/partial/complete), `enrichment_source`, `enrichment_confidence`, `padronizacao_id`

### Views
- `v_kit_component_complete` — 44 colunas, volumes em cm³
- `v_kit_enrichment_dashboard` — % completude por kit

### Funções
- `fn_standardize_kit_component` — Bronze→Prata
- `fn_promote_kit_component_padronizacao` — Prata→Gold
- `fn_process_all_kit_component_enrichments` — lote
- `rpc_enrich_kit_component` — input manual, auto-approve
- `fn_extract_dimensions_from_text` — resultado de IA
- `fn_auto_classify_kit_product` — trigger em products
- `fn_calculate_kit_dimensions` — peso+emb+completude

## Script AI Enrichment
Ver `scripts/kit-ai-enrichment.js`
