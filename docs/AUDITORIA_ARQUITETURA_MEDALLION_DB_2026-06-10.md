# Auditoria Exaustiva — Arquitetura Medallion no Supabase (Gestão de Produtos)

**Data:** 2026-06-10
**Escopo:** Banco `doufsxqlfjyuvxuezpln` (GESTÃO DE PRODUTOS) — validação da arquitetura Bronze (recebimento de dados crus de fornecedores) → Silver (padronização/normalização/equivalências/de-para) → Gold (dados padronizados que alimentam o front-end).
**Método:** Inspeção direta do catálogo (`pg_catalog`/`information_schema`), leitura do código das funções do pipeline, contagens e checagens de integridade entre camadas, Supabase Advisors (security + performance), análise dos cron jobs e cruzamento com a documentação do repositório (`medallion/`, `docs/`, ADR-0007).

---

## 1. Sumário Executivo

A arquitetura medalhão **existe, está de pé e o desenho central é bom**: chaves naturais corretas nas 3 camadas, linhagem completa (`raw_id` → `pad_id` → `product_id`/`variant_id`), orquestrador com advisory lock + kill-switch + log de execução, idempotência por upsert, e o front-end consome **apenas** a camada Gold (`v_products_public`, `products`, `product_variants`) — sem nenhuma leitura de Silver/Bronze no `src/`.

Porém, a auditoria encontrou **4 falhas críticas (P0)** que corroem a operação e a segurança hoje, e **~15 gaps estruturais (P1/P2)**:

| # | Severidade | Achado | Evidência-chave |
|---|-----------|--------|-----------------|
| 1 | 🔴 P0 | **Carrossel de reprocessamento** — XBZ inteira reprocessa continuamente (pending↔processed) | 4.263 raws `pending` que **já tinham sido promovidas**; 6.558 reprocessadas nas últimas 24h; 12,7M updates acumulados no Bronze |
| 2 | 🔴 P0 | **Histórico-bomba** — `supplier_products_raw_history` cresce ~375 mil linhas/DIA | 3,16M linhas (5 GB) e 100% delas geradas nos últimos 7 dias; única diferença entre versões: campo `_ruiz_sync_at` |
| 3 | 🔴 P0 | **Vazamento de dados comerciais para `anon`** | Policy `spr_select_anon USING (true)` no Bronze; grant de coluna `cost_price`/`ipi_rate` em `products` para `anon`; 93 funções SECURITY DEFINER do pipeline executáveis por `anon` |
| 4 | 🔴 P0 | **Estoque inconsistente na Gold** | 3.931 variantes ativas (21%) com cache de estoque ≠ soma das fontes; 2.745 com diferença >10 unidades; 515 produtos idem |

**Causa-raiz dos achados 1 e 2 (a mesma):** dados voláteis de estoque + um timestamp de sincronização (`_ruiz_sync_at`) são gravados **dentro do `raw_data`** pela `fn_xbz_enrich_stock_batch`, o que muda o `content_hash` a cada ciclo (15 min). O upsert de ingestão (`insert_supplier_product_raw`) reseta `status='pending'` quando o hash muda, e o trigger `trg_spr_history` grava uma versão no histórico. Resultado: o mecanismo de *change detection* por hash — que é a espinha dorsal do Bronze — está **funcionalmente quebrado para XBZ** (e parcialmente para STRICKER/SOMARCAS, com 3,0 e 2,0 versões/linha/dia).

---

## 2. Arquitetura Real Implantada (mapa verificado no banco)

### 2.1 Camadas e tabelas

