# Migration Sync Log

## 2026-05-24 â€” Fix definitivo sort-order 20250103

### Estado final

| Banco | `20250103` | `20250103000000` |
|---|---|---|
| `doufsxqlfjyuvxuezpln` | removido (repair reverted) | presente |
| Repo | arquivo deletado | `20250103000000_placeholder.sql` |

### Root cause

Arquivo `20250103_placeholder.sql` extraia versao `20250103` que no DB ordena
ANTES de `20250103010000`, mas na filesystem ordena DEPOIS (underscore ASCII 95 > digit ASCII 48).
O CLI via como remote-only e disparava o erro ciclico.

### Fix aplicado (2026-05-24)

1. Arquivo `20250103_placeholder.sql` DELETADO do repo
2. Arquivo `20250103000000_placeholder.sql` CRIADO (ordena corretamente)
3. Row `20250103` removida do DB via `migration repair --status reverted`
4. Row `20250103000000` inserida pelo workflow na run de 11:25

### Estado banco de producao

- `doufsxqlfjyuvxuezpln`: sem orphans. `20250103000000` registrado corretamente.

## 2026-05-25 - Preview markers para PR #314

O check `Supabase Preview` do projeto `jbmxvuccekcxtrdnbwtf` falhou com
`Remote migration versions not found in local migrations directory` apos renames
de migrations ja aplicadas em previews anteriores do PR.

Markers no-op adicionados para preservar as versoes remotas antigas sem
reaplicar DDL duplicada:

- `20260524120000`
- `20260524120100`
- `20260524120200`
- `20260524120300`
- `20260524120400`
- `20260524130000`

O marker `20250103` nao foi reintroduzido: esse prefixo curto ja causou drift
de ordenacao no Supabase CLI. Se ele aparecer novamente como remoto-only, a
correcao deve ser `migration repair --status reverted` no projeto afetado, nao
um arquivo local com esse prefixo.

## 2026-06-04 - Reconciliacao motor_v2 / paridade Spot (doufsxqlfjyuvxuezpln)

17 migrations estavam aplicadas no banco (registradas em
`supabase_migrations.schema_migrations`) mas faltavam como arquivo no repo,
gerando drift desde `20260604170220`. Os arquivos foram restaurados
**byte-a-byte** a partir da coluna `statements` do banco e conferidos por `md5`
(DB == arquivo, 17/17 OK). Nenhuma DDL foi reaplicada.

Conjunto reconciliado (em ordem):

- `20260604171726` motor_v2_config_foundation
- `20260604171814` motor_v2_create_fn_process_raw_v2
- `20260604172240` motor_v2_parity_harness
- `20260604173140` motor_v2_variant_identity_supplier_sku
- `20260604173153` spot_activate_variant_mappings_and_template
- `20260604173213` motor_v2_parity_harness_v2
- `20260604174303` motor_v2_respect_locks_and_write_source
- `20260604174339` motor_v2_parity_harness_v3
- `20260604174413` motor_v2_parity_harness_v3b
- `20260604174444` motor_v2_drop_old_2arg_overload
- `20260604184447` spot_v2_fix_products_depara_and_cost          (M1)
- `20260604184459` spot_v2_align_sku_prefix_to_catalog           (M2)
- `20260604184644` fn_process_raw_v2_parity_upgrade              (M3)
- `20260604185153` fix_search_path_unaccent_functions            (M4)
- `20260604185419` fn_process_raw_v2_fix_batch_fk_order          (M5, fn canonica)
- `20260604185737` spot_v2_map_products_cost_price               (M6)
- `20260604210435` add_catalog_sort_indexes

Contexto da paridade Spot (G1-G4 / M1-M6) em
`docs/AUDITORIA_PARIDADE_SPOT_FN_PROCESS_RAW_V2_2026-06-04.md`.

## 2026-06-04 - Re-auditoria pos-cutover: 2 migrations out-of-band + correcoes (doufsxqlfjyuvxuezpln)

Re-auditoria ao vivo encontrou DUAS migrations aplicadas DIRETO no banco e AUSENTES
do repo, ambas REGRESSOES pos-cutover `processed -> status`:

