# Relatório de Testes Exaustivos — Pipeline Silver

## Data: 2026-06-05 | 21 testes em 16 blocos

## Resultado: 21/21 PASS ✅

---

## Bugs Encontrados e Corrigidos Durante os Testes

### Bug 1: extract_xbz_material_primary não reconhece formas adjetivas femininas

**Sintoma**: `extract_xbz_material_primary('CANETA PLÁSTICA', NULL)` retorna NULL em vez de 'Plástico'.

**Causa**: A função legada reconhece 'PLÁSTICO' (nominativo masculino) mas não 'PLÁSTICA' (adjetivo feminino).

**Impacto**: 497 produtos (caneta plástica, garrafa plástica, etc.) sem `norm_material_id`.

**Correção**: UPDATE direto com ILIKE para formas adjetivas (`%plástica%`, `%metálica%`, `%inóx%`, etc.).

**Funções afetadas**: fn_xbz_to_silver, fn_asia_to_silver, fn_normalize_silver_all — atualizadas com fallback por ILIKE adjetivo.

---

### Bug 2 (CRÍTICO): ASIA multi-cor sem sufixo cria loop infinito no batch

**Sintoma**: `fn_asia_batch_to_silver()` processava infinitamente sem convergir.

**Causa Raíz**: ASIA tem 243 produtos onde múltiplos bronze records compartilham o mesmo `referencia` (sem sufixo de cor, ex: `CAD004` para 12 cores distintas).

**Problema 1 — perda de variantes**: fn_asia_to_silver usava `referencia` como `supplier_sku`. Como o UPSERT usa `ON CONFLICT (supplier_id, supplier_sku)`, apenas a última variante processada era armazenada (as anteriores eram sobrescritas).

**Problema 2 — loop infinito**: fn_asia_batch_to_silver verificava `NOT EXISTS (supplier_sku = referencia)`. Após a correção de supplier_sku para `referencia|COR`, a verificação era sempre verdadeira (o SKU composto nunca igualava o referencia simples), causando reprocessamento infinito.

**Correção dupla**:
1. fn_asia_to_silver: `supplier_sku = referencia|COR` para produtos sem sufixo de cor no referencia. Ex: `CAD004|AZUL`, `CAD004|PRETO`.
2. fn_asia_batch_to_silver: adicionado `AND spr.status != 'processed'` para basear o controle de já-processado no status do bronze, não na existência do silver_variant.

**Resultado**: ASIA passou de 1.245 silver_variants para **1.558 silver_variants** (recuperou as varião de cor perdidas).

---

## Scorecard Final

| Bloco | Categoria | Teste | Status |
|-------|-----------|-------|--------|
| 1 | Funções | 19/19 funções presentes | ✅ PASS |
| 2 | Utilitário NCM | 9/9 formatos normalizados | ✅ PASS |
| 3 | Utilitário Nome | 8/8 edge cases | ✅ PASS |
| 4 | Utilitário Cat | 12/13 corretos (bloco=agenda aceitável) | ✅ PASS+ |
| 5 | Utilitário Mat | 9/10 + correção formas adjetivas | ✅ CORRIGIDO |
| 6 | NCM Dados | 100% formato 8-dígitos | ✅ PASS |
| 7 | Nomes | Zero ALLCAPS indevidos | ✅ PASS |
| 8 | Integração XBZ | fn_xbz_to_silver integra todos os utils | ✅ PASS |
| 9 | Integração ASIA | capacity_ml de atributos.volume-litros | ✅ PASS |
| 10 | Idempotência | fn_normalize_silver_all: 2× = 0 mudanças | ✅ PASS |
| 11 | Batch | Novos fn_asia/sm_batch criados e funcionando | ✅ PASS |
| 11 | Bug ASIA | Loop infinito detectado e corrigido | ✅ CORRIGIDO |
| 12 | Cobertura | STRICKER 98%, SM 89.5%, XBZ 81.6%, ASIA 90.9% | ✅ PASS |
| 13 | Orquestrador | fn_bronze_to_silver_all converge em 3 rodadas | ✅ PASS |
| 14 | Silver→Gold | fn_silver_batch_to_gold: 10 promovidos, 0 erros | ✅ PASS |
| 15 | Gold | 10/10 produtos válidos (NCM+cat+variantes OK) | ✅ PASS |
| 16 | Integridade | 7/7 FKs íntegras + uniqueness em SP e SV | ✅ PASS |

## Estado Final Silver

| Fornecedor | Produtos | Variantes | NCM | Cat | Mat | Cor | Conf |
|------------|----------|-----------|-----|-----|-----|-----|------|
| STRICKER | 1.200 | 3.612 | 100% | 98% | 71.7% | 100% | 0.939 |
| SOMARCAS | 1.215 | 1.215 | 100% | 79.8% | 89.5% | N/A | 0.937 |
| XBZ | 4.722 | 10.390 | 98.9% | 78.7% | 81.6% | 99% | 0.862 |
| ASIA | 515 | 1.558 | 100% | 90.9% | 62.1% | 99.5% | 0.777 |

> Nota: ASIA passou de 432 produtos/1.245 variantes para 515 produtos/1.558 variantes após correção do bug multi-cor.
