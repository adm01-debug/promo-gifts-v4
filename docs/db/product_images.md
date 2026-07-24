# `product_images` — Laudo técnico e hardening (Gold / `doufsxqlfjyuvxuezpln`)

> Última atualização: 2026-06-16. Análise + hardening + melhorias E1-E10 (score 59.7% → 72.5%).

## 1. O que é

Tabela-fato de mídia do catálogo na camada **Gold** do Medallion. Cada linha = **uma imagem
física** de um produto, hospedada no **Cloudflare Images** (`imagedelivery.net`), com
classificação semântica, ordenação, metadados SEO e rastreabilidade de fornecedor.

É a **fonte da verdade de imagens**. A tabela `products` **não** é dona das imagens — recebe
projeções desnormalizadas (`images`, `primary_image_url`, `og_image_url`, `set_image_url`,
`primary_image_fallback_url`) **mantidas pelos triggers** desta tabela.

Perfil (2026-06-16): **73.210 linhas / ~7.118 produtos** (~10 imagens/produto),
73.194 ativas (16 inativas), **exatamente 1 primária por produto**.

## 2. Relacionamentos ("com quem convive")

- **Aponta para:** `products` (CASCADE), `product_variants` (SET NULL), `color_variations`
  (SET NULL), `image_types` (vocabulário), `organizations`.
- **É apontada por:** `image_validation_log` (CASCADE), `archive.media_sync_log` (SET NULL),
  `backup._deprecated_silver_images_queue_*` (SET NULL — resíduo da camada Silver).
- **View:** `v_product_images_cdn` (deriva tamanhos por regex + join com `image_types`/`products`).
- **App (React/PostgREST):** `src/hooks/products/useProductImages.ts` e componentes de card/galeria/simulador.

## 3. Pipeline de triggers (13)

`BEFORE`: normalize supplier → sanitize URLs → **normalize format (novo)** → auto-classify
(heurística por nome de arquivo) → **sync image_type code (novo)** → SEO autofill → single-primary → updated_at.
`AFTER`: sync para `products` (images/og/primary/fallback) → sync `set_image_url` → validação (QA log).

## 4. Hardening aplicado (2026-06-15)

| # | Item | Migration | Resultado |
|---|------|-----------|-----------|
| 1 | `format` casing inconsistente | `..._format_canonical_guard` | Trigger `fn_normalize_image_format` + CHECK `chk_product_images_format_lc` (lowercase). Verificado: `'  JPG '` → `jpeg`; CHECK rejeita maiúsculas. |
| 2 | RLS anônima permissiva (`USING(true)`) | `..._assert_secure_select_rls` | Baseline seguro re-afirmado (idempotente): anônimo vê só `is_active=true` (23 inativas ocultas). |
| 3 | drift `image_type` ↔ `image_type_id` | `..._sync_image_type_code` (+ `..._close_drift`, `..._bidirectional`, `..._case_insensitive`) | Guard **bidirecional** `BEFORE UPDATE OF image_type_id, image_type`: se o id muda, o texto segue; se só o texto muda (ex.: UI do admin), mapeia o texto de volta ao id por lookup **case-insensitive** e canonicaliza (`MAIN`→`main`); texto inválido reverte p/ a FK. Verificado: `id→set` propaga; `texto→logo`/`MAIN` adota; `texto→XXXX` reverte. |
| 4 | amplificação de escrita + observabilidade | `..._observability_and_resync` + `..._resync_deterministic` | View `v_product_images_quality_gap` + `fn_resync_product_media()` determinística/idempotente (run1=1, run2=0). |
| 5 | documentação de schema | `..._schema_documentation` | COMMENTs em tabela + 19 colunas + objetos novos. |

