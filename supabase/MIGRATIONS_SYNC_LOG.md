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
