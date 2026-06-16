# Runbook — Reconciliação Cloudflare Images × `product_images`

Projeto Gold SSOT: `doufsxqlfjyuvxuezpln`. Schema dedicado: `cf_recon` (não exposto via PostgREST).

## Contexto

A tabela `public.product_images` referencia imagens hospedadas no Cloudflare Images
através de `cloudflare_image_id` (UNIQUE — mapeamento injetivo DB→CF). Divergências
surgem porque o pipeline e o bot Lovable inserem/alteram referências sem garantir que
o asset exista no CF, e porque imagens são removidas do CF sem limpar a referência.

## Objetos criados (migrations `20260616181001..181005`)

| Objeto | Função |
|---|---|
| `cf_recon.cf_image` | Inventário do CF (preenchido pelo crawl). |
| `cf_recon.crawl_run` | Auditoria de execuções de crawl (resumível). |
| `cf_recon.action_log` | Trilha imutável de toda reclassificação/quarentena. |
| `cf_recon.metric_snapshot` | Snapshots de KPI ao longo do tempo. |
| `cf_recon.remediation` | Fila de trabalho manual (re-upload, produtos sem imagem). |
| `cf_recon.v_verification_queue` | Fila real de verificação (sem deletados/`hash_legacy`). |
| `cf_recon.v_divergence` | Classificação linha-a-linha (requer crawl). |
| `cf_recon.v_cf_orphans` | Imagens no CF sem dono no DB (custo recuperável). |
| `cf_recon.v_products_without_active_image` | D6 — produtos sem imagem ativa. |
| `cf_recon.v_inactive_alive` / `_cf_cost` | D5 — inativas vivas e seu custo no CF. |
| `cf_recon.v_health_dashboard` | KPI único da reconciliação. |

## Estado aplicado em 2026-06-16

- **185** referências não-`seq` confirmadas ausentes no CF → marcadas `missing` (com auditoria).
- **24** imagens ativas+quebradas com irmã `verified` → desativadas (autopromote trocou a primária).
- **56** ativas+quebradas sem substituta → fila `broken_active_no_replacement` (re-upload).
- **5** produtos ativos sem imagem → fila `product_no_active_image`.
- Verificação que `produtos_ativos_sem_primaria = 0` após as desativações.

## Pendente para 10/10 — Crawl completo CF→DB (direção órfã)

A amostra (~2,3% órfãs) indica órfãos minoritários, mas o número exato exige varrer
as ~72k imagens do Cloudflare (`cf_images_list`, ~721 páginas de 100). Isso deve rodar
como **job agendado** (Edge Function ou n8n), não inline. Procedimento:

1. `insert into cf_recon.crawl_run(status) values ('running') returning id;`
2. Para cada página `p` de 1..N (até `count < per_page`):
   - chamar `cf_images_list(page=p, per_page=100, sort_order='desc')`;
   - `insert into cf_recon.cf_image (image_id, uploaded_at, filename, crawl_run_id)`
     `... on conflict (image_id) do update set last_seen_at = now();`
3. Ao fim: `update cf_recon.crawl_run set status='completed', finished_at=now(), pages_scanned=p, images_seen=...`.
4. Reconciliar:
   - **Órfãs CF**: `select * from cf_recon.v_cf_orphans;` (candidatas a delete no CF — revisar antes).
   - **Quebradas DB**: `select * from cf_recon.v_divergence where divergence_class like 'broken%';`
   - **Drift** (verified que sumiu do CF): `... where cf_sync_status='verified' and not exists_in_cf`.

## Regras de segurança (NÃO violar)

- **Nunca** deletar imagem no Cloudflare sem confirmar ausência de dono ativo na `v_divergence`
  (IDs do CF podem ser case-sensitive; comparar valor exato).
- **Nunca** `DELETE` físico de linhas de `product_images` — usar `is_active=false` / `deleted_at`.
- Atualizar apenas colunas `cf_*` + `last_modified_source` quando o objetivo for status:
  isso **não** dispara os triggers de cascata (`trg_sync_product_images_update`, etc.).
- Mudar `is_active`/`is_primary` **dispara** autopromote e re-sync para `products` — intencional,
  mas só desativar imagem quebrada se o produto tiver outra imagem saudável.
- Carimbar `last_modified_source='claude'` (ou `'migration'`) em toda alteração para auditoria.

## Verificação rápida

```sql
select * from cf_recon.v_health_dashboard;
select kind, status, count(*) from cf_recon.remediation group by 1,2 order by 1,2;
select action, count(*) from cf_recon.action_log group by 1;
```