| Camada | Tabela | Linhas (real) | Tamanho | Observação |
|--------|--------|---------------|---------|------------|
| Bronze | `supplier_products_raw` | 18.427 | 669 MB | Grão híbrido (ver §4.3); 4 sub-pipelines: produto, imagens, estoque, site |
| Bronze | `supplier_products_raw_history` | 3.163.070 | 5 GB | 🔴 Crescimento patológico (§3.2) |
| Bronze | `supplier_customization_raw` / `supplier_customization_options_raw` | 325 / 35.832 | 5+68 MB | Técnicas de gravação |
| Bronze (staging) | `xbz_gallery_staging`, `sm_images_staging`, `scraper_images_staging` | 17.630 / 4 / 0 | — | Mídia |
| Silver | `produtos_padronizacao` | 7.492 | 27 MB | Produto-pai padronizado |
| Silver | `produtos_padronizacao_variantes` | 18.369 | 40 MB | Variante/SKU padronizado |
| Silver (site) | `produtos_site_padronizacao` | 2.984 | 8,8 MB | Enriquecimento por scraping |
| De-para | `supplier_field_mappings` (189), `supplier_value_mappings` (96), `color_equivalences` (168), `material_equivalences` (283), `supplier_category_mappings` (105), `supplier_colors` (257), `supplier_categories` (381) | — | — | ✅ populadas e usadas |
| De-para 🔴 morto | `attribute_equivalences` (13), `supplier_technique_mappings` (53), `de_para_site` (45) | — | — | **0 referências em funções** |
| Gold | `products` | 7.503 (7.484 ativos) | 137 MB | 🟠 170 colunas, 41 índices, ~25 triggers |
| Gold | `product_variants` | 18.441 | 25 MB | SKU único OK |
| Gold | `variant_supplier_sources` | 18.422 | 57 MB | Fonte/estoque por fornecedor (multi-sourcing) |
| Gold | `product_images` (71.738) + satélites (`product_tags`, `product_materials`, `supplier_price_tiers` 17.722, etc.) | — | — | — |

Contexto geral: **345 tabelas + 134 views só no schema `public`** (~4M linhas), 1.013 funções, 53 cron jobs. Schemas auxiliares: `analytics` (7 MVs), `backup` (28 tabelas), `supplier_stricker` (21 tabelas — pipeline paralelo SPOT), `prod_audit`, `classification_audit`.

### 2.2 Motor de transformação (verificado no código)

```
n8n/VPS → fn_ingest_bronze_batch ──► supplier_products_raw (status='pending' quando hash muda)
                                            │
cron medallion-promote-tick (*/10 min, batch 300)
  └─ fn_pipeline_promote_tick
       ├─ para cada supplier com supplier_settings.auto_sync_enabled:
       ├─ fn_standardize_supplier ──► fn_standardize_variant (por raw 'pending')
       │                              └─► UPSERT produtos_padronizacao_variantes (status='standardized')
       │                              fn_standardize_parent ──► produtos_padronizacao
       └─ fn_promote_supplier ──► fn_promote_padronizacao / fn_promote_variants_of_parent
                                   ├─► UPSERT products / product_variants / variant_supplier_sources
                                   ├─► silver.status='promoted' (+product_id/variant_id)
                                   └─► bronze.status='processed' (⚠️ só aqui o Bronze é fechado)
```

Caminhos paralelos coexistindo com o canônico: SPOT/STRICKER usa fastpath próprio (`fn_spot_*`, schema `supplier_stricker`, Bronze marcado `skipped`); pipeline de site (XBZ/SM: `site_data`, `fn_site_to_silver_all`, `fn_site_promote_to_gold`); ciclos de imagem por fornecedor; syncs de estoque (`fn_import_stock_xbz` */15min, `fn_process_asia_stock_pending` 4×/h, `fn_spot_stock_fast_sync`).

### 2.3 Estado por fornecedor (medição direta)

| Fornecedor | Bronze | pending | processed | skipped | Silver pads/vars | Gold (ativos) |
|-----------|--------|---------|-----------|---------|------------------|----------------|
| XBZ | 11.671 | 🔴 4.703 | 6.968 | 0 | 4.043 / 11.666 | 4.048 (4.046) |
| STRICKER | 3.665 | 0 | 0 | 🟠 3.665 | 1.201 / 3.612 | 1.201 (1.201) |
| ASIA | 1.726 | 0 | 1.726 | 0 | 913 / 1.726 | 918 (912) |
| SOMARCAS | 1.325 | 0 | 1.325 | 0 | 1.325 / 1.325 | 1.325 (1.325) |
| 88BRINDES | 40 | 0 | 40 | 0 | 10 / 40 | 11 (🔴 **0 ativos**) |