- `20260604232837` upgrade_fn_apply_transform_add_missing_transforms
  -> removeu o branch custom `fn_clean_spot_name` (nomes deixaram de ser limpos).
- `20260604232944` upgrade_fn_process_raw_v2_fix_race_condition_and_counters
  -> recriou `fn_process_raw_v2` referenciando a coluna REMOVIDA `processed`
     => funcao quebrada; cron `process-pending-products` falhando a cada 5 min
     desde 23:30; pipeline SPOT parado. Tambem deixou `{size_code}` literal no nome.

Acoes:
1. Correcoes versionadas E aplicadas no banco (apply_migration):
   - `20260604234507` fix_fn_process_raw_v2_status_column        (DEFEITO-2/4)
   - `20260604234647` restore_fn_clean_spot_name_branch_in_apply_transform (DEFEITO-3)
2. As duas migrations out-of-band foram preservadas no repo como MARCADORES NO-OP
   (`20260604232837_*.sql`, `20260604232944_*.sql`) para manter a paridade DB<->repo
   no CLI sem reaplicar DDL quebrada/superada (a DDL correta vive nas 234507/234647).

Validacao: no-op idempotente OK; `process_pending_batches()` -> SUCCESS; E2E (rollback)
cria produto+variante+VSS com nome limpo (`Caneca de porcelana branca | Vermelho | M`),
`sale_price` 26.53 (markup 115%), `locked_fields` respeitado, idempotencia 1/1/1.
Detalhes: `docs/AUDITORIA_PARIDADE_SPOT_FN_PROCESS_RAW_V2_2026-06-04.md` (§7).

## 2026-06-05 - Reconciliacao pos-cutover SPR / motor_v2 (doufsxqlfjyuvxuezpln)

28 migrations aplicadas em producao entre 2026-06-04T21:41 e 2026-06-05T00:49
nao estavam no repo. Restauradas byte-a-byte (md5 DB==arquivo, 28/28 OK).

Descoberta durante auditoria de teste exhaustivo: o arquivo reconciliado M5
(`20260604185419`) continha `processed = false` (coluna inexistente), corrigida
sequencialmente pelas migrations abaixo via `fix_fn_process_raw_v2_status_column`
e `fix_fn_process_raw_v2_integer_cast_and_failed_status`. O estado final do banco
esta correto; os arquivos agora refletem cada passo evolutivo.

Conjunto reconciliado (em ordem):

- `20260604214100` fix_spot_name_cleaning
- `20260604214243` fix_raw_v2_race_and_batch_spam
- `20260604231622` spr_drop_redundant_index
- `20260604231629` spr_drop_bkp_table
- `20260604231631` spr_harden_grants_rls
- `20260604231642` spr_maintenance_and_history_retention
- `20260604231826` spr_cutover_status_part1
- `20260604232403` spr_cutover_status_part2
- `20260604232535` spr_before_write_search_path
- `20260604232837` upgrade_fn_apply_transform_add_missing_transforms
- `20260604232944` upgrade_fn_process_raw_v2_fix_race_condition_and_counters
- `20260604234507` fix_fn_process_raw_v2_status_column        (status enum fix)
- `20260604234647` restore_fn_clean_spot_name_branch_in_apply_transform
- `20260604235853` spr_drop_unused_partial_indexes
- `20260605000239` fix_raw_v2_product_type_mapping_parity
- `20260605000347` raw_v2_transform_maxlength_and_spot_overflow_caps
- `20260605001811` spr2_state_integrity_and_wiring
- `20260605001830` spr2_images_generated_drop_claimed
- `20260605001850` spr2_motor_quarantine_terminal
- `20260605001911` spr2_history_old_version_and_index_cleanup
- `20260605001917` spr2_autovacuum_tuning
- `20260605002044` harden_fn_clean_spot_name_unicode_spaces
- `20260605002243` fix_fn_process_raw_v2_use_status_enum      (status enum fix 2)
- `20260605002302` fix_process_supplier_products_batch_use_status_enum
- `20260605002334` fix_fn_process_raw_v2_integer_cast_and_failed_status  (BUG-1/3)
- `20260605002346` fix_trigger_limpar_nome_capitalize_after_strip
- `20260605002357` backfill_locked_fields_brand_manual_edits
- `20260605004956` harden_raw_sibling_tables_rls_grants

