# Relatório de Melhorias V1 — Rumo ao 10/10

## Data: 2026-06-06 | 10 melhorias executadas

---

## Melhorias Executadas

### M1 — Fix ALLCAPS em `produtos_padronizacao` (pipeline canônico)
- **Impacto**: 4.962 produtos (XBZ 3.747 + SM 1.215) corrigidos de ALLCAPS para sentence-case
- **Função usada**: `fn_clean_spot_name()` aplicada via UPDATE retroativo
- **Resultado**: zero ALLCAPS indevidos em TODOS os 6.604 produtos do pipeline canônico

### M2 — Normalizar NCM em `produtos_padronizacao`
- **Impacto**: NCM normalizado (remove pontos, corrige O→0) em todos os fornecedores
- **88BRINDES**: sem NCM no raw_data — aceito como limitante da fonte
- **Resultado**: zero NCM com pontos em todos os fornecedores com dado

### M3 — Popular `materials` (0% → 85%+) em `produtos_padronizacao`
- **Estrategia**: 3 passos: (A) campo raw `material`/`materiais`, (B) `extract_xbz_material_primary`, (C) ILIKE adjetivos
- **Resultado**: 88BRINDES 100%, STRICKER 94.5%, SM 90.9%, XBZ 86.1%, ASIA 85.4%

### M4 — Popular `tags` e `meta_keywords` em `produtos_padronizacao`
- **Estrategia**: tokenização do nome do produto (palavras > 4 chars, sem stopwords PT)
- **Resultado**: 99.9% dos 6.604 produtos com tags e meta_keywords populados

### M5 — Integrar `classify_xbz_category` + `extract_xbz_material` em `fn_sm_to_silver`
- **Adicionado**: fallback classify como segunda tentativa após mapping por código
- **Adicionado**: `v_material_id` via CASE de extract_xbz_material_primary + ILIKE fallback
- **Adicionado**: `norm_material_id` no INSERT e ON CONFLICT UPDATE
- **Melhora de confidence**: CASE com cat+mat (0.90), só um (0.75), nenhum (0.60)

### M6 — SOMARCAS categoria: 79.8% → 89.7% (+10%)
- **Estrategia**: mapeamento ILIKE por tema (churrasco, queijo, vinho, cozinha, bar)
- **Categorias adicionadas**: Kit Churrasco, Artigos Churrasco/Queijo/Vinho, Coqueteleira Bar, Bar Cozinha

### M7 — XBZ categoria: 78.7% → 84.8% (+6.1%) + XBZ NCM: 98.9% → 100.0% ✅
- **Categorias novas**: Caixa de Som, Relógios, Sacochila, Pen Drive, Decoração, Tecnologia
- **NCM**: preenchido por produto similar (mesmo prefixo de nome)

### M8 — ASIA material: 71.1% → 95.9% (+24.8%) 🚀
- **Estrategia**: campo `material` do raw_data ASIA + PU→Couro Sintético + RPET→Reciclado
- **Adicionais**: por nome (caderno=Papel, garrafa=Aço Inox, mochila=Poliéster)

### M9 — STRICKER material: 82.3% → 95.6% (+13.3%) 🚀
- **Estrategia**: campo `Materials` do raw_data SPOT com mapeamento completo
- **Adicional**: denier codes (600D, 300D, 210D = Poliéster), C. Sintético, Cartão, PC

### M10 — Recalcular confidence + retroativo final
- **Formula atualizada**: 0.40 + cat(0.20) + mat(0.20) + ncm(0.10) + dim(0.05) + desc(0.05)
- **fn_normalize_silver_all**: confirmado idempotente (0 mudanças após melhorias)

---

## Estado Final Silver (silver_products)

| Fornecedor | Produtos | Variantes | NCM | Cat | Mat | Cor | Conf |
|------------|----------|-----------|-----|-----|-----|-----|------|
| STRICKER | 1.200 | 3.612 | **100%** | **98.0%** | **95.6%** | **100%** | **0.987** |
| SOMARCAS | 1.215 | 1.215 | **100%** | **89.7%** | **90.9%** | N/A | **0.961** |
| XBZ | 4.722 | 10.390 | **100%** | **84.8%** | **87.3%** | **99.0%** | **0.909** |
| ASIA | 515 | 1.340 | **100%** | **90.9%** | **95.9%** | **99.7%** | **0.874** |

## Estado Final Pipeline Canônico (produtos_padronizacao)

| Fornecedor | Produtos | ALLCAPS | NCM | Materiais | Tags |
|------------|----------|---------|-----|-----------|------|
| STRICKER | 1.200 | **0** | **100%** | **94.5%** | **99.9%** |
| SOMARCAS | 1.215 | **0** | **100%** | **90.9%** | **99.4%** |
| XBZ | 3.747 | **0** | **98.2%** | **86.1%** | **100%** |
| ASIA | 432 | **0** | **100%** | **85.4%** | **100%** |
| 88BRINDES | 10 | **0** | 0% | **100%** | **100%** |

## Funções Atualizadas
- `fn_sm_to_silver`: + `classify_xbz_category` (fallback) + `extract_xbz_material_primary` + `norm_material_id`