---

## 3. Achados Críticos (P0)

### 3.1 🔴 P0-1 — Carrossel de reprocessamento (XBZ)

**Cadeia causal, todas as peças confirmadas no código:**

1. `fn_xbz_enrich_stock_batch` (chamada externa, ciclo ~15 min) faz `raw_data = raw_data || {QuantidadeDisponivel, PrecoVenda, ..., '_ruiz_sync_at': now()}` — **mistura estoque volátil e um timestamp sempre-novo no payload imutável do Bronze**, em vez de usar a coluna `stock_data` criada exatamente para isso.
2. `fn_spr_before_write` (BEFORE trigger) recalcula `content_hash = sha256(raw_data - '_source' - '_api_fields_count' - '_imported_at')` — **não remove `_ruiz_sync_at`** → hash muda em todo ciclo.
3. `insert_supplier_product_raw` (feed de produtos): `ON CONFLICT ... SET status = CASE WHEN content_hash IS DISTINCT FROM EXCLUDED.content_hash THEN 'pending' ...` → como o hash armazenado contém `_ruiz_sync_at` e o payload recém-chegado não, **todo upsert de catálogo reseta a linha para `pending`**, mesmo sem mudança real do produto.
4. `medallion-promote-tick` re-padroniza e re-promove 300 linhas/tick → re-marca `processed` → o próximo sync recomeça o ciclo.

**Evidências numéricas:** 4.263 dos 4.394 raws XBZ `pending` têm `variant_id` preenchido (já passaram pela Gold antes); 4.253 foram tocados na última hora; 6.558 marcados `processed` nas últimas 24h; `supplier_products_raw` acumula **12.745.318 updates**; `products` acumula 3,3M updates para 7,5 mil linhas (~440 updates/linha), cada um disparando a cascata de ~25 triggers da Gold.

**Impactos:** consumo inútil de CPU/WAL/autovacuum; `updated_at` da Gold perde significado (qualquer consumidor incremental downstream quebra); métricas de backlog mentem (4,7 mil "pendentes" eternos); o erro recorrente `chk_vss_cost_price_not_zero` (ref `P@12288`) é re-tentado a cada 10 minutos para sempre — 65 dos 155 ticks/dia terminam `ok_com_erros`.

**Correção recomendada:**
- `fn_xbz_enrich_stock_batch`: gravar em `stock_data` (não em `raw_data`) — o caminho do estoque já fecha via `stock_hash`/`stock_status`/`fn_import_stock_xbz`.
- `fn_spr_before_write`: incluir `_ruiz_sync_at` (e idealmente um prefixo reservado `_*`) na lista de strip do hash.
- One-shot: limpar `_ruiz_sync_at` e campos voláteis do `raw_data` existente e recalcular hashes.
- No upsert: comparar hash de payload **canônico** (sem campos voláteis do feed XBZ — `QuantidadeDisponivel`, `ReposicaoDataPrevista` etc. via `supplier_settings`).
- Linhas que falham promoção N vezes devem migrar para `failed`→`quarantined` (o enum e a lógica existem em `fn_spr_before_write`, mas o caminho promote não grava `process_errors`, então **quarantine nunca dispara**: 0 linhas `failed`/`quarantined` no banco).

### 3.2 🔴 P0-2 — Histórico-bomba (`supplier_products_raw_history`)

- 3.163.070 linhas / 5 GB; `min(captured_at)`=2026-03-16, mas **3.163.030 linhas (99,999%) foram criadas nos últimos 7 dias** — i.e., o conteúdo é quase todo lixo de churn recente.
- Últimas 24h: 374.961 versões — XBZ 361.513 (33,7 versões/linha/dia ≈ ciclos de 15 min), STRICKER 10.717 (3,0), SOMARCAS 2.624 (2,0), ASIA 107 (1,1).
- Diff real entre versões consecutivas (amostra de 30 pares): **somente `_ruiz_sync_at`** — confirmando que o histórico não está capturando mudança de produto, e sim o relógio do sync.
- Projeção em regime com retenção de 90 dias (`fn_purge_spr_history(90)` diário): **~34M linhas / >50 GB**, purge via `DELETE` em tabela não particionada → bloat e vacuum pesados permanentes.

