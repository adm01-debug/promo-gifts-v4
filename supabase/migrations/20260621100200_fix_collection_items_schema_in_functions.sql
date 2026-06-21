-- FIX: get_collections_weekly_count and get_top_collected_products referenced
-- archive.collection_items but the table is in public schema.
-- Replacing with public.collection_items to fix runtime failures.

CREATE OR REPLACE FUNCTION public.get_collections_weekly_count(_weeks integer DEFAULT 8)
RETURNS TABLE(week_start date, item_count bigint)
LANGUAGE sql
STABLE
AS $$
  WITH weeks AS (
    SELECT generate_series(
      date_trunc('week', now())::date - (GREATEST(_weeks, 1) - 1) * 7,
      date_trunc('week', now())::date,
      '7 days'::interval
    )::date AS week_start
  )
  SELECT w.week_start, COALESCE(COUNT(ci.id), 0)::bigint AS item_count
  FROM weeks w
  LEFT JOIN public.collection_items ci
    ON date_trunc('week', ci.created_at)::date = w.week_start
    AND EXISTS (SELECT 1 FROM public.collections c WHERE c.id = ci.collection_id AND c.user_id = auth.uid())
  GROUP BY w.week_start
  ORDER BY w.week_start ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_top_collected_products(_days integer DEFAULT 7, _limit integer DEFAULT 6)
RETURNS TABLE(product_id text, col_count bigint)
LANGUAGE sql
STABLE
AS $$
  SELECT ci.product_id, COUNT(*)::bigint AS col_count
  FROM public.collection_items ci
  WHERE ci.created_at >= (now() - make_interval(days => GREATEST(_days, 1)))
  GROUP BY ci.product_id
  ORDER BY col_count DESC, MAX(ci.created_at) DESC
  LIMIT GREATEST(_limit, 1);
$$;
