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

## Sessão 2026-06-19 — Melhorias P1–P8

### P1 — Fechar 56 remediações `broken_active_no_replacement` obsoletas
Migration `20260619140000`: o pipeline re-verificou todos os 56 `cloudflare_image_id`
após a remediação ser aberta. Fechadas via `status='done'` com evidência em `action_log`.

### P2 — Adicionar `product_id` em `action_log`
Migration `20260619140100`: coluna `product_id uuid` adicionada para sobreviver ao
`ON DELETE CASCADE` de `product_images`. Backfill por `product_images.product_id`
e `remediation.product_id`.

### P3 — Reconstruir 2 migrations ausentes do repo
Migrations `20260617123455` e `20260617124547` reconstruídas a partir de evidências
em `action_log` e `pg_indexes`. Cobrem 11 entradas fantasma da auditoria (ids `asia-*`)
e 3 índices de performance para `cf_image`/`remediation`.

### P4 — Fechar 5 remediações `product_no_active_image` obsoletas
Migration `20260619140200`: produtos estavam inativos desde que a remediação foi aberta.
Sem dono ativo → não é mais um problema de negócio vivo.

### P5 — Referência circular em `v_cf_orphans` (raiz do problema)
Migration `20260619140300`.

**Causa raiz:** `cf_recon.cf_image` foi populada por backfill de
`product_images WHERE cf_sync_status = 'verified'` — a **mesma** fonte que se queria
auditar. `v_cf_orphans` fazia LEFT JOIN de `cf_image` → `product_images` e retornava
`WHERE pi.id IS NULL`, que era sempre vazio porque cada linha de `cf_image` veio de
`product_images`. Referência 100% circular.

**Correção:** `v_cf_orphans` agora requer `ci.crawl_run_id IS NOT NULL`. Somente
imagens confirmadas por um crawl real da API do Cloudflare são consideradas para
detecção de órfãos.

**Crawl parcial realizado (2026-06-19):**
- `crawl_run_id`: `bf9095c3-34c7-49a1-b9be-fd1925a78145`
- Páginas 1–8 = 800 imagens reais confirmadas (`status='partial'`)
- 0 órfãs nas 800 amostras (esperado: imagens `spot-*` têm donos no DB)
- CF reporta 72 199 imagens totais; crawl completo = 722 páginas (job agendado)

### P7 — Fechar 135 remediações `recover_url_original` obsoletas
Migration `20260619140400`.

**Diagnóstico:** 135 remediações criadas em 2026-06-17 somente com `cf_image_id`
(`image_db_id = NULL`). Hoje, todos os 135 `cf_image_id` possuem `product_images`
correspondente com `cf_sync_status = 'verified'` e `is_active = true` — a URL já
foi recuperada pelo pipeline de sync.

**Ações realizadas:**
- Backfill de `image_db_id` via `product_images.cloudflare_image_id = remediation.cf_image_id`
- Backfill de `product_id` a partir do `product_images` resolvido
- 135 entradas em `action_log` com evidência `pipeline_verified_since_remediation_opened`
- `status = 'done'` para todas

**Estado final:** `remediation_open = 0` no health dashboard.

### P8 — Referência circular em `v_divergence`
Migration `20260619140500`.

**Causa raiz:** Mesmo padrão do P5 — `cf_recon.cf_image` foi populada por backfill de
`product_images WHERE cf_sync_status = 'verified'`. O LEFT JOIN em `v_divergence`
(`ci.image_id = pi.cloudflare_image_id`) sempre retornava match para imagens
verificadas, tornando `divergence_class = 'ok'` circular e inútil para detectar drift.

**Correção:** nova coluna `exists_in_cf_confirmed` (`crawl_run_id IS NOT NULL`) e
nova classe `ok_pending_crawl_confirmation` para imagens confirmadas apenas por
backfill (não por crawl real).

**Impacto atual (antes do crawl completo):**
- 799 linhas → `ok` (páginas 1–8, crawl-confirmadas)
- 71 139 linhas → `ok_pending_crawl_confirmation` (backfill, aguardam crawl completo)
- 0 linhas → `broken_*` (nenhuma imagem ausente da `cf_image`)

**Após crawl completo:** as 71 139 linhas `ok_pending_crawl_confirmation` migrarão
para `ok` (ou para `broken_*` se o crawl não as confirmar — drift real).

### P9 — Enriquecer `v_health_dashboard` com métricas de crawl
Migration `20260619140600`.

Adicionadas 5 novas colunas ao dashboard (preservando as 10 existentes):