**Correção:** a mesma do P0-1 elimina ~99% das inserções. Adicionalmente: (a) particionar o histórico por mês (`captured_at`) e purgar com `DROP PARTITION`; (b) reduzir retenção enquanto a causa-raiz não for corrigida; (c) o índice `idx_spr_hist_supplier` consta como *unused* — revisar índices da tabela após particionamento.

### 3.3 🔴 P0-3 — Segurança: dados de custo e pipeline expostos a `anon`

Advisors: **1.186 achados** de segurança. Os que importam para o medalhão, confirmados manualmente:

1. **`spr_select_anon` — `FOR SELECT TO anon USING (true)` em `supplier_products_raw`**: qualquer visitante não autenticado pode ler o Bronze inteiro via REST/GraphQL — payloads crus com **preço de custo (`PrecoVenda`, `Price1`, `preco_*_sem_impostos`), estoque, condições comerciais e SKUs de fornecedor**. Para um revendedor B2B, isso entrega a margem ao mercado.
2. **Grants de coluna em `products` para `anon` incluem `cost_price`, `ipi_rate`, `supplier_id`, `supplier_reference`** — combinado com a policy `products_anon_read (is_active=true)`, o custo de todo o catálogo ativo é público. A view `v_products_public` existe justamente para expor o subconjunto seguro, mas a tabela base continua aberta.
3. **93 funções SECURITY DEFINER do pipeline executáveis por `anon`** — incluindo `fn_pipeline_promote_tick`, `fn_sm_to_silver`, `fn_site_promote_to_gold`, `fn_asia_stock_fast_sync`, `fn_ingest_colors_batch`, `fn_sm_mark_batch_uploaded`. Um anônimo pode disparar promoções em massa, marcar uploads, poluir filas (vetor de DoS e de envenenamento de dados).
4. `authenticated` lê Silver inteira (`pad_authenticated_read USING (true)`) com `cost_price_1..5` — adequado apenas se *todo* usuário autenticado for staff; se clientes B2B têm login, é vazamento.
5. **RLS desabilitado** em 6 tabelas (`xbz_upload_mapping` com 17,8 mil linhas, `asia_upload_mapping`, `supplier_sub_brands`, `spot_typecode_map`, `pipeline_known_issues`, `asia_legacy_upload_queue`); 15 tabelas com RLS habilitado e **zero policies** (deny-all implícito — inclui `produtos_site_padronizacao`, `supplier_customization_raw`, `pipeline_control`); **20 views SECURITY DEFINER** (ERROR) que bypassam RLS, incluindo `v_products_public` e `vw_supplier_field_mappings_summary`; tabelas `_bkp_*`/`_deprecated_*` (com custos congelados) visíveis no GraphQL para `anon`.

**Correção mínima (1 dia):** `DROP POLICY spr_select_anon`; `REVOKE SELECT (cost_price, ipi_rate, supplier_id, supplier_reference) ON products FROM anon` (e auditar os demais grants de coluna); `REVOKE EXECUTE` de todas as `fn_*` de pipeline para `anon`/`authenticated` (mantendo `service_role`); mover `_bkp/_deprecated` para schema `backup` (fora da API); recriar as 20 views com `security_invoker = true`.

### 3.4 🔴 P0-4 — Estoque divergente dentro da própria Gold

O estoque vive em **3 níveis denormalizados**: `variant_supplier_sources.quantity` (fonte) → `product_variants.stock_quantity` (cache 1) → `products.stock_quantity` (cache 2), sincronizados por uma malha de triggers (`trg_sync_stock_from_vss`, `trg_sync_variant_to_product`, `fn_sync_product_stock_cache`) **e** por jobs que escrevem por fora (ex.: `fn_import_stock_xbz` faz rollup direto em `products` a partir de `product_variants`, e grava `price_verified_at=now()` num job de **estoque** — conflação semântica).

