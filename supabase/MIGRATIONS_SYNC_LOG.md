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
