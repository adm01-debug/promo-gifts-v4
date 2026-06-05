# Estado Final — Arquitetura Medallion PromoGifts

## Snapshot: Junho 2026

## Camada Silver — Contagens

| Tabela | Registros | Status |
|--------|-----------|--------|
| `silver_products` | 7.569 | 100% normalized |
| `silver_variants` | 16.462 | 100% normalized |
| `silver_print_areas` | 5.927 | 99.80% técnica mapeada, 100% tabela_preco |
| `silver_images_queue` | 13.747 | 0 duplicatas, pending→CDN |

## Por Fornecedor

| Fornecedor | Produtos | Variantes | Print Areas | Categorias | Cores |
|------------|----------|-----------|-------------|------------|-------|
| STRICKER | 1.200 | 3.612 | 4.438 | 98% | 100% |
| XBZ | 4.722 | 10.390 | 0 | 70% | 99% |
| ASIA | 432 | 1.245 | 0 | 48% | 99.8% |
| SOMARCAS | 1.215 | 1.215 | 1.489 | 63% | 0% (sem cor) |

## Melhorias Implementadas

### Funções
- `fn_spot_to_silver` — técnicas completas: Laser circular, Hot stamping, UV Circular (360), Silk Screen Circular
- `fn_sm_to_silver` — multi-técnica nativa: split por `;` cria print_areas para cada componente
- `fn_silver_to_gold` — promoção Silver→Gold com variantes (testada, 5 produtos SPOT)

### Dados
- **Cores**: SPOT 100%, ASIA 99.8%, XBZ 99% via `color_equivalences`
- **Tabela preço**: 100% das 5.927 print_areas com `gold_tabela_preco_id`
- **SM Multi-técnica**: 365 áreas extras para kits com múltiplos componentes
- **Imagens**: 625 URLs duplicadas removidas → 13.747 únicas
- **Categorias**: STRICKER 98% via TypeCode, XBZ/SM/ASIA via keywords

## Próximos Passos

1. **Promoção em lote**: executar `fn_silver_to_gold()` para todos os 7.569 produtos
2. **Worker imagens**: processar 13.747 imagens Silver → Cloudflare CDN
3. **Categorias ASIA/SM/XBZ**: expandir cobertura via supplier_categories manual ou LLM
4. **Monitoramento**: criar views/dashboards para acompanhar cobertura por fornecedor
