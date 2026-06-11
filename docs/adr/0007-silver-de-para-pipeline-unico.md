# ADR 0007 — Pipeline Único de Normalização na Silver de-para (3 fases)

**Status:** Accepted · **Date:** 2026-06-05

## Contexto

A normalização/padronização de produtos multi-fornecedor convivia em **três
caminhos concorrentes**, descobertos em inspeção ao vivo (`doufsxqlfjyuvxuezpln`):

1. **Silver de-para (oficial)** — `produtos_padronizacao` + `_variantes`,
   alimentada por `fn_standardize_raw/parent/variant` (de-para via
   `supplier_field_mappings` + `fn_apply_transform`) e promovida por
   `fn_promote_padronizacao` + `fn_promote_variants_of_parent`
   (orquestrada por `fn_promote_supplier`).
2. **motor_v2** — `fn_process_raw_v2`, que gravava **Bronze → Gold direto**
   (pulando a Silver). Era o caminho **realmente ligado**: o cron
   `process_pending_batches()` (a cada 5 min) chamava
   `fn_process_raw_v2(SPOT, 1000)`.
3. **Silver legado** — `silver_products/variants/print_areas/images_queue`
   com `fn_spot/xbz/asia/sm_to_silver` (hardcoded) + `fn_silver_to_gold`.

Isso violava a regra Medallion (**Bronze → Silver → Gold**): havia salto
Fase 1 → Fase 3, fonte de verdade ambígua e lógica duplicada.

## Decisão

**Unificar tudo no caminho oficial Silver de-para, respeitando as 3 fases.**
Nenhuma escrita Bronze → Gold direta.

```
Bronze (supplier_products_raw, status='pending')
  └─ fn_standardize_supplier(supplier, limit)   [NOVO]  Fase 1→2 (Bronze→Silver)
       ├─ fn_standardize_variant   (variante → produtos_padronizacao_variantes)
       └─ fn_standardize_parent → fn_standardize_raw (produto → produtos_padronizacao)
Silver (status='standardized')
  └─ fn_promote_supplier(supplier, limit)        [EXISTENTE]  Fase 2→3 (Silver→Gold)
       ├─ fn_promote_padronizacao        (produto)
       └─ fn_promote_variants_of_parent  (variante + variant_supplier_sources)
Gold (products / product_variants / variant_supplier_sources, status='promoted')
```

O cron `process_pending_batches()` passou a, **por fornecedor `auto_sync`
com raw pendente**, chamar `fn_standardize_supplier` e depois
`fn_promote_supplier` — generalizando além do SPOT.

### Funções adaptadas
- **`fn_standardize_supplier`** — criada (orquestrador Bronze→Silver em lote;
  advisory lock por fornecedor; SECURITY DEFINER com EXECUTE só para
  `postgres`/`service_role`).
- **`process_pending_batches`** — religada ao pipeline de 3 fases.
- **`fn_promote_variants_of_parent`** — passou a marcar a **raw** como
  `processed` ao promover a variante (cada SKU = 1 raw). Sem isso, as raws
  não-representantes ficavam `pending` e o cron reprocessaria para sempre
  (a fila nunca drenava) — bug confirmado em E2E e corrigido.
- **`fn_process_raw_v2`, `process_supplier_product(_batch)`** — redirecionadas/
  neutralizadas: deixam de gravar Bronze→Gold direto (delegam ao pipeline ou
  retornam erro de descontinuação). Assinaturas preservadas.

### Legado aposentado (sem dropar)
`fn_*_to_silver`, `fn_*_batch_to_silver`, `fn_silver_to_gold`,
`fn_silver_batch_to_gold`, `fn_bronze_to_silver_all`, `fn_normalize_silver_all`
e as tabelas `silver_*` foram marcadas `DEPRECATED` via `COMMENT` (sem
chamadores vivos; sem views/MVs dependentes). Candidatas a DROP em follow-up.

## Justificativa

- A arquitetura-alvo já estava documentada (`docs/arquitetura/products-padronizacao-recomendacoes.md`, §4)
  e classificada como madura ("Não reconstruir").
- As variantes **já fluíam** Bronze→Silver→Gold (todas `promoted` com
  `variant_id`); só faltava o orquestrador em lote da Fase 1→2 e religar o cron.
- Deprecar (não dropar) preserva 7.569+16.462 linhas legadas para auditoria e
  é reversível, em linha com a operação MCP-first (ADR 0006).

## Consequências

- ✅ Fonte de verdade única; Medallion íntegro (sem salto de fase).
- ✅ Cron drena a fila corretamente (validado em E2E: raw `pending` →
  `standardized` → `promoted` → `processed`).
- ✅ Generalizado para os 5 fornecedores (`auto_sync_enabled`).
- ✅ **RESOLVIDO em 2026-06-10 (ADR 0008):** `fn_standardize_variant` e
  `fn_derive_parent_ref` agora são 100% data-driven pelo de-para
  (`supplier_field_mappings`, `target_table='product_variants'`), sem branches
  por UUID. Paridade via `fn_parity_standardize_variant`.
- ⚠️ `fn_standardize_variant` ainda é hardcoded por fornecedor (vive na Fase 2,
  não viola as 3 fases). Conversão para de-para puro + preenchimento de lacunas
  (`variant_supplier_sources` p/ Asia/Só Marcas/88B, categorias, imagens) ficou
  como **follow-up** com testes de paridade.
- ⚠️ Órfão pré-existente: 1 variante XBZ `standardized` sem promoção (não
  relacionada a esta mudança) — tratar no follow-up.

## Migrations

`20260605160000`..`20260605160500` — `silver_unify_01..06`
(orquestrador, religação do cron, redirecionamento dos atalhos, deprecação do
legado, correção de integridade 3-fases e lockdown de segurança).

## Referências

- `docs/arquitetura/products-padronizacao-recomendacoes.md` — arquitetura-alvo
- `medallion/README.md` — visão das camadas
- ADR 0006 — operação MCP-first de migrations
