# 🧪 Relatório Exaustivo de Testes — Motor V2 (Bronze Layer)

> Gerado em 2026-06-05 · Branch `claude/bronze-table-analysis-K5inv`

## Resumo executivo

O Motor V2 (`fn_process_raw_v2`) e todas as melhorias implantadas em 2026-06-04/05 estão
**funcionando corretamente em produção**. Foram encontrados **3 bugs** que não afetam o DB
em produção mas afetam a rastreabilidade e a segurança de tipo do código-fonte.

| # | Severidade | Bug | Status |
|---|---|---|---|
| 1 | 🔴 CRÍTICO | **28 migrações de produção fora do git** | Aberto |
| 2 | 🟠 ALTO | **Versão divergente de 2 migrações no repo** | Aberto |
| 3 | 🟡 MÉDIO | **TypeScript types com 3 colunas removidas** | **CORRIGIDO** neste PR |

---

## 1. Escopo dos testes

### 1.1. Testes automatizados

| Suite | Resultado |
|---|---|
| Vitest (contratos) | **574/574 ✅** |
| TypeScript baseline | **103 erros (sem regressão) ✅** |
| Playwright/E2E | N/A — excluídos do runner vitest (comportamento esperado) |

### 1.2. Testes manuais no DB de produção (`doufsxqlfjyuvxuezpln`)

Foram executadas consultas SQL diretas para verificar cada aspecto do Motor V2.

---

## 2. Verificações do estado do DB em produção

### 2.1. Colunas da tabela `supplier_products_raw`

**Colunas removidas (atributos com `attisdropped=true`):**

| Posição | Nome original | Status |
|---|---|---|
| 5 | `raw_hash` | DROPPED ✅ |
| 8 | `processed` | DROPPED ✅ |
| 14-15 | (desconhecido) | DROPPED ✅ |
| 22 | `claimed_at` | DROPPED ✅ |

**Colunas ativas (27 total, 23 ativas):** `id`, `supplier_id`, `supplier_reference`,
`raw_data`, `imported_at`, `import_batch_id`, `processed_at`, `process_errors`,
`product_id`, `created_at`, `updated_at`, `supplier_sku`, `variant_id`, `source_channel`,
`source_event_id`, `source_endpoint`, `attempts`, `last_error`, `status`, `images_status`,
`content_hash`, `images_processed`.

### 2.2. Índices

**Antes (13 índices)** → **Depois (7 índices)**. Remoção dos índices ociosos:

| Índice removido | Por quê |
|---|---|
| `idx_spr_processed` (`WHERE processed=false`) | Coluna `processed` foi removida |
| `idx_spr_queue` (`WHERE status='pending'`) | Substituído |
| `idx_spr_images_queue` | Substituído |
| `idx_spr_failed` | Substituído |
| `idx_spr_content_hash` | 4 MB, apenas 3 scans |
| `idx_spr_reference` | Baixo uso |

**Índice novo adicionado:**
```sql
CREATE INDEX idx_spr_unprocessed ON supplier_products_raw
  USING btree (supplier_id, imported_at)
  WHERE status <> 'processed'::supplier_raw_status;
```

### 2.3. Triggers

**Antes (6)** → **Depois (3)**. Consolidação:

| Trigger novo | Substitui |
|---|---|
| `trg_spr_before_write` (BEFORE ROW) | `trg_aa_spr_normalize` + `trg_set_initial_state` + `trg_zz_sync_raw_status` + `set_updated_at_trigger` |
| `trg_spr_history` (AFTER ROW) | inalterado |
| `trg_auto_sync_product_dimensions` (AFTER ROW) | inalterado |

### 2.4. Função `fn_process_raw_v2` — verificações cirúrgicas

| Verificação | Esperado | Resultado |
|---|---|---|
| NÃO usa `processed = false` | true | ✅ PASS |
| NÃO usa `raw_hash` | true | ✅ PASS |
| NÃO usa `claimed_at` | true | ✅ PASS |
| Usa `status NOT IN ('processed', 'quarantined')` | true | ✅ PASS |
| Tem `FOR UPDATE SKIP LOCKED` | true | ✅ PASS |
| Tem `pg_try_advisory_xact_lock` | true | ✅ PASS |
| Marca `status='failed'` em erro de variante | true | ✅ PASS |
| Tamanho do corpo (chars) | ~16.090 | ✅ PASS |

### 2.5. Bug #3 original — 499 "processed" com erros silenciados