### Decisão data-driven: índices — 3 redundantes removidos em E8
Análise via `pg_stat_user_indexes` identificou 3 índices com 0–67 scans e cobertura
duplicada (`idx_product_images_og`, `idx_product_images_organization_id` single-tenant,
`idx_product_images_type` coberto por `product_type_active`). **Removidos em E8 (~3.2 MB
recuperados).** Restam 13 índices, todos com `idx_scan > 0` (mín 22, máx 34M).

## 5. Melhorias de conteúdo E1-E10 (PR #787, 2026-06-16)

Score de completude: **59.7% → 72.5% (+12.82pp)**. Gargalo restante: dimensões (backfill async).

| Step | Escopo | Resultado |
|---|---|---|
| E1 | `mv_product_images_audit` | Matview populada: 7 gaps, `score_completude` 0-100, `prioridade_correcao`, refresh pg_cron 6h |
| E2 | format backfill | L1 regex url_original (20.116 img jpg→jpeg/webp) + L2a SPOT spot-pa-*=PNG (11.947) + L2b XBZ órfão→inativo. **Resultado: 73.209/73.210 com format (1 inativa XBZ sem format — zero impacto)** |
| E3 | Dimensões ASIA | Invariante 768×768 confirmado (60/60=100%). Bulk update 5.937 img. |
| E4 | Edge Function `backfill-image-dimensions` | Parseia headers JPEG/PNG/WebP via Range:0-32KB, captura `file_size_bytes`. pg_cron 5min. **Status: 10.081 com dimensões (13.8%), backfill assíncrono em andamento.** |
| E5 | SPOT `url_original` | Gap estrutural documentado (spot-pa-* sem CDN intermediário). `v_product_images_quality_gap` distingue `gap_url_original_real` vs `gap_url_original_estrutural`. |
| E6 | `color_id` backfill | L1 via variant_id→product_variants.color_id (1.781 img) + L2 mono-variante inequívoco (323 img). **42.599 imagens com color_id (58.2%).** Residual multi-variante: requer re-importação. |
| E7 | `alt_text` quality | 531 imagens com alt curto/NULL resetadas → trigger SEO regenera. **73.194/73.194 ativas com alt_text válido (100%).** |
| E8 | Índices | Drop 3 redundantes (~3.2 MB). Ver acima. |
| E9 | `vw_image_type_dropblockers` | Mapa de 66 objetos (52 funções + 14 triggers) bloqueando `DROP COLUMN image_type`. Roadmap de migração `image_type → image_type_id`. |
| E10 | 88BRINDES purge | 14 imagens do piloto descontinuado → inativas. Produto `is_active=false`, sync limpou `primary_image_url`. |

## 5b. Gap remanescente: dimensões/peso (`width_px`, `height_px`, `file_size_bytes`)

63.113 imagens ativas sem dimensões (86.2%), incluindo 2.163 primárias (P0). Backfill
assíncrono via Edge Function `backfill-image-dimensions` (pg_cron 5min) em andamento.
Monitorar: `SELECT * FROM mv_product_images_audit WHERE prioridade_correcao = 'P0-primary-sem-dim';`

## 5c. Validação adversarial (2026-06-15/16) — 5 gaps encontrados e corrigidos

Bateria de centenas de cenários (replicação fiel + inserts reais em transação abortada +
simulação de papéis `anon`/`authenticated`):