**Medição:** 3.931 variantes ativas (21,3%) com `stock_quantity` ≠ soma das fontes ativas; **2.745 com divergência >10 unidades**; 515 produtos ativos com cache ≠ soma das variantes. O front-end exibe disponibilidade errada nessa proporção.

**Correção:** eleger `variant_supplier_sources` como única fonte de verdade; recalcular caches num job de reconciliação idempotente (e agendá-lo); converter os caches para serem alimentados por **um único caminho** (trigger OU job, nunca ambos); adicionar um *check* de divergência ao `fn_pipeline_health`.

---

## 4. Gaps Estruturais (P1)

### 4.1 O "de-para" prometido é só meio-implementado
`fn_standardize_variant` usa `supplier_field_mappings`/`fn_apply_transform` **apenas para SPOT e SOMARCAS**. Para **XBZ e ASIA a extração é hard-coded** (`raw_data->>'CorWebPrincipalId'`, `'var_cor_nome'`, etc.), com **UUIDs de fornecedores chumbados como literais** no corpo da função (`v_XBZ := 'd6718a29-...'`). 88BRINDES cai num `ELSE` genérico (`cor`/`estoque`/`preco_base`) que não corresponde ao feed real — resultado: 40 raws "processados", 11 produtos Gold e **0 ativos**. Consequências: adicionar fornecedor exige alterar função core (viola o propósito do de-para); o comportamento documentado (ADR-0007) diverge do real.

### 4.2 Tabelas de equivalência mortas
`attribute_equivalences`, `supplier_technique_mappings` e `de_para_site` têm dados mas **nenhuma função as referencia**. Ou se conecta ao pipeline, ou se documenta a aposentadoria — mantê-las populadas e ignoradas é a pior das opções (dão falsa confiança de que "equivalências estão tratadas").

### 4.3 Semântica de estado e grão inconsistentes no Bronze
- STRICKER: 3.665 linhas `skipped` que na verdade foram processadas pelo fastpath `fn_spot_*` — `skipped` virou "processado por outro caminho", poluindo a semântica do enum.
- `upsert_supplier_stock_raw` cria placeholders com `raw_data='{}'` e `status='skipped'` para SKUs de estoque sem produto — produto e estoque disputam a mesma linha/grão.
- Grão por fornecedor: XBZ/ASIA = variante; SOMARCAS = produto; SPOT = variante-stock. O Bronze aceita ambos, mas **nenhuma coluna declara o grão**, e a UNIQUE dupla (`supplier_reference` + `supplier_sku`) mascara a ambiguidade.
- `fn_standardize_variant` **não fecha** o estado do raw; quem marca `processed` é a *promoção* (Silver→Gold). Se a promoção trava, o raw fica `pending` eternamente sem erro registrado — acoplamento entre camadas e estados órfãos.

### 4.4 Bronze mutável (anti-padrão medallion)
O Bronze deveria ser *append-only/imutável por versão*. Hoje ele: recebe merges de enriquecimento no `raw_data` (P0-1), carrega estado de pipeline (4 status + tentativas), e referências diretas à Gold (`product_id`, `variant_id`). A história fica no `_history` — correto — mas a mutação do payload original destrói a auditabilidade ("o que o fornecedor mandou" já não é recuperável da linha viva).

### 4.5 Silver com violação de 1NF e duplicação de modelo
`produtos_padronizacao_variantes` tem grupos repetidos `cost_price_1..5`, `min_qty_1..5`, `next_quantity_1..6`, `next_date_1..6`, `color_*_2` — ao mesmo tempo em que existe `supplier_price_tiers` (17.722 linhas) normalizada para o mesmo conceito. Dois modelos para preços escalonados = duas fontes de verdade.

### 4.6 Gold "God table" + lógica de negócio em triggers
`products`: **170 colunas**, **41 índices (54 MB para 7,5 mil linhas — índices ≈ 65% do heap)**, ~25 triggers BEFORE/AFTER encadeados (classificação, SEO, materiais, search vector, preço de venda, slug, contadores) com ordenação controlada por prefixo de nome (`trg_aa_*`) e bypass por GUC `app.bulk_import_mode`. Cada promoção dispara a cascata inteira; o carrossel do P0-1 multiplica esse custo por ~440 updates/linha. Recomendações: extrair colunas frias para satélites, podar índices (264 *unused* no banco todo), migrar lógica de trigger para o passo de promoção (determinístico e testável).

