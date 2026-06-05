# `products` — Padronização / Tabela de Equivalência

> Avaliação arquitetural (DBA) da tabela `public.products` e da camada de
> padronização/de-para de fornecedores no projeto Supabase `doufsxqlfjyuvxuezpln`.
> Data: 2026-06-05. Base inspecionada ao vivo (não é estimativa).

---

## 1. Diagnóstico em uma frase

A arquitetura de padronização **já existe e é madura** (de-para por
fornecedor, equivalências de cor/material, staging de raw, variantes
canônicas). O problema **não** é falta de modelo — é que a tabela
`products` virou uma *god table* de ~135 colunas que **duplica** dados que
já vivem nas tabelas filhas normalizadas e ainda carrega identidade de
fornecedor que hoje pertence à camada de variante. Isso cria **ambiguidade
de fonte de verdade** e risco de *drift*.

## 2. Evidências coletadas (ao vivo)

| Métrica | Valor |
|---|---|
| Colunas em `products` | ~135 (posições até 171) |
| Linhas | 6.123 |
| Tamanho (com índices) | 59 MB (tabela 25 MB) |
| Índices em `products` | 30 |
| `distinct supplier_id` | 5 fornecedores |
| `external_id` preenchido | **0 / 6.123 (0%)** — porém tem índice UNIQUE |
| `active` vs `is_active` | ambos 100% preenchidos, 0 divergências hoje |
| `supplier_id` / `supplier_reference` | 100% / 100% |
| `ncm_code` (varchar) / `ncm_id` (FK) | 100% / 99,98% |
| `category_id` / `main_category_id` | 100% / 100% |

**Armazenamento duplo (JSONB em `products` × tabelas filhas):**

| Atributo | JSONB em `products` | Tabela normalizada |
|---|---|---|
| Cores | 5.435 produtos | `product_variants` = 16.456 |
| Imagens | 6.027 produtos | `product_images` = 46.122 |
| Materiais | 468 produtos | `product_materials` = 9.645 |
| Tags | 432 produtos | `product_tags` = 23.563 |

**Camada de padronização/equivalência existente (saudável):**
`supplier_products_raw` (16.508) → `produtos_padronizacao_variantes`
(staging com `raw_id`→`pad_id`→`variant_id` + `status`) →
`product_variants` (16.456) → `variant_supplier_sources` (16.456, de-para
N:N variante↔fornecedor com faixas de preço `cost_price_1..5`/`min_qty`,
estoque por depósito, e fiscal: ICMS/PIS/COFINS/CFOP/CST/CEST). Mais os
dicionários: `supplier_field_mappings`, `supplier_value_mappings`,
`color_equivalences`, `material_equivalences`, `attribute_equivalences`,
`supplier_unit_conversions`, `supplier_category_mappings`.

**Advisors Supabase (performance):** 242 avisos — 108 `unindexed_foreign_keys`,
74 `unused_index`, 32 `auth_rls_initplan`, 27 `multiple_permissive_policies`.

---

## 3. Problemas priorizados

### P0 — Fonte de verdade ambígua (armazenamento duplo)
`products.colors / materials / tags / images / videos` (JSONB) coexistem com
`product_variants`, `product_materials`, `product_tags`, `product_images`,
`product_videos`. As tabelas filhas já têm **muito mais** dados (ex.: 46k
imagens vs 6k produtos com JSONB), logo elas são a fonte real — mas o JSONB
continua sendo gravado e lido em alguns caminhos. Sem uma regra única,
qualquer ETL/edição corre o risco de divergir.

**Ação:** eleger as tabelas filhas como fonte canônica única. Rebaixar os
JSONB a *cache de leitura* mantido por trigger/MV (ou removê-los do caminho
de escrita e servir via `v_products_complete`/`mv_product_cards`). Marcar as
colunas JSONB como *deprecated* e congelar escrita.

### P0 — `active` **e** `is_active` (flag duplicada)
Dois booleanos de "ativo", ambos default `true`, ambos 100% preenchidos.
Hoje não divergem, mas os **índices estão divididos** entre os dois
(`idx_products_active_*` usam `active`; `idx_products_active`,
`idx_products_org_active*` usam `is_active`). É um bug latente: basta um
caminho de escrita atualizar só um.

**Ação:** consolidar em `is_active`. Migrar índices, criar coluna gerada
`active` como alias temporário (compat) e depois dropar.

### P1 — Identidade de fornecedor dentro de `products` é redundante
`supplier_id` (FK 1:1) + `supplier_reference` + `manufacturer_sku` +
`sku_promo` + `last_sync_supplier_id` na linha do produto. Mas o sourcing
**multi-fornecedor** já é modelado corretamente em `variant_supplier_sources`
(N:N) e `produtos_padronizacao_variantes`. Manter `supplier_id` único no
produto **conceitualmente trava** o produto a 1 fornecedor, o que contradiz
a camada de variante.

**Ação:** tratar `products.supplier_id` como "fornecedor de origem/curadoria"
(renomear para `origin_supplier_id` para deixar claro) ou derivá-lo de
`variant_supplier_sources.is_preferred`. A verdade de "quem fornece o quê e
por quanto" deve ser exclusivamente a de-para de variante.