```sql
SELECT count(*) FROM supplier_products_raw
WHERE status='processed' AND process_errors IS NOT NULL;
-- Resultado: 0
```

**Status: ✅ CORRIGIDO** — zero linhas processadas com erro silenciado.

### 2.6. Estado atual dos dados

| Métrica | Valor |
|---|---|
| Total de linhas | 16.508 |
| `status = 'processed'` | 16.508 (100%) |
| `process_errors IS NOT NULL` | 0 |
| `images_status = 'pending'` | ~11.641 (70,5%) |
| Fornecedores com `product_id` nulo | 5 (4 testes XBZ + 1 Asia) |

### 2.7. Funções relacionadas

| Função | Colunas removidas | Advisory lock | Status enum correto |
|---|---|---|---|
| `fn_process_raw_v2` | ✅ Nenhuma | ✅ Sim | ✅ Sim |
| `fn_dryrun_raw_v2` | ✅ Nenhuma | N/A (dry-run) | ✅ Sim |
| `fn_spr_before_write` | ✅ Nenhuma (usa `status <> 'processed'`) | N/A | ✅ Sim |
| `fn_spr_history` | ✅ Nenhuma | N/A | ✅ N/A |

### 2.8. Views

As 20 views que referenciam `supplier_products_raw` usam o padrão
`status = 'processed'::supplier_raw_status` (enum), **não** a coluna booleana removida.
Nenhuma view está quebrada.

---

## 3. Bugs encontrados

### 🔴 BUG #1 — 28 migrações de produção não rastreadas no git

**Severidade:** CRÍTICO para reprodutibilidade do ambiente  
**Impacto:** Deploy fresh do repo cria schema diferente do produção

**Detalhes:** 28 migrações foram aplicadas ao DB de produção entre 2026-06-04 23:16 e
2026-06-05 01:07, mas NENHUMA delas existe no diretório `supabase/migrations/`:

| Versão | Nome |
|---|---|
| 20260604231622 | `spr_drop_redundant_index` |
| 20260604231629 | `spr_drop_bkp_table` |
| 20260604231631 | `spr_harden_grants_rls` |
| 20260604231642 | `spr_maintenance_and_history_retention` |
| **20260604231826** | **`spr_cutover_status_part1`** ← drop da coluna `processed` |
| **20260604232403** | **`spr_cutover_status_part2`** ← finalização do cutover |
| 20260604232535 | `spr_before_write_search_path` |
| 20260604232837 | `upgrade_fn_apply_transform_add_missing_transforms` |
| **20260604232944** | **`upgrade_fn_process_raw_v2_fix_race_condition_and_counters`** |
| **20260604234507** | **`fix_fn_process_raw_v2_status_column`** |
| 20260604234647 | `restore_fn_clean_spot_name_branch_in_apply_transform` |
| **20260604235853** | **`spr_drop_unused_partial_indexes`** ← remoção dos 6 índices |
| 20260605000239 | `fix_raw_v2_product_type_mapping_parity` |
| 20260605000347 | `raw_v2_transform_maxlength_and_spot_overflow_caps` |
| 20260605001811 | `spr2_state_integrity_and_wiring` |
| **20260605001830** | **`spr2_images_generated_drop_claimed`** ← drop da coluna `claimed_at` |
| 20260605001850 | `spr2_motor_quarantine_terminal` |
| 20260605001911 | `spr2_history_old_version_and_index_cleanup` |
| 20260605001917 | `spr2_autovacuum_tuning` |
| 20260605002044 | `harden_fn_clean_spot_name_unicode_spaces` |
| **20260605002243** | **`fix_fn_process_raw_v2_use_status_enum`** ← BUG principal corrigido |
| 20260605002302 | `fix_process_supplier_products_batch_use_status_enum` |
| **20260605002334** | **`fix_fn_process_raw_v2_integer_cast_and_failed_status`** ← BUG-1+BUG-3 |
| 20260605002346 | `fix_trigger_limpar_nome_capitalize_after_strip` |
| 20260605002357 | `backfill_locked_fields_brand_manual_edits` |
| 20260605004956 | `harden_raw_sibling_tables_rls_grants` |
| 20260605010642 | `20260605130000_spr2_fix_motor_quarantine_terminal` |
| 20260605010707 | `20260605130100_spr2_fix_idx_unprocessed_predicate` |

**Ação necessária:** Recuperar o SQL de cada migração via `supabase_migrations.schema_migrations.statements`
e criar os arquivos `.sql` correspondentes no repo.

---

### 🟠 BUG #2 — Versão divergente de 2 migrações no repo

