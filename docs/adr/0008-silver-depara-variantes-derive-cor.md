# ADR 0008 — Normalização de variante 100% de-para na Silver

**Status:** Accepted · **Date:** 2026-06-10 · **Segue:** ADR 0007

## Contexto

O ADR 0007 unificou o pipeline Medallion no caminho Silver de-para
(`produtos_padronizacao` + `_variantes`), mas deixou um **follow-up explícito**:

> ⚠️ `fn_standardize_variant` ainda é hardcoded por fornecedor (vive na Fase 2,
> não viola as 3 fases). Conversão para de-para puro + preenchimento de lacunas
> ficou como follow-up com testes de paridade.

Na prática, três pontos da normalização de **variante** ainda decidiam por
`IF supplier_id = '<uuid>'`:

1. `fn_standardize_variant` — extração de `sku`, `supplier_sku`, cor
   (`code`/`api_id`/`name`/`hex`), `stock_quantity` e `cost_price` por blocos
   por fornecedor (chaves `ColorCode`, `Price1`, `CodigoComposto`, `PrecoVenda`,
   `var_cor_nome`, `preco`, `titulo`, `produtos_similares`…).
2. `fn_derive_parent_ref` — regra de derivação do produto-pai por UUID.
3. A **seleção de quais chaves** alimentam a equivalência de cor
   (`fn_match_supplier_color`) estava implícita nesses blocos.

O produto-pai (`fn_standardize_raw`) já era de-para puro
(`supplier_field_mappings` + `fn_apply_transform`).

## Decisão

**Mover toda a normalização de variante para o de-para**, espelhando o que o
pai já fazia. A configuração por fornecedor passa a viver em **dados**
(`supplier_field_mappings`, `target_table='product_variants'`), não em código.

- **Seed de-para de variante** (`target_field`: `sku`, `supplier_sku`,
  `color_code`, `color_api_id`, `color_name`, `color_hex`, `stock_quantity`,
  `cost_price`, `parent_reference`) para SPOT/XBZ/ASIA/Só Marcas, codificando
  exatamente as chaves/transforms antes hardcoded.
- **`fn_standardize_variant`** reescrita como motor genérico (loop sobre os
  mappings + `fn_apply_transform`), sem nenhum branch por UUID.
- **`fn_derive_parent_ref`** lê a regra do de-para (`parent_reference`):
  `source_field` = chave autoritativa do pai no raw + `transform_config.fallback`
  ∈ {`identity`, `strip_hyphen_suffix`, `asia_hyphen_or_suffix_P`}.
- **`fn_apply_transform`** ganha o resolver `custom → fn_extract_color_from_title`
  (cor de Só Marcas, derivada do título).
- Campos sintéticos supplier-agnostic no documento de trabalho: `_ref`
  (= `supplier_reference`, fonte de sku/supplier_sku) e `_sm_hex`
  (= `fn_sm_hex_from_similares`, hex de Só Marcas pela rede `produtos_similares`).
- **`fn_parity_standardize_variant(limit)`** — função read-only que compara a
  extração antiga (congelada) vs. a nova (de-para) campo a campo. Esperado: zero
  divergências.

A equivalência de cor (`fn_match_supplier_color` → `fn_match_canonical_color`),
as coerções seguras (`fn_safe_int/num`) e o UPSERT permanecem idênticos:
o comportamento é preservado **por construção**.

## Justificativa

- Fonte de verdade única para normalização: adicionar/ajustar fornecedor vira
  **inserir linhas no de-para**, sem editar funções (MCP-first, ADR 0006).
- `fn_standardize_variant` deixa de crescer um `ELSIF` por fornecedor novo.
- Paridade verificável e migração reversível (seed isolado + funções com
  `CREATE OR REPLACE`).

## Consequências

- ✅ Variante e pai compartilham o mesmo motor de-para; zero hardcode por UUID.
- ✅ Regra do pai e seleção de chaves de cor agora são dados auditáveis.
- ⚠️ Mudança benigna de semântica: strings vazias na origem viram `NULL`
  (o loop ignora valores em branco) em vez de `''`. Sem impacto nos dados reais
  (campos vazios não casam catálogo); a paridade tolera `'' ≈ NULL`.
- ⚠️ A cor de Só Marcas (nome via título, hex via `produtos_similares`)
  continua sendo uma derivação de 2 entradas: é expressa por `custom`
  transform + campo sintético `_sm_hex`, não por regra ad-hoc na função.
- Aplicação: somente **migrations + PR** (não aplicado ao banco vivo nesta
  entrega). Rodar `fn_parity_standardize_variant` antes de deixar o cron usar a
  nova função em produção.

## Migrations

`20260610120000`..`20260610120500` — `silver_depara_01..06`
(motor + helper + seed + derive_parent config-driven + variant data-driven +
paridade).

## Referências

- ADR 0007 — pipeline único Silver de-para
- ADR 0006 — operação MCP-first de migrations
- `medallion/README.md` — visão das camadas
