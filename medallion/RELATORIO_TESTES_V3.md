# Relatório de Testes V3 — Pipeline Silver

## Data: 2026-06-05 | 31 testes em 17 blocos

## Resultado: 30 PASS + 1 INFO (pré-existente) + zero novos bugs

---

## Achados desta Rodada

### Achado 1 — fn_normalize_ncm rejeita '00000000' corretamente

O teste esperava que '00000000' retornasse '00000000', mas a função tem `IF clean = '00000000' THEN RETURN NULL` explicitamente. NCM todo-zeros é um placeholder inválido no sistema fiscal brasileiro, então o comportamento está correto. Expectativa do teste era errada, não a função.

### Achado 2 — SOMARCAS: 1.215 SKUs já existem no Gold (pré-Silver)

**Não é um bug do pipeline Silver.** SOMARCAS foi importado para Gold via um pipeline anterior ao desenvolvimento da camada Silver. Os 1.215 SKUs (formato `PD-XXXXX`) já existem em `product_variants` com a constraint UNIQUE `product_variants_sku_key`. A promoção via `fn_silver_batch_to_gold` falha apenas para SOMARCAS por essa razão.

**ASIA** (zero conflitos pré-existentes) promoveu 5 produtos com 0 erros.

---

## Confirmação de Todos os Bugs Corrigidos

| Bug | Descrição | Prová | Status |
|-----|-----------|-------|--------|
| Bug 1 | extract_xbz_material_primary formas adjetivas | Dados: zero plastica/inox sem mat | CONFIRMADO CORRIGIDO |
| Bug 2 | ASIA batch loop + SKU não-único | CAD004=12 cores, batch=0, zero dups | CONFIRMADO CORRIGIDO |
| Bug 3 | fn_xbz_to_silver sem ILIKE fallback | Código + reprocessamento manual | CONFIRMADO CORRIGIDO |
| Bug 4 | fn_normalize_silver_all sem ILIKE | Código verificado | CONFIRMADO CORRIGIDO |
| Bug 5 | fn_normalize_silver_all loop 406/rodada | 5 rodadas consecutivas = zero | CONFIRMADO CORRIGIDO |

---

## Scorecard Final

| Bloco | Categoria | Resultado |
|-------|-----------|----------|
| T01 | Inventário: 20 funções sem debug | PASS |
| T02 | Bugs 2-5 confirmados corrigidos | PASS (4/4) |
| T03 | fn_normalize_ncm: 17/18 (00000000=OK) | PASS |
| T04 | fn_clean_spot_name: 14/14 | PASS |
| T05 | Dados plástica/inox/metálica | PASS |
| T06 | Idempotência: 5 rodadas = zero | PASS |
| T07 | ASIA Bug2: SKU único, CAD004=12 cores | PASS (4/4) |
| T08 | NCM 8-dígitos: todos fornecedores | PASS |
| T09 | Nomes: zero ALLCAPS | PASS |
| T10 | 11 materiais novos (Papel/TNT/etc) | PASS |
| T11 | 12 checks FK + unicidade + orphan | PASS (12/12) |
| T12 | Cross-validate: 50 amostras 100% | PASS |
| T13 | fn_bronze_to_silver_all convergido | PASS |
| T14 | Silver→Gold ASIA 5 produtos | PASS |
| T15 | Cobertura melhorada pós-Bug5 | PASS |
| T16 | fn_xbz_to_silver: regressao OK | PASS |
| T17 | fn_asia_to_silver: CAD004 SKU composto | PASS |

## Estado Final Silver (após 3 rodadas de testes)

| Fornecedor | Produtos | Variantes | NCM | Cat | Mat | Cor | Conf |
|------------|----------|-----------|-----|-----|-----|-----|------|
| STRICKER | 1.200 | 3.612 | 100% | 98.0% | 82.3% | 100% | 0.939 |
| SOMARCAS | 1.215 | 1.215 | 100% | 79.8% | 90.9% | N/A | 0.937 |
| XBZ | 4.722 | 10.390 | 98.9% | 78.7% | 87.3% | 99.0% | 0.862 |
| ASIA | 515 | 1.340 | 100% | 90.9% | 71.1% | 99.7% | 0.777 |

### Observações
- **Materiais**: Coverage cresceu após Bug5 (CASE expandido de 25 para 40+ materiais)
  - STRICKER: 71.7% → 82.3%
  - SM: 89.5% → 90.9%
  - XBZ: 81.6% → 87.3%
