-- BUG-ENDOMARKETING-RPC: adiciona _endomarketing ao fn_super_filtro_product_ids.
-- Endomarketing é uma tag (slug='endomarketing') na tabela tags. O parâmetro
-- aceita um array de slugs e filtra via JOIN em product_tags → tags.slug.
-- Antes desta migração, filters.endomarketing não ativava hasMetadataFilter=true
-- no cliente, então caía no branch client-side que lê product.tags.endomarketing
-- (sempre vazio no catálogo lightweight) → grade zerava silenciosamente.

CREATE OR REPLACE FUNCTION public.fn_super_filtro_product_ids(
  _datas         text[] DEFAULT '{}'::text[],
  _tags          text[] DEFAULT '{}'::text[],
  _ramos         text[] DEFAULT '{}'::text[],
  _segmentos     text[] DEFAULT '{}'::text[],
  _publico       text[] DEFAULT '{}'::text[],
  _endomarketing text[] DEFAULT '{}'::text[]
)
RETURNS TABLE(product_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT b.id
  FROM products b
  WHERE b.is_active = true AND b.is_deleted IS NOT TRUE
    AND ( cardinality(_datas)=0 OR EXISTS (
        SELECT 1 FROM product_commemorative_dates pcd
        JOIN commemorative_dates cd ON cd.id = pcd.commemorative_date_id AND cd.is_active
        WHERE pcd.product_id = b.id AND pcd.is_active AND cd.slug = ANY(_datas) ) )
    AND ( cardinality(_tags)=0 OR EXISTS (
        SELECT 1 FROM product_tags pt
        JOIN tags t ON t.id = pt.tag_id AND t.is_active
        WHERE pt.product_id = b.id AND pt.tag_id = ANY( ARRAY(
            SELECT x::uuid FROM unnest(_tags) AS x
            WHERE x ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        ) ) ) )
    AND ( cardinality(_ramos)=0 OR EXISTS (
        SELECT 1 FROM produto_ramo_atividade pra
        JOIN ramo_atividade_filho raf ON raf.id = pra.ramo_atividade_filho_id
        JOIN ramo_atividade ra ON ra.id = raf.ramo_atividade_id
        WHERE pra.produto_id = b.id AND ra.slug = ANY(_ramos) ) )
    AND ( cardinality(_segmentos)=0 OR EXISTS (
        SELECT 1 FROM produto_ramo_atividade pra
        JOIN ramo_atividade_filho raf ON raf.id = pra.ramo_atividade_filho_id
        WHERE pra.produto_id = b.id AND raf.slug = ANY(_segmentos) ) )
    AND ( cardinality(_publico)=0 OR b.target_audience && _publico )
    AND ( cardinality(_endomarketing)=0 OR EXISTS (
        SELECT 1 FROM product_tags pt
        JOIN tags t ON t.id = pt.tag_id AND t.is_active
        WHERE pt.product_id = b.id AND t.slug = ANY(_endomarketing) ) );
$function$;