| Gap | Severidade | Descoberta | Correção (migration) |
|---|---|---|---|
| `format` com tab/newline/CR/`;`/espaço interno (ex.: `image/jpeg; charset=utf-8`) passava no trigger antigo (`btrim` só remove espaços) e era **rejeitado pelo CHECK → linha inteira falhava** | Alta (quebra ingestão) | replicação de 40 entradas hostis | `..._format_normalize_robust` — normaliza extraindo 1ª seq. `[a-z0-9]` (fail-open) |
| `anon` **sem EXECUTE** em `is_org_owner_or_admin`, que a policy de SELECT (alterada pelo ambiente) passou a referenciar → **`permission denied` quebrava leitura anônima** (imagens fora do ar) ao tocar qualquer linha inativa | **SEV-1** | simulação `SET ROLE anon` | `..._grant_anon_execute_is_org_owner_or_admin` |
| `UPDATE` só do texto `image_type` (sem id) criava **drift** (afeta ordenação em `products`) | Média | cenário D do teste M3 | `..._sync_image_type_code_close_drift` (trigger passa a cobrir `UPDATE OF image_type`) |
| `fn_resync_product_media` continuava **callable por anon/authenticated** (grant default a PUBLIC venceu o REVOKE) — SECURITY DEFINER + escreve em `products` → risco DoS/escrita | Alta | `has_function_privilege` | `..._resync_lockdown_execute` (REVOKE de PUBLIC, GRANT service_role) |
| View `v_product_images_quality_gap` **exposta a anon** no GraphQL (lint 0026) | Baixa | `get_advisors` | `..._quality_gap_view_lockdown` |

Achados sem ação (documentados): `format` é `varchar(20)` e a coerção de tipo ocorre **antes**
do trigger; um valor > 20 chars é rejeitado por "value too long" independentemente da
normalização (baixo risco — o pipeline grava tokens curtos). O ambiente também tornou
`image_type_id` **NOT NULL** e reescreveu a policy de SELECT (org-scoped) — ambos compatíveis
com os guards.

