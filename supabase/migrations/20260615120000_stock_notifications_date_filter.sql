-- ============================================================================
-- Notificações de Estoque: filtro de data (p_since) + eventDate por item
-- ----------------------------------------------------------------------------
-- Adiciona parâmetro p_since DATE DEFAULT NULL em todas as 5 RPCs, permitindo
-- filtrar notificações por período (Hoje / 7d / 30d / Tudo) na UI.
-- fn_get_low_stock_alerts: expõe last_stock_update_at no RETURNS.
-- Já aplicado em produção via execute_sql; este arquivo existe para supabase db push.
--
-- Comportamento de cada função com p_since:
--   fn_get_stockout_alerts  → filtra last_stock_update_at >= p_since
--   fn_get_low_stock_alerts → filtra last_stock_update_at >= p_since
--   fn_get_novelty_alerts   → filtra detected_at >= p_since
--   fn_get_recent_restocks  → restringe janela 30d: GREATEST(p_since, 30d atrás)
--   fn_get_stock_notification_counts → aplica filtro em todos os 4 sub-counts
-- ============================================================================

-- Drop das assinaturas antigas (single-param)
DROP FUNCTION IF EXISTS public.fn_get_recent_restocks(integer);
DROP FUNCTION IF EXISTS public.fn_get_stockout_alerts(integer);
DROP FUNCTION IF EXISTS public.fn_get_low_stock_alerts(integer);
DROP FUNCTION IF EXISTS public.fn_get_novelty_alerts(integer);
DROP FUNCTION IF EXISTS public.fn_get_stock_notification_counts();

