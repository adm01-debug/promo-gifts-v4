-- Materialized view for popular products (last 30 days)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.product_popularity_30d AS
SELECT 
    v.product_id as id, 
    v.product_name as name, 
    v.product_sku as sku,
    p.images[1] as image_url,
    p.category_name,
    COUNT(*)::int as view_count
FROM public.product_views v
LEFT JOIN public.products p ON (
    CASE 
        WHEN v.product_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
        THEN v.product_id::uuid 
        ELSE NULL 
    END
) = p.id
WHERE v.created_at > now() - interval '30 days'
GROUP BY v.product_id, v.product_name, v.product_sku, p.images[1], p.category_name
ORDER BY view_count DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_popularity_id ON public.product_popularity_30d (id);

GRANT SELECT ON public.product_popularity_30d TO authenticated;
GRANT SELECT ON public.product_popularity_30d TO anon;
GRANT ALL ON public.product_popularity_30d TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_product_popularity()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.product_popularity_30d;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_product_popularity() TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_product_popularity() TO service_role;
