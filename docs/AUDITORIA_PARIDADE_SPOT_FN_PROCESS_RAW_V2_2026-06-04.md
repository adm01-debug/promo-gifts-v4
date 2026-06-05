# Auditoria de Paridade — `process_spot_products` → `fn_process_raw_v2`

**Projeto:** Supabase `doufsxqlfjyuvxuezpln` ("Promo Gifts") · PostgreSQL 17.6
**Fornecedor:** Spot | Stricker · `supplier_id = bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0` · `organization_id = 5db5aee1-064b-4ef4-9193-345dcd8274ea` · markup default **115%**
**Data:** 2026-06-04
**Escopo:** SOMENTE Spot. XBZ / Asia / Só Marcas / 88 continuam na rota genérica (`fn_process_staged_*`) — **não** tocados aqui.
**Status:** ✅ Concluído, aplicado em produção e validado por dry-run transacional (`BEGIN … ROLLBACK`). Cutover forward-only (0 linhas Spot pendentes no dia); as correções valem na próxima importação.

> Este documento registra a auditoria. A **fonte canônica** de cada correção são os arquivos de migration versionados (ver §4); o corpo completo da `fn_process_raw_v2` vive em
> `supabase/migrations/20260604185419_fn_process_raw_v2_fix_batch_fk_order.sql`.

---

## 1. Sumário executivo

A auditoria comparou, função a função e campo a campo, a legada `process_spot_products(integer)` com a nova `fn_process_raw_v2(uuid,integer,boolean)` sobre todo o corpus Spot (3.612 linhas raw / 1.200 ProdReferences / 1.200 produtos / 3.612 variantes / 3.612 VSS). A "paridade provada" anotada no cutover tinha sido verificada num cenário **mascarado** (produtos já existentes), onde os defeitos da v2 viravam no-op. Forçando um `ProdReference` **inédito** (o caso real da próxima importação), apareceram **3 falhas críticas** que deixariam o produto novo sem nome/marca/descrição, sem custo e sem preço — além de **2 bugs de ambiente** que abortavam a importação por completo.

Todas foram corrigidas em **6 migrations reversíveis** (M1–M6) e o resultado foi provado: produto novo nasce com nome real, `cost_price` e `sale_price` (markup 115%), variantes com cor/hex/atributos, VSS com custo, batch `completed` e 0 erros.

## 2. Matriz de paridade (resumo)

| O que a legada fazia | Mecanismo na v2 | Diagnóstico inicial | Correção |
|---|---|---|---|
| `products.sku = 'SPOT-'+ref` | `sku_prefix` + pkey | `sku_prefix='SPOT-'`, mas 1.200/1.200 têm sku SEM prefixo → novo sairia divergente | **M2** (`sku_prefix=''`) |
| `products.supplier_reference = ref` | setado no INSERT | ✓ OK | — |
| `products.name = clean_spot_name(Name)` | de-para `Name→name` | **FALHA TOTAL** (G1: `source_path='$.Name'`) | **M1** |
| description / brand / origin / box_* | de-para products | **FALHA TOTAL** (G1) | **M1** |
| `products.product_type='product'` / `is_active` | default / INSERT | ✓ OK | — |
| `variant.sku = Sku` | `COALESCE(map.sku, raw.supplier_sku, ref)` | ✓ paridade perfeita (`supplier_sku=Sku` 3.612/3.612) | — |
| `variant.color_*` | de-para variants | v2 lê `ColorDesc1`/`ColorHex1` (populados) vs legada `ColorName`/`ColorHex` (vazios) → **v2 mais correta** | — |
| `variant.attributes={codigo_cor,cor}` | montado de color_* | ✓ OK | — |
| `vss.cost_price = Price1` | de-para `variant_supplier_sources` | **NÃO existia mapping de VSS** → custo nunca gravado (G2) | **M1** |
| (preço de venda) `sale_price` | trigger BEFORE de products ← `products.cost_price` | **ninguém preenchia `products.cost_price`** → `sale_price` nulo (G3) | **M6** |
| Abre/fecha `supplier_import_batches`, grava `process_errors`, carimba `raw.import_batch_id` | — | v2 não gerenciava batch/erros | **M3 → M5** (zombie-safe, FK-safe) |
| Linha-pai p/ campos de produto | `imported_at` | legada usava DESC (mais recente) | **M3 → M5** (DESC) |
| Ignora `locked_fields` | v2 **respeita** + `write_source='pipeline'` | v2 superior — preservado | — |
| — | gatilho `unaccent()` no INSERT/UPDATE de products | **ABORTAVA tudo** (G4) | **M4** |

## 3. Causas-raiz