-- 1) CHEGOU: p_since restringe janela máxima de 30 dias
CREATE OR REPLACE FUNCTION public.fn_get_recent_restocks(
  p_limit int DEFAULT 30,
  p_since date DEFAULT NULL
)
RETURNS TABLE(product_id uuid, product_name text, product_sku text, image_url text,
              stock_quantity int, supplier_id uuid, supplier_name text, last_restock_date date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH cenario_a AS (
    SELECT sds.product_id, max(sds.summary_date) AS last_restock_date
    FROM stock_daily_summary sds
    WHERE COALESCE(sds.stock_open,0)=0 AND COALESCE(sds.stock_close,0)>0
      AND sds.restock_detected=true
      AND sds.summary_date >= GREATEST(
        COALESCE(p_since, (CURRENT_DATE - INTERVAL '30 days')::date),
        (CURRENT_DATE - INTERVAL '30 days')::date
      )
    GROUP BY sds.product_id
  )
  SELECT p.id, p.name::text, p.sku::text, p.primary_image_url::text, p.stock_quantity,
         p.supplier_id, s.name::text, ca.last_restock_date
  FROM cenario_a ca
  JOIN products p ON p.id=ca.product_id
  LEFT JOIN suppliers s ON s.id=p.supplier_id
  WHERE p.is_active=true AND p.stock_quantity>0
  ORDER BY ca.last_restock_date DESC, p.stock_quantity DESC, p.id
  LIMIT GREATEST(p_limit,0);
$$;

-- 2) ZEROU: filtra por last_stock_update_at
CREATE OR REPLACE FUNCTION public.fn_get_stockout_alerts(
  p_limit int DEFAULT 50,
  p_since date DEFAULT NULL
)
RETURNS TABLE(product_id uuid, product_name text, product_sku text, image_url text,
              stock_quantity int, supplier_id uuid, supplier_name text, last_stock_update_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT p.id, p.name::text, p.sku::text, p.primary_image_url::text, p.stock_quantity,
         p.supplier_id, s.name::text, p.last_stock_update_at
  FROM products p LEFT JOIN suppliers s ON s.id=p.supplier_id
  WHERE p.is_active=true AND p.is_stockout=true
    AND (p_since IS NULL OR p.last_stock_update_at >= p_since::timestamptz)
  ORDER BY p.last_stock_update_at DESC NULLS LAST, p.id
  LIMIT GREATEST(p_limit,0);
$$;

-- 3) BAIXO: filtra por last_stock_update_at + expõe coluna no RETURNS
CREATE OR REPLACE FUNCTION public.fn_get_low_stock_alerts(
  p_limit int DEFAULT 50,
  p_since date DEFAULT NULL
)
RETURNS TABLE(product_id uuid, product_name text, product_sku text, image_url text,
              stock_quantity int, supplier_id uuid, supplier_name text,
              low_stock_threshold int, last_stock_update_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT p.id, p.name::text, p.sku::text, p.primary_image_url::text, p.stock_quantity,
         p.supplier_id, s.name::text, COALESCE(s.low_stock_threshold,10), p.last_stock_update_at
  FROM products p LEFT JOIN suppliers s ON s.id=p.supplier_id
  WHERE p.is_active=true AND p.is_stockout=false
    AND p.stock_quantity>0 AND p.stock_quantity <= COALESCE(s.low_stock_threshold,10)
    AND (p_since IS NULL OR p.last_stock_update_at >= p_since::timestamptz)
  ORDER BY p.stock_quantity ASC, p.id
  LIMIT GREATEST(p_limit,0);
$$;

-- 4) NOVIDADE: filtra por detected_at
CREATE OR REPLACE FUNCTION public.fn_get_novelty_alerts(
  p_limit int DEFAULT 30,
  p_since date DEFAULT NULL
)
RETURNS TABLE(product_id uuid, product_name text, product_sku text, image_url text,
              stock_quantity int, supplier_id uuid, supplier_name text,
              detected_at timestamptz, days_remaining int, is_highlighted boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH dedup AS (
    SELECT DISTINCT ON (pn.product_id)
           pn.product_id, p.name::text, p.sku::text, p.primary_image_url::text, p.stock_quantity,
           p.supplier_id, s.name::text, pn.detected_at,
           EXTRACT(DAY FROM (pn.expires_at - now()))::int, pn.is_highlighted
    FROM product_novelties pn
    JOIN products p ON p.id=pn.product_id
    LEFT JOIN suppliers s ON s.id=p.supplier_id
    WHERE pn.is_active=true AND (pn.expires_at IS NULL OR pn.expires_at>now())
      AND p.is_active=true AND p.is_stockout=false
      AND p.sale_price IS NOT NULL AND p.sale_price>0
      AND p.primary_image_url IS NOT NULL AND p.primary_image_url<>''
      AND (p_since IS NULL OR pn.detected_at >= p_since::timestamptz)
    ORDER BY pn.product_id, pn.detected_at DESC
  )
  SELECT * FROM dedup ORDER BY detected_at DESC, product_id
  LIMIT GREATEST(p_limit,0);
$$;

-- 5) CONTADORES: filtra todos os 4 sub-counts por período
CREATE OR REPLACE FUNCTION public.fn_get_stock_notification_counts(p_since date DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT jsonb_build_object(
    'stockout', (
      SELECT count(*) FROM products
      WHERE is_active AND is_stockout
        AND (p_since IS NULL OR last_stock_update_at >= p_since::timestamptz)
    ),
    'low_stock', (
      SELECT count(*) FROM products p LEFT JOIN suppliers s ON s.id=p.supplier_id
      WHERE p.is_active AND p.is_stockout=false AND p.stock_quantity>0
        AND p.stock_quantity <= COALESCE(s.low_stock_threshold,10)
        AND (p_since IS NULL OR p.last_stock_update_at >= p_since::timestamptz)
    ),
    'novelties', (
      SELECT count(DISTINCT pn.product_id)
      FROM product_novelties pn JOIN products p ON p.id=pn.product_id
      WHERE pn.is_active AND (pn.expires_at IS NULL OR pn.expires_at>now())
        AND p.is_active AND p.is_stockout=false AND p.sale_price>0
        AND p.primary_image_url IS NOT NULL AND p.primary_image_url<>''
        AND (p_since IS NULL OR pn.detected_at >= p_since::timestamptz)
    ),
    'restocks', (
      SELECT count(*) FROM (
        SELECT sds.product_id
        FROM stock_daily_summary sds JOIN products p ON p.id=sds.product_id
        WHERE COALESCE(sds.stock_open,0)=0 AND COALESCE(sds.stock_close,0)>0
          AND sds.restock_detected=true
          AND sds.summary_date >= GREATEST(
            COALESCE(p_since, (CURRENT_DATE - INTERVAL '30 days')::date),
            (CURRENT_DATE - INTERVAL '30 days')::date
          )
          AND p.is_active AND p.stock_quantity>0
        GROUP BY sds.product_id
      ) r
    )
  );
$$;

-- Hardening ACL: REVOKE PUBLIC/anon, GRANT authenticated
DO $$ DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.fn_get_recent_restocks(integer,date)',
    'public.fn_get_stockout_alerts(integer,date)',
    'public.fn_get_low_stock_alerts(integer,date)',
    'public.fn_get_novelty_alerts(integer,date)',
    'public.fn_get_stock_notification_counts(date)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;