### Resultado do teste exhaustivo de paridade (2026-06-05)

Dry-run transacional (BEGIN → fn_process_raw_v2 → captura → ROLLBACK automatico)
com produto inedito `DRYRUN-PARITY-999` / variante `DRYRUN-PARITY-999-BLK`:

| Verificacao | Esperado | Observado | Status |
|---|---|---|---|
| G1: mapeamento produtos | source_path=NULL, campos preenchidos | name, brand, description OK | OK |
| G2: VSS cost_price | Price1 -> vss.cost_price | 25.50 | OK |
| G3: sale_price | cost * 2.15 | 54.83 (ratio=2.1502) | OK |
| M2: sku_prefix | sku = ProdReference sem prefixo | "DRYRUN-PARITY-999" | OK |
| G4: unaccent | sem crash no INSERT | nenhum erro | OK |
| M5: batch telemetria | parents=1, variants=1, errors=[] | 100% | OK |
| raw.status apos run | "processed" | "processed" | OK |
| Rollback | sem dados gravados em prod | confirmado | OK |

Estado producao: 1200 produtos / 3612 VSS todos com cost_price e sale_price.
Markup observado: 2.1500 (115%) em 100% dos produtos amostrados.

## 2026-06-05 - Reconciliacao TOTAL de junho + hardening (PR #659 review)

A revisao automatizada do PR #659 (Codex + cubic, 3 ferramentas) apontou P1s de
"replay falha em ambiente limpo" (enum `supplier_raw_status` e tabela
`supplier_products_raw_history` referenciados mas nunca criados no repo). A
investigacao contra o banco revelou que a deriva de junho era MUITO maior que os
intervalos ja reconciliados: **72 migrations aplicadas em producao entre
2026-06-01T18:00 e 2026-06-05T01:28 faltavam no repo** (faixas
`20260601180000`-`20260604165156` e `20260605010642`-`20260605012842`).

Restauradas byte-a-byte de `array_to_string(statements,E'\n')` (md5 DB==arquivo,
**74/74 OK** incluindo os 2 forward abaixo). Apos isso, o slice de junho tem
diff vazio: **repo contem banco** para todas as 119 versoes de junho. Um
`db reset` limpo agora cria o enum
(`20260603215516 raw_landing_phase1_status_provenance`) e a tabela history
(`20260604120414 spr_p3_history_versionamento`) ANTES de serem usados,
eliminando os P1 de replay.

Descoberta-chave: quase todos os P1 dos revisores ja estavam corrigidos em
producao por migrations orfas que faltavam no repo — os revisores so viam os
snapshots intermediarios:

| Achado (Codex/cubic) | Resolucao |
|---|---|
| enum/history criados depois do uso | migrations criadoras agora no repo (replay OK) |
| quarantined re-enfileirado (`status<>'processed'`) | ja corrigido por `20260605011404` (BUG-3b: `status=ANY('{pending,processing}')`) |
| `fn_purge_spr_history` sem REVOKE | ja corrigido por `20260605011613` (ACL: so postgres+service_role) |
| `process_supplier_products_batch` sem REVOKE | ja com ACL so postgres+service_role |
| VSS UPDATE sem `source='raw_v2'` | funcao final ja tem `source='raw_v2'` |
| `fn_process_raw_v2` exec. por anon/authenticated | **forward fix** `20260605014545` (REVOKE) |
| cron `VACUUM` multi-statement em txn block | **forward fix** `20260605014600` (ANALYZE-only) |

### Forward fixes aplicados em producao (aprovados pelo usuario)

- `20260605014545 revoke_fn_process_raw_v2_execute_from_anon_authenticated`
  fecha escalacao: `fn_process_raw_v2` e SECURITY DEFINER e o guard de admin tem
  bypass quando `auth.uid() IS NULL` (chamada anonima via PostgREST /rpc).
  ACL final: `postgres=X | service_role=X` (anon/authenticated removidos).
- `20260605014600 fix_vacuum_analyze_weekly_cron_no_vacuum_in_txn`
  reverte a regressao de `20260604231642`: `VACUUM` nao roda em transaction
  block via pg_cron (mesma licao de `20260602_002_fix_cron_jobs_never_ran`).
  Job recriado com ANALYZE-only; VACUUM fica a cargo do autovacuum tuning.

