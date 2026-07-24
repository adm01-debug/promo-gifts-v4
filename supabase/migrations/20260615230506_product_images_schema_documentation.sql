-- ============================================================================
-- product_images :: documentação do schema (COMMENTs)  (Migration 5/5)
-- Schema auto-documentado — visível no Studio, em \d+ e em ferramentas de catálogo.
-- ============================================================================

COMMENT ON TABLE public.product_images IS
'Tabela-fato de mídia do catálogo (camada Gold). 1 linha = 1 imagem física de produto hospedada no Cloudflare Images. É a fonte da verdade de imagens; os campos desnormalizados em products (images, primary_image_url, og_image_url, set_image_url, primary_image_fallback_url) são MANTIDOS pelos triggers desta tabela. RLS ativo (leitura pública só de ativas; escrita restrita a org owner/admin).';

COMMENT ON COLUMN public.product_images.cloudflare_image_id IS 'ID da imagem no Cloudflare Images (chave natural, UNIQUE).';
COMMENT ON COLUMN public.product_images.url_cdn          IS 'URL pública servida ao site (CF Images / imagedelivery.net).';
COMMENT ON COLUMN public.product_images.url_original     IS 'URL no CDN do fornecedor; usada como fallback (primary_image_fallback_url) quando o CF falha.';
COMMENT ON COLUMN public.product_images.image_type       IS 'Rótulo textual do tipo (derivado de image_type_id pela FK; mantido em sincronia pelo trigger trg_sync_image_type_code).';
COMMENT ON COLUMN public.product_images.image_type_id    IS 'FK -> image_types. Fonte da verdade da classificação; o classificador heurístico (fn_auto_classify_product_image) o define no INSERT a partir do nome do arquivo.';
COMMENT ON COLUMN public.product_images.is_primary       IS 'Imagem principal do produto. Invariante: no máximo 1 por produto (garantido por fn_ensure_single_primary_image).';
COMMENT ON COLUMN public.product_images.is_og_image      IS 'Imagem usada como Open Graph (compartilhamento social).';
COMMENT ON COLUMN public.product_images.applies_to_color IS 'Sinal semântico: imagem pertence a uma cor específica (preferir sobre supplier_code).';
COMMENT ON COLUMN public.product_images.display_order    IS 'Ordem de exibição na galeria (asc).';
COMMENT ON COLUMN public.product_images.format           IS 'Formato canônico em minúsculo (jpeg/png/webp/gif/avif...). Normalizado por fn_normalize_image_format; invariante lowercase garantido por chk_product_images_format_lc.';
COMMENT ON COLUMN public.product_images.source_supplier  IS 'Fornecedor de origem normalizado (SPOT/XBZ/ASIA/SOMARCAS/88BRINDES). Normalizado por fn_normalize_source_supplier (stricker->SPOT).';
COMMENT ON COLUMN public.product_images.width_px         IS 'Largura em px. GAP CONHECIDO: ~99,9% nulo — backfill pendente via pipeline assíncrono (pg_net/pg_cron + CF Images API).';
COMMENT ON COLUMN public.product_images.height_px        IS 'Altura em px. Ver nota em width_px.';
COMMENT ON COLUMN public.product_images.file_size_bytes  IS 'Tamanho do arquivo. GAP CONHECIDO: 100% nulo — backfill pendente.';
COMMENT ON COLUMN public.product_images.organization_id  IS 'FK -> organizations (multi-tenant; single-tenant na prática).';

COMMENT ON VIEW public.v_product_images_quality_gap IS
'Observabilidade: gaps de metadados (dimensões/format/size/alt) agregados por fornecedor. security_invoker=on.';

COMMENT ON FUNCTION public.fn_resync_product_media(uuid[]) IS
'Recomputa, de forma set-based, determinística e idempotente, os campos de mídia desnormalizados em products para os product_ids dados (ou todos se NULL). Use após cargas em massa com triggers AFTER desabilitados para eliminar amplificação de escrita. Só escreve linhas que mudam.';

COMMENT ON FUNCTION public.fn_normalize_image_format() IS
'Trigger BEFORE: normaliza product_images.format para minúsculo canônico (jpg->jpeg, remove prefixo mime).';

COMMENT ON FUNCTION public.fn_sync_image_type_code() IS
'Trigger BEFORE UPDATE OF image_type_id: mantém image_type (texto) coerente com a FK image_type_id.';
