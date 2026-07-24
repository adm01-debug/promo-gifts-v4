# Auditoria Exaustiva Supabase — 20 Etapas

**Data:** 02/06/2026  
**Executor:** Claude Sonnet 4  
**Projeto:** `doufsxqlfjyuvxuezpln`

## Metricas Gerais

| Metrica | Valor |
|---------|-------|
| DB Size | 426 MB |
| Tabelas | ~180 |
| Funcoes | 805 |
| Triggers | 347 |
| Indices sem uso | 142 |
| FK sem indice | 60 |
| Cache hit ratio | 99.95% |
| Conexoes ativas | 1/90 |
| Cron jobs NUNCA ran | 2 |

## Problemas Criticos (P0)

### 1. vacuum-analyze-weekly NUNCA EXECUTOU
- `last_run = null` — job configurado mas nunca rodou
- Causa: product_images com 10.11% dead tuples sem autovacuum
- Fix: migration 002 + VACUUM manual via Dashboard

### 2. cleanup-log-tables-weekly NUNCA EXECUTOU  
- `last_run = null`
- admin_audit_log cresceu para 50MB (35.936 rows)
- frontend_telemetry cresceu para 30MB (31.341 rows)
- Fix: migrations 002 + 003

### 3. 142 indices nunca utilizados
- Penalizam cada INSERT/UPDATE sem beneficio em leituras
- Fix: migration 004 (remove os 8 mais pesados)

### 4. 60 FK sem indice de cobertura
- Causes full table scans em JOINs criticos
- Fix: migration 001

## Problemas de Performance (P1)

### 5. products com 36 TRIGGERS
- INSERT: 10+ BEFORE + 4+ AFTER triggers
- Batch de 100 produtos = 3.600 execucoes de funcao
- Solucao recomendada: usar fn_is_bulk_import_mode() para pular triggers

### 6. product_variants com 20 TRIGGERS
- Chain de sync stock + colors + sizes em cada variante

### 7. product_images: 10.11% dead tuples
- autovacuum_count = 0, last_autovacuum = NULL
- 4.661 dead rows em 46.122 live rows

## Problemas de Integridade (P2)

### 8. smoke_test_runs vs smoke_tests_runs
- Tabela nova: 14 rows (vazia relativa)
- Tabela antiga: 28 rows (dados reais)
- Views de smoke test podem estar consultando tabela errada

### 9. frontend_telemetry: user_id = NULL em 100% dos registros
- Bug de instrumentacao no frontend
- 31.341 registros sem associacao de usuario

### 10. Funcoes legacy nao removidas
- fn_simular_combo_gravacao_v8_legacy
- fn_simular_combo_gravacao_v9_legacy_2026_04
- Ainda presentes junto com v10, v11, v12

## Acoes Imediatas (Manual — Dashboard SQL Editor)

```sql
-- URGENTE: Execute no Supabase Dashboard
VACUUM ANALYZE public.product_images;
VACUUM ANALYZE public.product_relationships;
VACUUM ANALYZE public.products;
VACUUM ANALYZE public.product_variants;
VACUUM ANALYZE public.supplier_import_batches;
VACUUM ANALYZE public.admin_audit_log;
VACUUM ANALYZE public.frontend_telemetry;
```

## Migrations neste PR

1. `20260602_001_add_fk_indexes_critical.sql` — 50+ indices FK
2. `20260602_002_fix_cron_jobs_never_ran.sql` — Recria cron jobs
3. `20260602_003_log_retention_policy.sql` — Politica de retencao
4. `20260602_004_remove_unused_indexes_safe.sql` — Remove indices inuteis
