# Auditoria de índices não utilizados — Maio/2026

> Bug P2-07 da Missão Zero Bug 24/05/2026

## Resumo

- **385 índices não-utilizados** no schema `public` (idx_scan = 0)
- **Total: 36 MB** ocupados sem retorno em consultas SELECT
- **150** com tamanho < 16 KB (impacto residual ao dropar — pode pular)
- **3** com > 1 MB (alvos prioritários de revisão)

## Política

**NÃO dropar automaticamente.** Algumas razões pelas quais um índice pode
ter `idx_scan = 0` mas ainda ser necessário:

1. **Recém-criado** (últimas 24-48h) — pg_stat ainda não acumulou uso.
   Os 9 índices criados em `20260524213000_index_unindexed_foreign_keys.sql`
   estão nesta categoria e devem ficar.

2. **Suporta DELETE/UPDATE em FK** — quando o pai é deletado, Postgres
   precisa varrer filhos pra checar referências. idx_scan conta apenas
   SELECTs que usam o índice; checks de FK não contam.

3. **Backup de planos B do Query Planner** — em outliers (queries pouco
   frequentes mas grandes), o planner pode escolher esses índices só em
   alguns cenários. Estatísticas semanais necessárias antes de drop.

4. **Reset recente do `pg_stat_user_indexes`** — após VACUUM FULL,
   restart do server, ou ANALYZE com `pg_stat_reset()`, os contadores
   zeram. Não confiar em <14 dias de coleta.

## Top 25 candidatos a revisão (size > 100 KB)

| Tabela | Índice | Tamanho | Linhas | Avaliação |
|---|---|---|---|---|
| supplier_products_raw | idx_supplier_products_raw_data | 16 MB | 16.508 | **AVALIAR DROP**: índice de busca em JSON enorme; possivelmente sobrou de tentativa antiga |
| product_images | idx_unique_product_filename | 4.0 MB | 46.122 | **MANTER**: nome diz "unique"; índice anti-dup mesmo sem SELECT |
| image_validation_log | idx_image_validation_log_image | 2.0 MB | 46.291 | **AVALIAR DROP**: tabela de log raramente lida |
| product_materials | idx_product_materials_composite | 896 KB | 9.645 | **MANTER**: composite key, suporta JOINs |
| product_images | idx_product_images_seo | 832 KB | 46.122 | **AVALIAR DROP**: SEO pode estar inativo |
| variant_supplier_sources | variant_stocks_unique_idx | 816 KB | 16.456 | **MANTER**: UNIQUE constraint |
| product_relationships | idx_product_relationships_related_product_id | 800 KB | 107.921 | **MANTER**: criado em P1-09 (recém) |
| product_images | idx_product_images_type_id | 712 KB | 46.122 | AVALIAR |
| products | idx_products_slug_unique | 712 KB | 6.123 | **MANTER**: slug é único, usado em pretty URLs |
| product_images | idx_product_images_type | 696 KB | 46.122 | AVALIAR (duplica `idx_product_images_type_id`?) |
| product_images | idx_product_images_org | 592 KB | 46.122 | **MANTER**: multi-tenant filter |
| product_images | idx_product_images_active | 560 KB | 46.122 | AVALIAR |
| supplier_import_batches | idx_supplier_import_batches_supplier_id | 384 KB | 52.981 | **MANTER**: criado em P1-09 |
| product_images | idx_product_images_primary | 336 KB | 46.122 | **MANTER**: hot path do carrossel |
| product_tags | product_tags_tag_id_idx | 320 KB | 23.449 | **MANTER**: FK busca |
| product_commemorative_dates | idx_..._category_id_fk | 232 KB | 31.210 | **MANTER**: legacy do P1-09 (vamos ter que ver se idx_..._category_id atual cobre — possível duplicata) |
| product_commemorative_dates | idx_..._commemorative_date_id | 232 KB | 31.210 | **MANTER**: criado em P1-09 |
| supplier_products_raw | idx_supplier_products_raw_hash | 216 KB | 16.508 | **MANTER**: dedup hash |
| supplier_products_raw | idx_spr_batch | 136 KB | 16.508 | AVALIAR |
| variant_supplier_sources | idx_..._supplier_id_fk | 136 KB | 16.456 | **CHECAR DUPLICATA**: criamos `idx_variant_supplier_sources_supplier_id` no P1-09; este é o legado |
| variant_supplier_sources | idx_..._supplier_branch_id | 136 KB | 16.456 | **MANTER**: criado em P1-09 |
| product_variants | idx_product_variants_size_id | 128 KB | 16.456 | **MANTER**: criado em P1-09 |
| product_materials | idx_product_materials_active | 128 KB | 9.645 | AVALIAR |
| product_materials | idx_product_materials_org | 120 KB | 9.645 | **MANTER**: multi-tenant |

## Recomendação imediata: DROPAR APENAS DUPLICATAS

Identificadas no P1-09 (índices recém-criados COBREM os antigos `_fk`):

| Antigo (drop candidate) | Novo (criado em P1-09) | Tabela |
|---|---|---|
| `idx_product_commemorative_dates_category_id_fk` | `idx_product_commemorative_dates_category_id` | product_commemorative_dates |
| `idx_variant_supplier_sources_supplier_id_fk` | `idx_variant_supplier_sources_supplier_id` | variant_supplier_sources |

**Estas duplicatas podem ser dropadas em segurança** — ambos cobrem a mesma
coluna na mesma tabela. Economia ~360 KB + redução de I/O em INSERT/UPDATE.

## Recomendação para 30 dias depois (15/06/2026 +)

Após acumular 30d de stats, re-rodar `SELECT FROM pg_stat_user_indexes WHERE
idx_scan = 0` e considerar drop dos candidatos AVALIAR acima. Critério para
drop:
1. idx_scan ainda 0 após 30 dias de produção
2. NÃO é UNIQUE constraint
3. NÃO suporta FK de tabela child grande
4. NÃO foi criado nos últimos 7 dias

## Comandos para dropar duplicatas (revisar antes!)

```sql
-- DRY RUN: ver impacto
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.product_commemorative_dates 
WHERE category_id = 'some-uuid' LIMIT 1;
-- Se usa idx_product_commemorative_dates_category_id (novo), OK pra dropar o _fk legacy.

-- DROP duplicatas (após confirmar via EXPLAIN):
DROP INDEX CONCURRENTLY IF EXISTS public.idx_product_commemorative_dates_category_id_fk;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_variant_supplier_sources_supplier_id_fk;
```

## Status final

✅ Auditoria documentada
⏸️ Drop pendente — exige decisão humana + janela de manutenção
📅 Reavaliação programada: 15/06/2026 (≥ 21 dias após criação dos novos FKs)
