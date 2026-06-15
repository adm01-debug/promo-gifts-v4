# `product_images` — Laudo técnico e hardening (Gold / `doufsxqlfjyuvxuezpln`)

> Última atualização: 2026-06-15. Análise + execução de melhorias por sessão de DBA.

## 1. O que é

Tabela-fato de mídia do catálogo na camada **Gold** do Medallion. Cada linha = **uma imagem
física** de um produto, hospedada no **Cloudflare Images** (`imagedelivery.net`), com
classificação semântica, ordenação, metadados SEO e rastreabilidade de fornecedor.

É a **fonte da verdade de imagens**. A tabela `products` **não** é dona das imagens — recebe
projeções desnormalizadas (`images`, `primary_image_url`, `og_image_url`, `set_image_url`,
`primary_image_fallback_url`) **mantidas pelos triggers** desta tabela.

Perfil (2026-06-15): **73.210 linhas / 82 MB / ~7.118 produtos** (~10 imagens/produto),
73.187 ativas, **exatamente 1 primária por produto**.

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
| 3 | drift `image_type` ↔ `image_type_id` | `..._sync_image_type_code` | Guard `BEFORE UPDATE OF image_type_id` (FK = fonte da verdade). Verificado: `gallery`→`set` propaga. |
| 4 | amplificação de escrita + observabilidade | `..._observability_and_resync` + `..._resync_deterministic` | View `v_product_images_quality_gap` + `fn_resync_product_media()` determinística/idempotente (run1=1, run2=0). |
| 5 | documentação de schema | `..._schema_documentation` | COMMENTs em tabela + 19 colunas + objetos novos. |

### Decisão data-driven: índices NÃO foram podados
A hipótese inicial de "sobre-indexação" foi **refutada por `pg_stat_user_indexes`**: os 13
índices têm `idx_scan > 0` (menor = `image_type_id` com 14; maior = `cloudflare_image_id` com
34M). Remover qualquer um seria otimização prematura com risco. **Mantidos todos.**

## 5. Gap aberto: dimensões/peso (`width_px`, `height_px`, `file_size_bytes`)

~99,9% nulo (100% em `file_size_bytes`). É um problema de **aquisição de dado externo**, não de
schema. O job autoritativo atual popula `format` mas não dimensões. Pipeline recomendado
(infra já instalada: `pg_net`, `pg_cron`, `pgmq`):

1. Edge Function com credencial da **Cloudflare Images API** (`GET /images/v1/{id}` → retorna
   `width`/`height`/`size`).
2. `pg_cron` agenda lotes; enfileira via `pgmq` os `id` com `width_px IS NULL`.
3. Worker drena a fila, busca metadados e faz `UPDATE` (o trigger de validação então passa a
   classificar APROVADO/REPROVADO em vez de `SEM_DIMENSOES`).
4. Monitorar progresso por `SELECT * FROM v_product_images_quality_gap`.

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