**Severidade:** ALTO — pode causar re-aplicação acidental em `supabase db push`  
**Impacto:** As migrações seriam aplicadas duas vezes com versão diferente

| Arquivo no repo | Versão no repo | Versão no DB | Nome |
|---|---|---|---|
| `20260604220000_fix_spot_name_cleaning.sql` | `20260604220000` | `20260604214100` | `fix_spot_name_cleaning` |
| `20260604221000_fix_raw_v2_race_and_batch_spam.sql` | `20260604221000` | `20260604214243` | `fix_raw_v2_race_and_batch_spam` |

As mesmas migrações foram aplicadas ao DB com timestamps anteriores aos dos arquivos no repo.

**Ação necessária:** Renomear os arquivos no repo para corresponder às versões do DB,
**ou** registrar as versões do repo na tabela `supabase_migrations.schema_migrations`
como aliás para evitar re-aplicação.

---

### 🟡 BUG #3 — TypeScript types com 3 colunas removidas

**Severidade:** MÉDIO — erro de tipo silencioso, não causa falha em runtime no estado atual  
**Impacto:** `supabase.from('supplier_products_raw').select('processed')` compilaria mas
falharia em runtime

**Colunas stale** encontradas em `src/integrations/supabase/types.ts`:

| Coluna | Row | Insert | Update |
|---|---|---|---|
| `claimed_at: string \| null` | ❌ linha 24565 | ❌ linha 24592 | ❌ linha 24619 |
| `processed: boolean \| null` | ❌ linha 24575 | ❌ linha 24602 | ❌ linha 24629 |
| `raw_hash: string \| null` | ❌ linha 24579 | ❌ linha 24606 | ❌ linha 24633 |

**Nullability incorreta** (live DB tem NOT NULL, types tinham `| null`):

| Campo | Antes | Depois |
|---|---|---|
| `created_at` | `string \| null` | `string` |
| `imported_at` | `string \| null` | `string` |
| `updated_at` | `string \| null` | `string` |

**Status: ✅ CORRIGIDO** neste commit — `types.ts` atualizado para refletir o schema real.

---

## 4. Confirmação das melhorias implantadas

### ✅ Race condition / batch spam — CORRIGIDO

A função usa `pg_try_advisory_xact_lock(hashtext('fn_process_raw_v2_' || p_supplier_id::text))`
para garantir que apenas uma execução por fornecedor por vez processe a fila.

### ✅ BUG original: 499 "processed" com erros — CORRIGIDO

`process_errors IS NOT NULL WHERE status='processed'` = **0 linhas**.

### ✅ Cast seguro de inteiros — CORRIGIDO

A função usa cast `ROUND(v_tv::numeric)::bigint` para campos inteiros em vez de cast direto,
evitando erros de overflow com valores como `"1000.0"`.

### ✅ Status `failed` em erro de variante — CORRIGIDO

Em bloco `EXCEPTION WHEN OTHERS`, a função agora executa:
```sql
UPDATE supplier_products_raw
   SET status = 'failed'::supplier_raw_status,
       process_errors = jsonb_build_object('error', SQLERRM, 'stage', 'variant', 'timestamp', now())
 WHERE id = v_row.id;
```

### ✅ Colunas removidas não referenciadas em nenhuma função live

Varredura de `pg_proc` por `processed = false`, `raw_hash`, `claimed_at` em todas as funções
do namespace `public`: **zero ocorrências**.

---

## 5. Recomendações prioritárias

1. **BUG #1:** Exportar e commitar as 28 migrações ausentes via:
   ```sql
   SELECT version, name, statements
   FROM supabase_migrations.schema_migrations
   WHERE version > '20260604221000'
   ORDER BY version;
   ```

2. **BUG #2:** Sincronizar versões das 2 migrações divergentes. Opção simples:
   ```sql
   INSERT INTO supabase_migrations.schema_migrations (version, name)
   VALUES ('20260604220000', 'fix_spot_name_cleaning'),
          ('20260604221000', 'fix_raw_v2_race_and_batch_spam')
   ON CONFLICT DO NOTHING;
   ```

3. **Imagens pendentes:** 11.641 SKUs (70,5%) ainda com `images_status='pending'`.
   Acionar pipeline de imagens para XBZ (10.394) e Asia (1.245).

4. **Cobertura Silver:** Apenas 37,8% dos 16.508 registros bronze foram promovidos
   para `produtos_padronizacao` (silver). Meta: aumentar para ≥80%.