Itens deixados como nota (nao acionados): `ON CONFLICT (sku)` global em
`20260604173140` (risco de colisao cross-produto, baixo na pratica — o motor
busca variante por (product_id, supplier_sku) antes do insert); `DROP COLUMN
claimed_at` sem tabela de backup em `20260605001830` (coluna ja removida, sem
recuperacao retroativa possivel).

### Forward fix adicional (regressao Spot detectada na 2a rodada de review)

- `20260605020240 restore_spot_name_clean_and_maxlength_in_fn_apply_transform`
  A migration `20260605011952` (guard multiply/divide NULL) fez CREATE OR REPLACE
  de `fn_apply_transform` e PERDEU dois branches que `20260604234647` /
  `20260605000347` haviam adicionado: o `custom -> fn_clean_spot_name` e o cap de
  `max_length`. Efeito vivo no pipeline SPOT: `products.name` deixou de ser limpo
  (caia no ELSE -> valor cru) e `ncm_code`(10)/`short_description`(500) podiam
  estourar. O fix parte do corpo atual (preserva os guards de multiply/divide/
  regex null) e readiciona ambos os branches. Verificado: max_length corta para
  10; branch fn_clean_spot_name presente.

### Hardening abrangente pos-review (CodeRabbit/Codex/cubic) — aprovado pelo usuario

A 2a/3a rodada de review (CodeRabbit 19+ comentarios, Codex, cubic) cobriu o
conjunto reconciliado completo. Cada achado foi verificado contra o estado ATUAL
de producao; muitos ja estavam superados pelo estado final (os revisores viam
snapshots intermediarios). Os fixes ainda vivos foram aplicados como migrations
forward (nao se editou nenhum arquivo historico byte-exato):

- `20260605100708 harden_rls_mcp_sessions_silver_pricetiers_physical_and_dryrun_acl`
  - **P0** `mcp_sessions`: removida policy `FOR ALL TO anon` + REVOKE anon/
    authenticated; acesso so via service_role (guarda `cookie`).
  - `produtos_padronizacao`: policy de escrita ampla de authenticated -> SELECT.
  - `product_physical` / `supplier_price_tiers`: removida escrita de authenticated
    + REVOKE anon (cost_price sensivel); service_role mantem tudo (BYPASSRLS).
  - `fn_dryrun_raw_v2` (SECURITY DEFINER): REVOKE EXECUTE de PUBLIC/anon/authenticated.
- `20260605101258 fix_silver_promotion_cost_isactive_locks_and_races`
  - `fn_standardize_variant`: restaura custo XBZ (`PrecoVenda`) e ASIA (`preco`)
    que a `silver_08g` regrediu; inclui `is_active` no ON CONFLICT.
  - `fn_promote_variants_of_parent`: VSS vira upsert (custo nao fica stale);
    INSERT da variante race-safe via `ON CONFLICT (sku)`.
  - `fn_promote_padronizacao`: `FOR UPDATE` (lock pessimista anti-promocao dupla).
  - `+ SET search_path` nas funcoes do pipeline que estavam sem.
- `20260605101342 fix_silver_safebool_purge_colormatch_dryrun_lockedfields`
  - `fn_safe_bool`: fallback passa a aceitar `active/inactive`.
  - `fn_spr_history_purge`: guard `p_keep_months >= 1`.
  - `fn_match_canonical_color`: normaliza nome/hex (NULLIF) anti-match de string vazia.
  - `fn_dryrun_standardize_supplier`: ignora parent nulo, conta so sucessos reais.
  - `fn_products_capture_manual_edits`: `v_campos` completado (box_*, repacking_type,
    capacities, capacity_ml, colors) p/ proteger edicoes manuais.
- `20260605101432 add_supplier_price_tiers_check_constraints`
  - CHECKs `tier_order>0`, `min_qty>0`, `cost_price>=0`, janela valid_from/to
    (17.722 linhas, 0 violacoes).