**Pós-validação (2026-06-16, pós-PR #787):** todas as correções intactas. Invariantes globais:
- 0 violações de format · 0 drift · 0 `image_type_id` nulo · 0 multi-primary · 0 órfãos · 0 alt_text inválido em ativas
- RLS anon: 73.194 ativas visíveis, 0 inativas visíveis, sem `permission denied`
- `fn_resync_product_media`: anon=false, authenticated=false, service_role=true
- `v_product_images_quality_gap`: anon=false, authenticated=false, service_role=true
- Format normalization: JPG→jpeg ✅ JPEG→jpeg ✅ MAIN→main (bidirecional+case-insensitive) ✅

## 6. Operação de carga em massa (anti-write-amplification)

```sql
ALTER TABLE product_images DISABLE TRIGGER trg_sync_product_images;
ALTER TABLE product_images DISABLE TRIGGER trg_sync_product_images_update;
ALTER TABLE product_images DISABLE TRIGGER trg_sync_set_image_url;
-- ... carga em massa ...
ALTER TABLE product_images ENABLE TRIGGER trg_sync_product_images;
ALTER TABLE product_images ENABLE TRIGGER trg_sync_product_images_update;
ALTER TABLE product_images ENABLE TRIGGER trg_sync_set_image_url;
SELECT fn_resync_product_media(ARRAY(SELECT DISTINCT product_id FROM staging_lote));
```

## 7. Camada estrutural — 19 colunas novas (2026-06-16, pós-auditoria CF↔DB)

Motivação: a auditoria forense `product_images` × Cloudflare revelou que ~70% das referências
ativas apontavam para IDs inexistentes no CF, sem **nenhuma coluna que registrasse o estado de
sincronização** (os campos eram "aspiracionais"). A tabela passou de **27 → 46 colunas** em 6
migrations aditivas/idempotentes (`IF NOT EXISTS` + guards `DO $$`), todas aplicadas e verificadas.

| Bloco | Migration | Colunas |
|---|---|---|
| 1 — Observabilidade CF | `..._cf_sync_observability` | `cf_sync_status` (CHECK + índice parcial), `cf_uploaded_at`, `cf_verified_at`, `cf_check_attempts`, `cf_last_error`, `cf_id_scheme` (GENERATED) |
| 2 — Dedup/canonical | `..._content_dedup_canonical` | `content_hash`, `canonical_image_id` (self-FK + CHECK não-self + índice), `is_shared` |
| 3 — Linhagem R2 | `..._r2_origin_lineage` | `r2_bucket`, `r2_object_key`, `source_fetched_at` |
| 4 — Governança | `..._governance_provenance` | `import_batch_id`, `last_modified_source` (CHECK), `deleted_at`, `deleted_reason` |
| 5 — UX/perf | `..._ux_perf_media` | `blurhash`, `requires_signed_url`, `aspect_ratio` (GENERATED) |
| 6 — Backfill | `..._backfill_canonical_shared` | (dados) canonicaliza 593 aliases; marca 579 canônicas `is_shared` |

**Colunas derivadas (GENERATED STORED, auto-mantidas, sem trigger):**
- `cf_id_scheme` — classifica a convenção do `cloudflare_image_id`. Distribuição inicial:
  `seq` 30.355 · `legacy_cor` 19.268 · `slug_ts` 19.106 · `main_gal` 2.740 · `detail_dn` 914 ·
  `hash_legacy` 519 · `synthetic` 454 · `uuid` 2.
- `aspect_ratio` — `width_px/height_px` (4 casas); NULL quando sem dimensões (293 linhas). Média 1.0 (768×768).

**Verificação pós-aplicação:** 46 colunas · 593 `canonical_image_id` preenchidos (63 ativos) ·
579 `is_shared` · `get_advisors`: 0 findings de segurança novos, 1 INFO de performance esperado
(`idx_pi_content_hash` unused até o pipeline popular `content_hash`).

**Próximos passos (povoamento, fora deste PR):**
1. Reconciliação CF→DB (varredura paginada + `meta.product_id`) populando `cf_sync_status`/`cf_verified_at`
   (`missing` para os ~50k quebrados, `orphaned` para os ~61k do CF).
2. Pipeline de ingestão grava `content_hash` (etag R2/CF), `r2_object_key`, `import_batch_id`, `last_modified_source`.
3. Geração de `blurhash` na Edge Function `backfill-image-dimensions` (já lê o binário via Range).

## 8. Engine de reconciliação CF↔DB (2026-06-16) — popula `cf_sync_status`

Mecanismo **100% Postgres** (`pg_net` + `pg_cron`), sem Edge Function nem exposição de segredos.

- **Autoridade:** Cloudflare **Images API** `GET /accounts/{CF_ACCOUNT_ID}/images/v1/{id}` → `200`=`verified`, `404`=`missing`, resto=`failed`. Credenciais lidas do **Vault** (`CF_ACCOUNT_ID`, `CF_API_TOKEN`) em runtime.
- **⚠️ Lição de campo:** a 1ª tentativa sondava o **CDN** (`imagedelivery.net`, `Range:0-0`), mas ele retorna **206 mesmo para IDs inexistentes** (placeholder) → inválido. Validação com IDs sabidamente ausentes pegou o gap antes do rollout. Migramos para a API de controle.
- **Objetos:** `cf_recon_inflight` (mapa request_id→image_id), `fn_cf_recon_dispatch(p_batch)` (enfileira, prioriza primárias, `cf_check_attempts<5`), `fn_cf_recon_collect()` (grava status; usa `session_replication_role=replica` p/ evitar amplificação de triggers; idempotente), view `v_cf_recon_progress`.
- **Cron:** `cf-recon-dispatch` (200/min) + `cf-recon-collect` (1/min) → ~73k convergem em ~6h, dentro do rate limit; `failed` re-tentado até 5x (self-healing).
- **Validação:** lote de 100 reconciliado in-session com **100% de concordância** vs. `cf_images_batch_check` (MCP). Observado em tempo real: itens antes `missing` já viram `verified` conforme o pipeline de upload sobe imagens.
- **Monitorar:** `SELECT * FROM public.v_cf_recon_progress;`

> `types.ts` **não** foi regenerado: é um arquivo **curado/parcial** (não inclui `product_images`); regenerar adicionaria centenas de tabelas (risco REGRA #4) e não é exigido pelo CI (o contrato testa apenas presença de chaves de tabela). Acesso tipado às novas colunas, se desejado, deve ser uma curadoria manual separada.