### P1 — `external_id` é a chave de padronização e está 100% vazia
Existe `UNIQUE INDEX ux_products_external_id_not_null` mas **nenhuma linha**
preenchida. A chave universal de equivalência (a "tabela de equivalência"
que você citou) foi criada e nunca populada — então o casamento hoje depende
de `sku`/`supplier_reference`, que são frágeis.

**Ação:** definir a **estratégia de chave canônica** (ver §4) e popular
`external_id` (ou promovê-lo a chave de negócio estável). Enquanto vazio, é
índice morto.

### P1 — Dimensões/medidas em 4 sistemas paralelos
`dimensions` (jsonb) + `length_cm/width_cm/height_cm` + `box_*_mm` +
`box_*_cm` + `dimensions_display` (texto) + tabela `product_physical`.
Mistura mm/cm e texto livre — fonte garantida de inconsistência e de
cálculo de cubagem/frete errado.

**Ação:** uma unidade única (recomendo **mm inteiro** para precisão e
indexação), centralizada em `product_physical` (1:1). Demais colunas viram
*generated* (cm = mm/10) ou são removidas.

### P1 — Taxonomia e NCM duplicados
- `category_id` **e** `main_category_id` (ambos FK→`categories`, 100%) +
  `product_category_assignments` (N:N). Três mecanismos.
- `ncm_code` (varchar, 100%) **e** `ncm_id` (FK→`ncm_codes`, 99,98%).

**Ação:** eleger `product_category_assignments` (N:N) + uma flag/coluna de
categoria primária como fonte; `ncm_id` (FK) como verdade e `ncm_code` como
coluna **gerada** a partir do FK (ou view).

### P2 — *God table*: extrair blocos coesos para satélites 1:1
Grandes blocos temáticos inflam toda leitura de catálogo:
- **SEO** (~15 col.: `meta_*`, `og_*`, `seo_*`, `canonical_url`, `robots_meta`,
  `schema_json`) → `product_seo`.
- **IA** (~8 col.: `ai_*`, `auto_category`, `auto_material`,
  `classification_confidence`) → `product_ai` (já existe `product_ai_history`).
- **Embalagem** (~25 col.: `packaging_*`, `box_*`, `cradle_*`,
  `repacking_*`, `has_*_packaging`) → `product_packaging` (1:1) ou consolidar
  no já existente `product_packagings`.
- **Flags com validade** (`is_featured/bestseller/on_sale/new` +
  `*_expires_at`) → tabela `product_flags` ou *view* computada por data, em
  vez de booleano + cron de expiração.

Benefício: `products` "quente" cai para ~30–40 colunas → menos I/O por
varredura de catálogo, menos *bloat*, *HOT updates* mais baratos.

### P2 — Itens menores
- `min_quantity` (default 1) **vs** `min_order_quantity` **vs**
  `requires_minimum_order` / `requires_minimum_order` — consolidar.
- `cost_price/sale_price/suggested_price` no produto vs preços por
  fornecedor/faixa em `variant_supplier_sources` — definir qual é "vitrine".
- CHECKs de string (`product_type`, `supply_mode`, `shape_type`,
  `sync_status`) → considerar `ENUM` nativo ou tabela de domínio.
- `meta_keywords ARRAY` + `key_benefits/use_cases/target_audience ARRAY` —
  ok para leitura, mas sem GIN não filtram bem; ou normalizar
  (`product_target_audiences` já existe).

### Performance (advisors, baixo risco/alto retorno)
- **74 `unused_index`** no schema (vários em `products`): revisar e dropar os
  comprovadamente não usados — reduz custo de escrita e tamanho.
- **108 `unindexed_foreign_keys`**: criar índices nas FKs sob `JOIN`/`DELETE`
  cascade quentes.
- **32 `auth_rls_initplan`**: trocar `auth.uid()`/`is_org_owner_or_admin(...)`
  por `(SELECT auth.uid())` nas policies para avaliar 1x por query (não por
  linha). Aplica-se às policies de `products`.
- **27 `multiple_permissive_policies`**: consolidar policies permissivas
  redundantes por (role, ação).
- **Tenancy:** `products_public_read` é `SELECT` para `authenticated` com
  `USING (true)` → qualquer usuário autenticado lê produtos de **todas** as
  organizações, embora escrita seja `is_org_owner_or_admin(organization_id)`.
  Confirmar se a leitura cross-org é intencional (catálogo público) ou um
  vazamento de isolamento.

---

## 4. Arquitetura-alvo da padronização (de-para)

```
                 dicionários de equivalência
   supplier_field_mappings / value_mappings / color_equivalences /
   material_equivalences / unit_conversions / category_mappings
                              │ (regras)
                              ▼
 supplier_products_raw ──► produtos_padronizacao_variantes ──► product_variants
   (ingestão crua,            (staging: raw_id→pad_id→             (variante
    16.508)                    variant_id, status enum)            canônica, 16.456)
                                                                      │
                              ┌───────────────────────────────────────┤
                              ▼                                        ▼
                     variant_supplier_sources                      products
                  (DE-PARA N:N variante↔fornecedor:            (produto canônico —
                   supplier_sku, preço por faixa,               "casca" enxuta +
                   estoque, fiscal) ← FONTE DE VERDADE           satélites 1:1/N:N)
```

