# Relatório de Testes V4 — Pipeline Silver

## Data: 2026-06-05 | 18 testes em 13 blocos

## Resultado: 16 PASS + 1 FAIL detectado + CORRIGIDO + 1 INFO

---

## Gap Encontrado e Corrigido Nesta Rodada

### Gap 6 — fn_spot_to_silver e fn_sm_to_silver sem utiltários integrados

**Detectado em**: T10 — análise do código das 4 funções de transformação

**Problema**: `fn_spot_to_silver` e `fn_sm_to_silver` não chamam `fn_clean_spot_name` nem `fn_normalize_ncm` diretamente.

Ao contrário de `fn_xbz_to_silver` e `fn_asia_to_silver` (que integram os utilitários inline), SPOT e SM confiam 100% em `fn_normalize_silver_all` para normalizar nomes e NCM retroativamente. Isso cria um **risco operacional**: se alguém rodar `fn_spot_to_silver` (sync de novos produtos) mas esquecer de rodar `fn_normalize_silver_all`, os dados ficam sem normalização até a próxima rodada de manutenção.

**Correção**: Ambas as funções foram atualizadas via patch cirúrgico:
- `fn_spot_to_silver`: `NULLIF(trim(v_raw->>''Name''),'''')` → `fn_clean_spot_name(...)` e `NULLIF(trim(v_raw->>''Taric''),'''')` → `fn_normalize_ncm(...)`
- `fn_sm_to_silver`: `NULLIF(trim(v_raw->>''titulo''),'''')` → `fn_clean_spot_name(...)` e `NULLIF(trim(v_raw->>''ncm''),'''')` → `fn_normalize_ncm(...)`

---

## Achados adicionais desta rodada

### color_hex ASIA: 12 variantes "Transparente" com hex vazio no Bronze
O Bronze ASIA tem `atributos.cor.hexadecimal = ""` (string vazia) para produtos transparentes. O Silver corretamente não armazena string vazia como hex (NULL). Comportamento correto.

### Dimensões XBZ: 10 produtos com dimensões > 500cm
São produtos legítimos: mangueira LED 100m (largura=1000cm = 10m), cascata LED 10.61m, pisca-pisca 10.75m. Um caso (“caneta plástica 1303cm”) é erro no fonte XBZ, não no pipeline.

### Stress idempotência: 10 rodadas consecutivas fn_normalize_silver_all = zero
Confirmado com 10 execuções consecutivas (r1 a r10 = 0). Bug 5 corrigido de forma robusta.

---

## Scorecard Final V4

| Bloco | Categoria | Resultado |
|-------|-----------|----------|
| T01 | Inventário profundo: utilitários nas 4 funções | PASS |
| T02 | Stress idempotência 10 rodadas | PASS |
| T03 | ASIA capacity_ml correto (L→mL) | PASS |
| T04 | ASIA color_hex Transparente = NULL correto | PASS |
| T05 | Distribuição confidence_score | PASS |
| T06 | Dimensões XBZ grandes | INFO: fonte legítimo |
| T07 | Print areas: 99.8% técnica, 100% tabela_preco | PASS |
| T08 | SM multi-técnica com separador ";" | PASS |
| T09 | Zero ALLCAPS STRICKER | PASS |
| T10 | Gap fn_spot_to_silver + fn_sm_to_silver | FAIL → CORRIGIDO |
| T11 | 12 checks FK + unicidade + orphan | PASS (12/12) |
| T12 | Bug2 ASIA: SKU único, 12 cores, batch=0 | PASS |
| T13 | Cobertura todas as métricas | PASS (4/4) |

## Estado Final Silver

| Fornecedor | Produtos | Variantes | NCM | Cat | Mat | Cor | Conf |
|------------|----------|-----------|-----|-----|-----|-----|------|
| STRICKER | 1.200 | 3.612 | 100% | 98.0% | 82.3% | 100% | 0.939 |
| SOMARCAS | 1.215 | 1.215 | 100% | 79.8% | 90.9% | N/A | 0.937 |
| XBZ | 4.722 | 10.390 | 98.9% | 78.7% | 87.3% | 99.0% | 0.862 |
| ASIA | 515 | 1.340 | 100% | 90.9% | 71.1% | 99.7% | 0.777 |

## Funções atualizadas nesta sessão

- `fn_spot_to_silver`: + `fn_clean_spot_name` no nome + `fn_normalize_ncm` no NCM (Taric)
- `fn_sm_to_silver`: + `fn_clean_spot_name` no nome + `fn_normalize_ncm` no NCM

Agora **todas as 4 funções de transformação** chamam os mesmos utilitários de normalização inline.
