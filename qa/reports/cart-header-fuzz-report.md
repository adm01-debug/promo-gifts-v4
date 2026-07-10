# CartHeader — Relatório de Invariantes

_Gerado em 2026-07-10T13:53:15.685Z_

## Resumo

| Métrica | Valor |
|---|---|
| Total de testes | 47 |
| ✅ Passou | 47 |
| ❌ Falhou | 0 |
| ⏭️ Pulou | 0 |
| Tempo total | 99 ms |

## Invariantes cobertas

| # | Invariante | Testes | ✅ | ❌ | Duração |
|---|---|---|---|---|---|
| 1 | Ações ancoradas à direita | 1 | 1 | 0 | 1 ms |
| 2 | Ações nunca comprimem | 0 | 0 | 0 | 0 ms |
| 3 | Wrap seguro em qualquer viewport | 3 | 3 | 0 | 9 ms |
| 4 | Gap progressivo por breakpoint | 0 | 0 | 0 | 0 ms |
| 5 | Prazo em 2 linhas estruturais | 3 | 3 | 0 | 4 ms |
| 6 | Ordem semântica empresa→prazo→ações | 5 | 5 | 0 | 3 ms |
| 7 | A11y (label↔input, aria-*) | 10 | 10 | 0 | 65 ms |
| 8 | Sem cores hardcoded | 4 | 4 | 0 | 1 ms |
| 9 | Schema com valores extremos | 10 | 10 | 0 | 7 ms |
| 10 | Badge XOR erro (mutuamente exclusivos) | 4 | 4 | 0 | 0 ms |
| 11 | Transições de status por dia | 7 | 7 | 0 | 9 ms |

## Especificação de cobertura fuzz

- **Viewports simulados**: 25 (320 → 2560 px)
- **Estados condicionais**: 80 (logo × items × badge × erro × 5 tamanhos de nome)
- **Simulações principais**: 25 × 80 = **2000**
- **Mutações de fonte**: 300 permutações × 13 tokens = 3900 asserts
- **Simulações de wrap CSS numérico**: 50
- **Datas fuzz (schema)**: 200 aleatórias em ±400 dias