- **G1 — De-para de `products` morto.** As 7 regras ativas de `products` guardavam `source_path` em JSONPath (`'$.Name'`…), mas a v2 resolve `source_path` como caminho separado por ponto: `raw_data #>> string_to_array('$.Name','.')` → `{'$','Name'}` → **NULL**. Como a v2 prefere `source_path` quando não-nulo, nunca caía no `source_field` (que já estava correto). Correção: zerar `source_path` (M1).
- **G2 — Custo nunca gravado.** Não havia **nenhum** mapping com `target_table='variant_supplier_sources'`. O bloco VSS da v2 só roda `IF v_ssfields <> '{}'`; sem mapping, ficava vazio. Correção: mapping `Price1 → variant_supplier_sources.cost_price` (M1).
- **G3 — Preço de venda ausente.** Quem grava `sale_price` é o trigger BEFORE de products (`fn_trigger_calculate_sale_price`, `sale_price = cost_price × (1 + default_markup_percent/100)`). Nem legada nem v2 preenchiam `products.cost_price`. Correção: mapping `Price1 → products.cost_price` (M6).
- **G4 — `unaccent` indisponível.** O trigger `products_search_vector_update` chama `unaccent()` sem `search_path`; `unaccent` mora no schema `extensions`, então sob a v2 (`search_path=public`) abortava todo INSERT/UPDATE de products do pipeline. Correção: `SET search_path = public, extensions` em `products_search_vector_update` e `fn_safe_bool` (M4).
- **Bug introduzido (M3→M5).** A telemetria de batch carimbava `raw.import_batch_id` durante o laço, mas só inseria o batch no fim → violava a FK. Corrigido abrindo o batch **antes** do laço (e só se houver trabalho), em M5.

## 4. Migrations aplicadas (versionadas neste PR)

As correções desta auditoria:

| # | Versão | Arquivo | Trata |
|---|---|---|---|
| M1 | `20260604184447` | `spot_v2_fix_products_depara_and_cost` | G1 + G2 |
| M2 | `20260604184459` | `spot_v2_align_sku_prefix_to_catalog` | sku_prefix |
| M3 | `20260604184644` | `fn_process_raw_v2_parity_upgrade` | telemetria/erros/ordenação (superseded por M5) |
| M4 | `20260604185153` | `fix_search_path_unaccent_functions` | G4 |
| M5 | `20260604185419` | `fn_process_raw_v2_fix_batch_fk_order` | **definição canônica** da função |
| M6 | `20260604185737` | `spot_v2_map_products_cost_price` | G3 |

Predecessoras do motor v2 (mesma iniciativa, reconciliadas no mesmo PR para deixar o conjunto self-consistent):
`20260604171726_motor_v2_config_foundation`, `20260604171814_motor_v2_create_fn_process_raw_v2`,
`20260604172240_motor_v2_parity_harness`, `20260604173140_motor_v2_variant_identity_supplier_sku`,
`20260604173153_spot_activate_variant_mappings_and_template`, `20260604173213_motor_v2_parity_harness_v2`,
`20260604174303_motor_v2_respect_locks_and_write_source`, `20260604174339_motor_v2_parity_harness_v3`,
`20260604174413_motor_v2_parity_harness_v3b`, `20260604174444_motor_v2_drop_old_2arg_overload`.

> **Decisão de arquitetura (M2):** `products.sku` é UNIQUE e chave natural amplamente referenciada (contrato `v_products_public`, pedidos, URLs). Os 1.200 produtos usam a ref pura; alinhamos os **novos** ao padrão vigente (sem prefixo) sem reescrever os existentes.
>
> **Price1 com dois alvos:** após M1 + M6, `Price1` mapeia para `variant_supplier_sources.cost_price` (sistema de custo/faixas) e `products.cost_price` (dispara o trigger de markup). Reflete o estado real do catálogo (os 1.200 têm ambos).

## 5. Verificação do estado em produção (2026-06-04)

| Métrica | Esperado | Observado |
|---|---|---|
| Mappings Spot ativos | 14 | **14** |
| Mappings `products` com JSONPath morto (`$.…`) | 0 | **0** |
| Alvos de `Price1` (ativos) | `products.cost_price`, `variant_supplier_sources.cost_price` | **ambos** |
| `supplier_settings.sku_prefix` (Spot) | `''` | **`''`** |
| `products_search_vector_update` search_path | `public, extensions` | **ok** |
| `fn_safe_bool` search_path | `public, extensions` | **ok** |

## 7. Re-auditoria ao vivo (2026-06-04, pós-cutover) — REGRESSÕES CRÍTICAS

Nova varredura exaustiva **ao vivo** no banco `doufsxqlfjyuvxuezpln` (motivada por
"validar se TODAS as funcionalidades foram implementadas; procurar falhas e gaps").
Descobertas que **invalidavam** o veredito "concluído" das seções anteriores: duas
migrations *out-of-band* aplicadas DIRETO no banco (ausentes do repo) regrediram o
motor **depois** do cutover `supplier_products_raw.processed → status`.

### 🔴 DEFEITO-2 — `fn_process_raw_v2` quebrada (coluna removida `processed`)
A migration **`20260604232944_upgrade_fn_process_raw_v2_fix_race_condition_and_counters`**
(no banco, fora do repo) recriou a função a partir de uma base que ainda usa a coluna
booleana `processed`. Como foi aplicada **após** o cutover (`20260604232403_spr_cutover_
status_part2`) que trocou `processed` por `status supplier_raw_status`, a função passou a
referenciar coluna inexistente.

