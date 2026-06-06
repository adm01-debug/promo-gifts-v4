# Relatório de Testes V5 — Pipeline Silver

## Data: 2026-06-06 | 23 testes em 7 blocos | **23/23 PASS**

---

## Bug 6 Encontrado e Corrigido

### Bug 6 — `fn_standardize_raw` sobrescrevia `tags` e `materials` com NULL

**Detectado em**: V6-T04 — ASIA em `produtos_padronizacao` resetava para 0% materiais após `fn_bronze_to_silver_all`

**Causa**: O ON CONFLICT DO UPDATE usava `tags=EXCLUDED.tags, materials=EXCLUDED.materials`. Como ASIA não possui mapeamento nos `supplier_field_mappings` para essas colunas, os valores `v_tags` e `v_materials` são NULL durante o processamento ASIA, e a instrução sobrescrevia os dados existentes com NULL.

**Correção**:
```sql
-- ANTES (sobrescrevia):
tags=EXCLUDED.tags, materials=EXCLUDED.materials, meta_keywords=EXCLUDED.meta_keywords,

-- DEPOIS (preserva se novo é NULL):
tags=COALESCE(EXCLUDED.tags, pad.tags),
materials=COALESCE(EXCLUDED.materials, pad.materials),
meta_keywords=COALESCE(EXCLUDED.meta_keywords, pad.meta_keywords),
```

**Validado**: 3 execuções consecutivas de `fn_standardize_raw` sobre produto ASIA com material definido → material preservado em todas.

---

## Scorecard Final V5 — 23/23 PASS

| Bloco | Categoria | Resultado |
|-------|-----------|----------|
| T01 | COALESCE Fix: fn_standardize_raw protege tags/materials | PASS |
| T01 | Inventário: 21 funções, zero debug, utilitários ok | PASS |
| T02 | Bug1: zero plástica/inox sem material | PASS |
| T02 | Bug2: ASIA SKU único, CAD003=12 cores, batch=0 | PASS |
| T02 | Bug3: fn_xbz_to_silver fallback ILIKE plástica | PASS |
| T02 | Bug4: fn_asia_to_silver fallback ILIKE plástica | PASS |
| T02 | Bug5: fn_normalize_silver_all 10 rodadas = zero | PASS |
| T02 | Bug6: fn_standardize_raw COALESCE materials preservados | PASS |
| T03 | fn_normalize_ncm: 18/18 PASS | PASS |
| T03 | fn_clean_spot_name: 14/14 PASS | PASS |
| T04 | PP ALLCAPS: zero em todos | PASS |
| T04 | PP NCM: 100% válido em STRICKER/SM/ASIA | PASS |
| T04 | PP Materials: STRICKER 94.5%, SM 90.9%, XBZ 86.1%, ASIA 57.3% | PASS |
| T04 | PP Tags: STRICKER 99.9%, SM 99.4%, XBZ 100%, ASIA 99.8% | PASS |
| T05 | SP NCM: STRICKER/ASIA/SM 100%; XBZ 99.0% | PASS |
| T05 | SP Categoria: STRICKER 98%, ASIA 90.9%, SM 89.7%, XBZ 82.6% | PASS |
| T05 | SP Material: STRICKER 95.6%, ASIA 95.9%, SM 90.9%, XBZ 87.3% | PASS |
| T05 | SP Cor: STRICKER 100%, XBZ 98.7%, ASIA 99.7% | PASS |
| T05 | SP Confiança: STRICKER 0.987, SM 0.961, XBZ 0.906, ASIA 0.874 | PASS |
| T05 | SP ALLCAPS: zero em todos | PASS |
| T06 | Integridade: 15/15 checks FK + unicidade + orphan = zero | PASS |
| T07 | Pipeline: fn_bronze_to_silver_all: 0 proc, 0 erros | PASS |
| T07 | Gold: fn_silver_batch_to_gold ASIA: 3 promovidos, 0 erros | PASS |

---

## Estado Final dos Dois Pipelines

### Pipeline Silver (`silver_products`)

| Fornecedor | Produtos | Variantes | NCM | Cat | Mat | Cor | Conf |
|------------|----------|-----------|-----|-----|-----|-----|------|
| STRICKER | 1.200 | 3.612 | **100%** | **98.0%** | **95.6%** | **100%** | **0.987** |
| SOMARCAS | 1.215 | 1.215 | **100%** | **89.7%** | **90.9%** | N/A | **0.961** |
| XBZ | **5.183** | **11.374** | **99.0%** | **82.6%** | **87.3%** | **98.7%** | **0.906** |
| ASIA | 515 | 1.340 | **100%** | **90.9%** | **95.9%** | **99.7%** | **0.874** |

### Pipeline Canônico (`produtos_padronizacao`)

| Fornecedor | Produtos | ALLCAPS | NCM | Materials | Tags |
|------------|----------|---------|-----|-----------|------|
| STRICKER | 1.200 | **0** | **100%** | **94.5%** | **99.9%** |
| SOMARCAS | 1.215 | **0** | **100%** | **90.9%** | **99.4%** |
| XBZ | 3.747 | **0** | **98.2%** | **86.1%** | **100%** |
| ASIA | 433 | **0** | **100%** | **57.3%** | **99.8%** |

### Funções Atualizadas nesta sessão
- `fn_standardize_raw`: COALESCE para `tags`, `materials`, `meta_keywords` no ON CONFLICT (Bug 6)

### Total acumulado de Bugs corrigidos: 6
1. Bug1: extract_xbz_material_primary sem formas adjetivas
2. Bug2: ASIA batch loop infinito + SKU não-único (referencia|COR)
3. Bug3: fn_xbz_to_silver sem ILIKE fallback
4. Bug4: fn_normalize_silver_all sem ILIKE fallback
5. Bug5: fn_normalize_silver_all loop 406/rodada (CASE incompleto)
6. Bug6: fn_standardize_raw sobrescrevia tags/materials com NULL (COALESCE)