### 4.7 Multi-tenancy incompleto
Gold é multi-tenant (`organization_id` em `products`/`variant_supplier_sources`), mas **Silver e Bronze não têm `organization_id`**. Hoje funciona porque há 1 organização; o dia em que houver 2, o pipeline inteiro precisa de retrofit. Decidir explicitamente: ou o catálogo é global (remover org da Gold/catálogo), ou propagar org desde a ingestão.

### 4.8 Bypass manual da Gold
5 produtos ativos `XBZ-MANUAL-*` (criados 2026-06-05) existem **sem registro na Silver** — criados direto na Gold, sem linhagem. Além de 6 inativos órfãos (ASIA/88BRINDES) e o cron `fantasmas-deactivate-guard` (a cada 5 min!) desativando "produtos fantasma". Guards de 5 minutos (`fantasmas`, `sm-stock-guard`, `sm-variant-coherence-guard`) são band-aids: as invariantes deveriam ser garantidas transacionalmente na promoção, não remediadas depois.

### 4.9 Lixo arquitetural no schema público
`_bkp_*`, `_backup_*`, `_deprecated_silver_*` (48 MB, algumas sem PK) convivem com produção no `public` e aparecem na API/GraphQL. Mover para `backup` (que já existe!) ou dropar.

---

## 5. Achados P2 (performance/manutenção)

1. **264 índices não usados** (maioria em `products`, `_deprecated_*`, `supplier_stricker.*`), 122 FKs sem índice de cobertura (inclui `produtos_padronizacao_variantes.color_id_2`), 2 índices duplicados, 16 tabelas sem PK (bkp).
2. Backlogs laterais reais: `site_status='failed'`=2.467 (scraping XBZ/SM), `images_status='pending'`=2.031, `stock_status='pending'`=3.788 — sem alarme/quarentena; `fn_pipeline_health` não cobre esses eixos por fornecedor.
3. Gold com qualidade visível ao cliente: **378 produtos ativos sem nenhuma imagem**, **293 ativos sem variantes** (não compráveis), **717 ativos com preço sem verificação há >7 dias**.
4. Bronze: heap 454 MB para 18,4 mil linhas (~25 KB/linha) + 39 mil dead tuples — o churn do P0-1 domina o autovacuum (já houve tuning, mas ataca o sintoma).
5. `pipeline_run_log`: 42% dos ticks `ok_com_erros` com o mesmo erro há dias (ver P0-1); função retorna `success:true` mesmo com erros (mascaramento já apontado em auditoria anterior e ainda presente no agregado).
6. 1.013 funções no `public`, nomenclatura mista PT/EN (`fn_promote_padronizacao` vs `fn_standardize_supplier`), sem schema dedicado (`pipeline`/`internal`) — dificulta grants em massa e descoberta.

---

## 6. O que está bem construído (e deve ser preservado)

- **Unicidade e linhagem**: `uq_supplier_product_raw (supplier_id, supplier_reference)` + `uq_spr_supplier_sku`; `uq_pad_supplier_reference`; `uq_padvar_supplier_variant`; `products.sku`/`product_variants.sku` únicos; `variant_supplier_sources` único por (org, variant, supplier). **Zero duplicatas e zero órfãos de linhagem** medidos (silver promoted sem `product_id`: 0; `raw_id` nulo: 0).
- **Orquestração defensiva**: advisory locks (`pg_try_advisory_xact_lock`) no tick e por fornecedor, kill-switch (`pipeline_control`), log estruturado (`pipeline_run_log`), `FOR UPDATE SKIP LOCKED` no claim de lotes.
- **State machine bem desenhada no papel** (pending→processing→processed/failed→quarantined + eixos separados para imagens/estoque/site com hash próprio) — precisa apenas ser honrada de ponta a ponta (§3.1, §4.3).
- **Hash sha256 padronizado** (migração corrigiu o legado md5) e histórico por mudança de conteúdo (conceito correto; implementação sofre do P0-1).
- **Higiene agendada**: purge de history/logs, ANALYZE semanal das tabelas quentes, refresh horário de MVs, smoke tests mensais, schema drift check diário.
- **Separação front/dados**: o React consome `v_products_public` e tabelas Gold; nenhuma referência a `padronizacao`/`raw` no `src/`.
- **Evolução documentada**: ADRs, migrações pequenas e nomeadas, relatórios de teste por fase no `medallion/`.