- **Prova:** `SELECT fn_process_raw_v2('bcfc0d02…',1,true)` →
  `ERROR: column "processed" does not exist (line 56)`.
- **Impacto em produção:** o cron `process-pending-products` (jobid 1, `*/5`, que chama
  `process_pending_batches()` → `fn_process_raw_v2`) **falhou a cada execução desde
  2026-06-04 23:30** (sucesso até 23:25). Pipeline SPOT **parado**. Sem corrupção de
  dados (a função aborta antes de qualquer escrita).
- **Correção:** `20260604234507_fix_fn_process_raw_v2_status_column.sql` — recria a função
  com `status <> 'processed'` (leitura) / `status = 'processed'` (conclusão), mantendo as
  melhorias legítimas da 232944 (early-return anti-zumbi, `FOR UPDATE SKIP LOCKED`,
  `source='raw_v2'` no UPDATE de VSS) e **restaurando** (a) o template de nome completo
  (`{size_code}`/`{capacity_ml}` + colapso de separadores vazios) e (b) o
  `pg_try_advisory_xact_lock` anti-race.

### 🟠 DEFEITO-3 — `fn_clean_spot_name` deixou de ser aplicada (nome cru)
A migration **`20260604232837_upgrade_fn_apply_transform_add_missing_transforms`** (idem,
out-of-band) recriou `fn_apply_transform` e **removeu** do `CASE 'custom'` o branch
`fn_clean_spot_name` (restaram só `fn_parse_capacity_ml` e `fn_convert_box_dimension_to_cm`).
O mapping `products.name` (custom → `fn_clean_spot_name`) virou passthrough: nomes saíam
**crus** (caixa alta, espaços múltiplos) → reverteu o GAP-1.

- **Prova (E2E):** `Name='  CANECA   de   PORCELANA   BRANCA  '` gerava produto
  `'CANECA   de   PORCELANA   BRANCA'`.
- **Correção:** `20260604234647_restore_fn_clean_spot_name_branch_in_apply_transform.sql`
  — recria `fn_apply_transform` com TODAS as transforms da 232837 **+** o branch
  `fn_clean_spot_name`.

### 🟠 DEFEITO-4 — `{size_code}`/`{capacity_ml}` literais no nome da variante
A 232944 também só substituía `{product_name}` e `{color_name}`, deixando `{size_code}`
(e `{capacity_ml}`) **literais** no nome. Corrigido junto da DEFEITO-2 (234507).

### Validação pós-correção (testes ao vivo, todos com ROLLBACK total)
| Teste | Resultado |
|---|---|
| `fn_process_raw_v2` no-op (0 pendentes) | `success:true, batch_id:null` (não cria batch) |
| `process_pending_batches()` (caminho do cron) | `SUCCESS` (antes: ERROR) |
| E2E produto inédito | produto+variante+VSS criados; `parents=1, variants=1, errors=[]` |
| Nome do produto | `'  CANECA   de   PORCELANA   BRANCA  '` → **`'Caneca de porcelana branca'`** |
| Nome da variante | **`'Caneca de porcelana branca | Vermelho | M'`** (size resolvido; sem `{}`) |
| `cost_price` / `sale_price` | `12.34` / **`26.53`** (markup 115% via trigger) |
| VSS | `cost_price=12.34, source='raw_v2', is_preferred=true, quantity=0` |
| `variant.sku = supplier_sku (= Sku)` | ✓ paridade |
| Raw carimbada | `status='processed'`, `product_id`/`variant_id` setados, `process_errors=NULL` |
| Idempotência (2º ciclo) | 1 produto / 1 variante / 1 VSS (upsert, sem duplicar) |
| `locked_fields=['name']` | nome **não** sobrescrito (`lock_respected=true`) |
| Integridade do acervo (3.612 raw / 1.200 prod / 3.612 var / VSS) | 0 órfãos, 0 SKU duplicado, 0 nome vazio, 0 `{}` residual, 0 custo nulo, 0 cost-sem-sale |
| Outras funções pós-cutover (fn_finish_import_batch, fn_process_staged_product, process_supplier_products_batch) | já usam `status` (não quebradas) — só `fn_process_raw_v2` regrediu |

### Lições / risco sistêmico
A causa-raiz de ambos os defeitos é **edição direta no banco fora do fluxo de migrations
versionadas** (DB → repo drift). As correções foram versionadas; as duas migrations
out-of-band foram preservadas como **marcadores no-op** no repo (232837/232944) para
manter a paridade DB↔repo no CLI sem reaplicar DDL quebrada/superada.

## 6. Reconciliação repo ↔ banco

As 16 migrations acima já estavam aplicadas no banco (registradas em `supabase_migrations.schema_migrations`) mas faltavam como arquivo no repositório. Foram gravadas **byte-a-byte** a partir do banco (verificadas por `md5`), restaurando a invariante DB == repo. Junto, reconciliou-se também `20260604210435_add_catalog_sort_indexes` (workstream de catálogo, não relacionada à paridade Spot, mas órfã no mesmo intervalo).