**Princípios:**
1. **Uma chave canônica de produto** estável e pública (ex.: `external_id`
   ou `sku` canônico) — populada e validada. É o "DE" da equivalência.
2. **Quem é o "PARA"**: `variant_supplier_sources.supplier_sku`
   (+ `supplier_color_code/name`) é o identificador do fornecedor. Já existe;
   só precisa ser a **única** referência de fornecedor (tirar de `products`).
3. **`products` é casca canônica**: identidade, taxonomia primária, SEO/IA/
   embalagem em satélites; atributos (cor/material/tag/imagem) **somente** nas
   filhas; preço/estoque/fiscal **somente** na de-para de variante.
4. **JSONB vira cache de leitura** (MV/trigger), nunca fonte de escrita.

---

## 5. Roteiro de migração (não-disruptivo, em fases)

Tudo atrás de *views* de compatibilidade (`v_products_complete`,
`v_products_public` já existem) para não quebrar a aplicação.

| Fase | Ação | Risco |
|---|---|---|
| 0 | Adicionar `COMMENT ON COLUMN` marcando colunas *deprecated*; congelar escrita nos JSONB | Nulo |
| 1 | **Quick wins** de performance: dropar `unused_index`, indexar FKs quentes, corrigir `auth_rls_initplan` com `(SELECT auth.uid())`, consolidar policies | Baixo |
| 2 | Consolidar `active`→`is_active` (coluna gerada de compat + migrar índices) | Baixo |
| 3 | Popular/validar `external_id` (chave canônica); reduzir dependência de `sku`/`supplier_reference` | Médio |
| 4 | Extrair satélites: `product_seo`, `product_ai`, `product_packaging` (criar + backfill + view) | Médio |
| 5 | Migrar dimensões para `product_physical` (unidade única) + colunas geradas | Médio |
| 6 | Rebaixar JSONB a cache (trigger/MV) e remover do caminho de escrita | Médio |
| 7 | Reposicionar identidade de fornecedor: `supplier_id`→`origin_supplier_id` derivado de `is_preferred` | Médio |
| 8 | Remoção física das colunas legadas após período de observação | Controlado |

---

## 6. Quick wins (propostas SQL — revisar antes de aplicar)

> Apenas sugestões. **Nada foi executado** no banco. Validar em branch/staging.

```sql
-- (a) Consolidar flag de ativo: índices passam a usar is_active; manter
--     'active' como coluna gerada temporária para compatibilidade de leitura.
--     (executar fora de horário de pico; recriar índices CONCURRENTLY)
-- DROP os índices que usam 'active' e recriar sobre 'is_active', ex.:
--   CREATE INDEX CONCURRENTLY idx_products_active_created_at2
--     ON products (created_at DESC) WHERE (is_active = true);

-- (b) RLS: avaliar função 1x por query (corrige auth_rls_initplan)
ALTER POLICY products_update ON public.products
  USING ( (SELECT public.is_org_owner_or_admin(organization_id)) )
  WITH CHECK ( (SELECT public.is_org_owner_or_admin(organization_id)) );
-- idem para products_insert / products_delete.

-- (c) Marcar fonte de verdade (documentação executável)
COMMENT ON COLUMN public.products.colors    IS 'DEPRECATED: usar product_variants. Cache somente-leitura.';
COMMENT ON COLUMN public.products.materials IS 'DEPRECATED: usar product_materials.';
COMMENT ON COLUMN public.products.tags      IS 'DEPRECATED: usar product_tags.';
COMMENT ON COLUMN public.products.images    IS 'DEPRECATED: usar product_images.';
COMMENT ON COLUMN public.products.ncm_code  IS 'DEPRECATED: derivar de ncm_id (FK ncm_codes).';

-- (d) NCM como coluna gerada a partir do FK (após validar 100% de match)
-- ALTER TABLE products DROP COLUMN ncm_code;
-- ALTER TABLE products ADD COLUMN ncm_code text
--   GENERATED ALWAYS AS (... lookup ...) STORED;  -- ou servir via view

-- (e) Higiene: 54 produtos sem imagem primária, 5 sem preço.
SELECT id, name FROM public.products WHERE primary_image_url IS NULL; -- tratar
```

---

## 7. Resumo executivo para decisão

- **Não reconstruir**: o modelo de equivalência está certo e rico. O trabalho
  é **enxugar `products`** e **eliminar a duplicação de fonte de verdade**.
- **Maior ganho imediato**: (1) resolver `active`/`is_active`, (2) congelar os
  JSONB duplicados, (3) aplicar os quick wins de RLS/índices dos advisors.
- **Maior ganho estrutural**: mover identidade de fornecedor e preço/estoque
  100% para a camada de variante (`variant_supplier_sources`) e popular a
  chave canônica `external_id`.
- **Risco**: baixo se feito atrás das views de compatibilidade já existentes
  e em fases, com backfill + período de observação antes de dropar colunas.