---

## 7. Plano de Ação Priorizado

### P0 — esta semana
1. **Estancar o carrossel/histórico** (uma única correção ataca os dois):
   - `fn_xbz_enrich_stock_batch` → gravar em `stock_data`; remover `_ruiz_sync_at` do `raw_data`.
   - `fn_spr_before_write` → strip de `_ruiz_sync_at`/chaves `_*` antes do hash.
   - One-shot de limpeza dos `raw_data` poluídos + recálculo de `content_hash` (em lote, com history trigger desabilitado na sessão).
   - Medir D+1: history deve cair de ~375 mil/dia para centenas.
2. **Fechar o vazamento `anon`**: drop da policy `spr_select_anon`; revoke de colunas sensíveis em `products`; revoke EXECUTE das 93 fns de pipeline; tirar `_bkp/_deprecated` da API.
3. **Reconciliação de estoque** Gold (job idempotente VSS→variants→products) + check de divergência no health.
4. **Quarentena efetiva**: promoção que falha deve gravar `process_errors` no raw (ativando o caminho failed→quarantined já existente), tirando o erro `chk_vss_cost_price_not_zero` do loop infinito.

### P1 — este mês
5. Particionar `supplier_products_raw_history` por mês (purge via DROP PARTITION).
6. Completar o de-para para XBZ/ASIA/88BRINDES (mover extração hard-coded para `supplier_field_mappings`) **ou** registrar ADR assumindo o híbrido; remover UUIDs literais (resolver via `suppliers.code`).
7. Definir e materializar o grão do Bronze (coluna `feed_grain` ou tabela separada para stock-placeholders); substituir o `skipped` da STRICKER por um estado/flag explícito (`processed_externally`).
8. Conectar ou aposentar `attribute_equivalences`, `supplier_technique_mappings`, `de_para_site`; unificar preços escalonados (tiers OU colunas 1..5, não ambos).
9. UNIQUE parcial em `products (supplier_id, supplier_reference) WHERE supplier_reference IS NOT NULL` (hoje a não-duplicação é sorte operacional, não invariante).
10. Decidir multi-tenancy (org em Silver/Bronze ou catálogo global documentado).

### P2 — trimestre
11. Podar 264 índices não usados + indexar FKs quentes; consolidar triggers da Gold no passo de promoção; extrair colunas frias de `products`.
12. Mover `_bkp/_backup/_deprecated` para schema `backup`; padronizar nomenclatura e mover pipeline para schema próprio.
13. Ampliar `fn_pipeline_health` para os eixos imagens/estoque/site por fornecedor + alertas de staleness (717 preços >7d, 378 sem imagem, 293 sem variantes).

---

## 8. Veredito

A arquitetura de três camadas está **corretamente concebida e majoritariamente bem executada no nível de modelo de dados** (chaves, linhagem, idempotência, orquestração). O que a compromete hoje não é o desenho — são **vazamentos de responsabilidade entre camadas**: estoque volátil dentro do payload imutável (quebrando o change detection e inflando o histórico em 375 mil versões/dia), promoção fechando o estado do Bronze, caches de estoque com dois escritores, de-para parcialmente substituído por hard-code, e uma superfície de segurança (`anon`) aberta sobre exatamente os dados que um B2B mais precisa proteger: **custo e fornecedor**. Os quatro P0 têm correção cirúrgica e independente de refatoração grande — recomendo executá-los antes de qualquer evolução funcional do catálogo.
