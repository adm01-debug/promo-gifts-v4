# Auditoria + Melhorias `product_images` — 2026-06-16 (Gold `doufsxqlfjyuvxuezpln`)

> Execução guiada por simulação adversarial. 7 migrations idempotentes/reversíveis aplicadas via MCP.
> Todas as escritas são **soft/reversíveis** (snapshots em schema `backup`, soft-delete, flags) — sem DELETE físico, sem deleção de objetos no Cloudflare.

## Resultado das invariantes (pós-execução)

| Invariante | Antes | Depois |
|---|---|---|
| OG por produto ativo (= primária) | 1.660 sem OG, 1 com 2 | **exatamente 1** (0 violações) |
| Colisões `display_order` `(product,color,type)` | 18.484 | **0** |
| Primária sempre `display_order=1` | não | **sim** |
| `color_id` ausente (mono-variante inequívoco) | 1.706 | **0** |
| `image_type` genérico `product` (XBZ) | 7.779 | **0** (→ `gallery`) |
| Drift `image_type` ↔ FK | 0 | **0** |
| Produtos com primária realmente quebrada | — | **4** (worklist) |
| 1 primária por produto | ok | **ok** (0 multi/0 zero) |

## Migrations

| # | Arquivo | O quê |
|---|---|---|
| M1 | `...180001_..._m1_og_canonical_one_per_product` | OG canônico = primária ativa |
| M2 | `...180002_..._m2_display_order_deterministic` | Resequência determinística (snapshot `backup.product_images_display_order_20260616`) |
| M3 | `...180003_..._m3_colorid_backfill_monovariant` | `color_id` em produtos mono-variante (1.706) |
| M4 | `...180004_..._m4_projection_repair_and_hashlegacy_softpurge` | Soft-delete 519 `hash_legacy` + repoint defensivo (no-op verificado) |
| M5 | `...180005_..._m5_reclassify_xbz_product_to_gallery` | XBZ `product`→`gallery` (snapshot `backup.product_images_type_xbz_20260616`) |
| M6 | `...180006_..._m6_cf_remediation_worklist_view` | View `v_cf_image_remediation` (worklist auto-convergente) |
| M7 | `...180007_..._m7_display_order_resequence_post_reclassify` | Re-sequência após M5 mudar a partição de ordenação |

## Correções do laudo original (honestidade forense)

A simulação + verificação **derrubaram duas conclusões superestimadas** do laudo CF inicial:

1. **"196 produtos com primária quebrada" era FALSO-POSITIVO.** As 519 `hash_legacy` têm `cloudflare_image_id=xbz_site_*` (morto no CF) porém **`url_cdn` canonicalizado** para imagem válida (`hl_urlcdn_self=0`, `truly_broken_primary=0`). A projeção nunca esteve quebrada.
2. **"~150-200 produtos com primária 404" era exagero.** As 428 ASIA color-code **ativas** são 100% `verified`; as mortas (611) são **inativas** (fora da vitrine). Impacto UX real medido por resolução: **4 produtos** (`v_cf_image_remediation`), todos precisando de re-upload do binário (sem alternativa `verified`).

## Itens deliberadamente NÃO executados (decisão de segurança)

- **Deleção de órfãs no Cloudflare:** as "órfãs" são uploads do pipeline **em voo** (esquema `-main`/`-gal`/`-dup` carimbado no mesmo dia) — destruí-las quebraria a ingestão ativa.
- **Remap ASIA color-code "às cegas":** mapear cor→ID numérico sem fonte confiável mostraria a **cor errada** — viola o objetivo de qualidade. Fica para re-importação com mapa de cor.
- **`color_id` multi-variante (14.155):** ambíguo; requer re-importação.
- **Governança do pipeline** (gravar `cloudflare_image_id` só após upload confirmado): mudança de código do pipeline, fora do escopo de migration de dados.

## Reversão

```sql
-- display_order: restaurar do snapshot da M2
UPDATE product_images p SET display_order = b.display_order
  FROM backup.product_images_display_order_20260616 b WHERE p.id=b.id;
-- image_type XBZ: restaurar do snapshot da M5
UPDATE product_images p SET image_type=b.image_type, image_type_id=b.image_type_id
  FROM backup.product_images_type_xbz_20260616 b WHERE p.id=b.id;
-- hash_legacy: reverter soft-delete
UPDATE product_images SET deleted_at=NULL, deleted_reason=NULL WHERE cf_id_scheme='hash_legacy';
```