Falsos-positivos / ja superados (verificados, sem acao): `fn_apply_transform`
multiply NULL ja tem guard e `replace` com find vazio e no-op nativo do PG;
`fn_spr_before_write` ja tem search_path e nao escreve `images_processed`;
`content_hash` virou coluna normal com DEFAULT (nao GENERATED); `fn_process_raw_v2`
ja usa `status=ANY('{pending,processing}')` e ja teve REVOKE; `process_supplier_
products_batch` ja e so postgres+service_role; `CREATE POLICY IF NOT EXISTS`
(20260601180000) foi aceito e a policy existe; `set_image_url` existe em products.
Issues so-de-replay em migrations historicas ja aplicadas nao foram "corrigidas"
editando os arquivos byte-exatos (quebraria a invariante DB==repo; workflow e
forward-only contra o banco vivo).

### Caveat de replay byte-exato (decisao: manter byte-exato + documentar)

Os arquivos historicos deste conjunto sao **snapshots fieis de producao**, nao
scripts idempotentes de `db reset`/replay from-scratch. Producao esta correta e o
check `Supabase Preview` esta desabilitado para este repo, entao estes achados so
afetariam um replay limpo (que nao usamos: o workflow e forward-only contra o
banco vivo). Por decisao explicita, os arquivos byte-exatos **nao** sao alterados
(manter a invariante DB==repo). Os achados do Codex abaixo ficam **by-design**:

- **P1** `20260605004956_harden_raw_sibling_tables_rls_grants.sql:26` — `REVOKE`
  em `_asia_api_staging` sem guarda `to_regclass`. A tabela e production-only
  (criada fora do repo); em DB fresh sem ela o REVOKE abortaria. Em producao
  existe e o REVOKE e correto.
- **P1** `20260604141743_add_updated_at_triggers_physical_pricetiers.sql:3` —
  usa `moddatetime` (contrib) sem `CREATE EXTENSION` previo. Em producao a
  extensao ja esta instalada; num replay sem ela o trigger abortaria.
- **P2** `20260604141720_create_supplier_price_tiers.sql:19` — RLS sem `GRANT`
  de privilegios de tabela no mesmo arquivo. Em producao os grants vivos cobrem
  o caminho de leitura autenticado; num DB fresh faltaria privilegio.
- **P1** `20260605012421_spr_p1_security_close_bronze_to_anon.sql:2` — `ALTER VIEW`
  em `somarcas_catalogo_publico` antes do `CREATE` (que mora numa migration
  posterior). Em producao a view ja existe; num replay ordenado o ALTER viria
  antes do CREATE.

Se algum dia precisarmos de replay from-scratch confiavel (ex.: reabilitar o
Preview), o caminho e UMA migration forward no tip que torne estes objetos
idempotentes — nunca editar os snapshots historicos.

## 2026-06-10 — Execução das correções da auditoria medallion (11 migrações via MCP)

Aplicadas diretamente no banco `doufsxqlfjyuvxuezpln` via MCP `apply_migration` e
espelhadas 1:1 neste repo (mesmos version/nome):

- `20260610120511_p0_carrossel_01_hash_canonico_e_enrich_tipado`
- `20260610120708_p0_carrossel_02_fix_digest_schema`
- `20260610121302_p0_carrossel_03_content_hash_drop_expression`
- `20260610121713_p0_quarentena_01_promote_failures_marcam_bronze`
- `20260610122207_p0_seguranca_01_fecha_anon_bronze_custos_e_fns`
- `20260610122350_p0_seguranca_02_products_grants_por_coluna_anon`
- `20260610122504_p0_estoque_01_fn_reconcile_stock_gold`
- `20260610122909_p1_historico_01_particionamento_mensal`
- `20260610123120_p1_gold_01_invariantes_indices_e_equivalencias_mortas`
- `20260610123210_p1_health_01_fn_pipeline_health_v2`
- `20260610123510_p1_ingest_01_fn_ingest_supplier_raw_reset_condicional`

ATENÇÃO: as migrações `20260610120000..120500_silver_depara_*` (PR #693) existem
no repo mas NÃO estão aplicadas no banco — decisão registrada no ADR 0009
(aplicá-las regrediria a fn_standardize_variant viva). Reconciliar antes de
qualquer `supabase db push`.

Detalhes, métricas antes/depois e one-shots: docs/EXECUCAO_CORRECOES_MEDALLION_2026-06-10.md
