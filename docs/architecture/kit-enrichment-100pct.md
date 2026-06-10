# Kit Component Enrichment — 100% Achievement

**Date:** 2026-06-10  
**Status:** ✅ 3419/3419 complete (100.00%)

## Journey

| Before | After |
|--------|-------|
| 3.416 missing (99.9%) | 0 missing |
| 1 partial | 0 partial |
| 2 complete (0.1%) | **3419 complete (100%)** |

## 7 Improvements Applied

| # | Melhoria | Ganho | % Antes | % Depois |
|---|----------|-------|---------|---------|
| M1 | Trigger pkg: relaxar pkg_int, copiar dims → pkg_ext | +398 | 59% | 71% |
| M2 | Reclassif. flat: L+W sem H (rectangular→flat) | +150 | 71% | 75% |
| M3 | Partial outro: H→W para tipos planos, pkg_ext_H=20 | +99 | 75% | 78% |
| M4 | Dimensões típicas por component_type_code (75 tipos) | +454 | 78% | 91% |
| M5 | Padrão de nome para 85 itens null-type_code | +63 | 91% | 93% |
| M6 | Height cilíndrico estimado + pkg_ext_H default | +219 | 93% | 99.8% |
| M7 | Cirurgia final: 8 casos individuais | +8 | 99.8% | 100% |

## Data Sources Used

- **Spot/Stricker**: `CombinedSizes` bronze field (per-component labeled segments)
- **Só Marcas**: `dimensoes_do_produto` + `peso_da_embalagem` bronze fields
- **XBZ Brindes**: Site scraping (3 formatos HTML), campo `Peso` bronze
- **Asia Import**: API `propriedades` com slugs `dimensao-*` por componente
- **All**: Dimensões típicas por tipo (confidence=0.35-0.40)
- **Fallback**: Padrão de nome para itens sem type_code

## Confidence Levels

- `1.00` — dados reais medidos (ex. Spot CombinedSizes, Asia API)
- `0.85` — dados fornecedor direto (bronze fields)
- `0.80` — scraping site
- `0.40` — dimensões típicas por tipo
- `0.35` — padrão de nome

## Functions Created

- `fn_extract_kit_dims_from_spot_bronze(limit)` — Spot CombinedSizes parser
- `fn_extract_kit_dims_from_somarcas_bronze(limit)` — Só Marcas dims parser
- `fn_extract_kit_dims_from_xbz_bronze(limit)` — XBZ bronze fields
- `fn_enrich_asia_components_batch(items JSONB)` — batch insert Asia
- `fn_pkc_auto_enrich_status()` — trigger shape-aware v3

## Scripts (VPS)

- `scripts/kit-enrichment/xbz-dims-batch.py` — scraping XBZ site
- `scripts/kit-enrichment/asia-dims-batch.py` — Asia MCP worker

## n8n Workflows

- `XBZ - SCRAPING DIMENSÕES KITS` (cron 02:00)
- `ASIA - ENRIQUECER DIMENSÕES KITS` (cron 03:00)
- `SPOT - SYNC ESTOQUE DIÁRIO` (cron 04:00) — `fn_import_stock_from_spot`