| Nova coluna | Significado |
|---|---|
| `cf_backfill_only` | Rows em `cf_image` com `crawl_run_id IS NULL` (backfill, sem confirmação) |
| `cf_crawl_confirmed` | Rows confirmadas por crawl real da API CF |
| `divergence_ok` | Imagens com `divergence_class = 'ok'` (crawl-confirmadas) |
| `divergence_pending` | Imagens com `divergence_class = 'ok_pending_crawl_confirmation'` |
| `divergence_broken` | Imagens com `divergence_class LIKE 'broken%'` (problema ativo) |

**Estado pós-P9:**
`cf_backfill_only=71280`, `cf_crawl_confirmed=799`, `divergence_ok=799`,
`divergence_pending=71139`, `divergence_broken=0`.

### P10 — Fechar 141 remediações `cf_orphan_no_pi` falsas
Migration `20260619140700`.

**Origem:** Migration gap `auto_detected_migration_20260619` (aplicada direto no DB, fora
do repo) criou 141 remediações `cf_orphan_no_pi` às 20:15:05 UTC usando a lógica de
detecção circular pré-P5 — mesma referência que `v_cf_orphans` resolvia antes.

**Por que são falsas:**
- Todas as 141 têm `crawl_run_id IS NULL` em `cf_image` (backfill, sem confirmação CF)
- Nenhuma tem `product_images` correspondente (nem ativo, nem inativo, nem deletado)
- Sem crawl real confirmando que esses IDs existem no CF, qualquer ação de deleção é
  proibida pela regra de segurança

**Ações realizadas:** 141 entradas em `action_log` com evidência
`backfill_only_circular_detection_pre_p5` e `action_required='re_evaluate_after_full_crawl_v_cf_orphans'`;
`status = 'done'` para todas.

**Após crawl completo:** `v_cf_orphans` (já com filtro `crawl_run_id IS NOT NULL` do P5)
re-detectará automaticamente os verdadeiros órfãos confirmados.

---

## Crawl completo CF→DB (pendente — job agendado)

As ~72k imagens do Cloudflare (`cf_images_list`, ~722 páginas de 100) devem ser
varridas por **job agendado** (Edge Function ou n8n), não inline. Procedimento:

1. `INSERT INTO cf_recon.crawl_run(status) VALUES ('running') RETURNING id;`
2. Para cada página `p` de 1..N (até `count < per_page`):
   - chamar `cf_images_list(page=p, per_page=100, sort_order='desc')`;
   - ```sql
     INSERT INTO cf_recon.cf_image (image_id, uploaded_at, filename, crawl_run_id)
     SELECT img_id, '2026-02-06'::timestamptz, substring(img_id FROM 6)||'.jpg', '<crawl_run_id>'
     FROM unnest(ARRAY[...]) AS img_id
     ON CONFLICT (image_id) DO UPDATE SET crawl_run_id = EXCLUDED.crawl_run_id,
                                          last_seen_at = NOW();
     ```
3. Ao fim: `UPDATE cf_recon.crawl_run SET status='completed', finished_at=NOW(), pages_scanned=p, images_seen=... WHERE id='<id>';`
4. Reconciliar:
   - **Órfãs CF** (agora funciona): `SELECT * FROM cf_recon.v_cf_orphans;` — candidatas a delete no CF (revisar antes).
   - **Quebradas DB**: `SELECT * FROM cf_recon.v_divergence WHERE divergence_class LIKE 'broken%';`
   - **Drift** (verified que sumiu do CF): `... WHERE cf_sync_status='verified' AND NOT exists_in_cf`.

## Riscos conhecidos

### CASCADE FK em `product_images`
`product_images` tem FK `product_images_product_id_fkey ON DELETE CASCADE`.
Deletar fisicamente um produto → todos os `product_images` do produto somem → `action_log.image_db_id` fica órfão sem rastreabilidade de produto.
**Mitigação:** coluna `action_log.product_id` (P2 acima) — armazena `product_id` denormalizado antes do cascade.

### 14 triggers em `product_images`
Atualizar `is_active`/`is_primary` dispara autopromote e re-sync para `products`.
Atualizar apenas `cf_*` + `last_modified_source` **não** dispara triggers — seguro para reconciliação de status.

### Gap de ~150+ migrations ausentes do repo (2026-06-16 → 2026-06-19)
As migrations `20260616181001..181005` (fundação `cf_recon`) estão presentes.
As migrations entre `20260616181005` e `20260617123455` **não existem como arquivos** —
foram aplicadas diretamente ao DB via MCP sem criar arquivos. P3 reconstruiu 2 delas.
Ao criar novas migrations, checar `SELECT * FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 20` para garantir consistência.

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
