-- ============================================================================
-- Notificacoes de Estoque (sino do header) -- RPCs de leitura + hardening ACL
-- ----------------------------------------------------------------------------
-- Alimenta src/components/inventory/StockAlertsIndicator.tsx via os hooks em
-- src/hooks/products/useStockNotifications.ts. Cada categoria tem fonte de
-- verdade propria e mutuamente coerente:
--   Zerou    -> products.is_stockout = true
--   Baixo    -> stock <= suppliers.low_stock_threshold (= badge #8)
--   Novidade -> product_novelties ativas + filtros de qualidade
--   Chegou   -> stock_daily_summary, Cenario A (0->positivo) e atualmente
--               disponivel (mesma semantica de fn_get_replenishment_stats)
--
-- Idempotente (CREATE OR REPLACE + REVOKE/GRANT). Ja aplicado em producao via
-- execute_sql; este arquivo existe para reprodutibilidade (supabase db push).
--
-- Seguranca: funcoes SECURITY DEFINER NAO podem ser executaveis por PUBLIC/anon
-- (gate audit_security_definer_acl; lints Supabase 0028/0029). O sino so
-- renderiza para usuarios autenticados, entao concedemos apenas a
-- `authenticated` (owner/service_role mantem acesso implicito).
-- ============================================================================

-- 1) CHEGOU: reposicao REAL (Cenario A: 0->positivo) e atualmente disponivel
CREATE OR REPLACE FUNCTION public.fn_get_recent_restocks(p_limit int DEFAULT 30)
RETURNS TABLE(product_id uuid, product_name text, product_sku text, image_url text,
              stock_quantity int, supplier_id uuid, supplier_name text, last_restock_date date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH cenario_a AS (
    SELECT sds.product_id, max(sds.summary_date) AS last_restock_date
    FROM stock_daily_summary sds
    WHERE COALESCE(sds.stock_open,0)=0 AND COALESCE(sds.stock_close,0)>0
      AND sds.restock_detected=true
      AND sds.summary_date >= CURRENT_DATE - INTERVAL '30 days'
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

-- 2) ZEROU: esgotados de fato (is_stockout=true => stock=0)
CREATE OR REPLACE FUNCTION public.fn_get_stockout_alerts(p_limit int DEFAULT 50)
RETURNS TABLE(product_id uuid, product_name text, product_sku text, image_url text,
              stock_quantity int, supplier_id uuid, supplier_name text, last_stock_update_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT p.id, p.name::text, p.sku::text, p.primary_image_url::text, p.stock_quantity,
         p.supplier_id, s.name::text, p.last_stock_update_at
  FROM products p LEFT JOIN suppliers s ON s.id=p.supplier_id
  WHERE p.is_active=true AND p.is_stockout=true
  ORDER BY p.last_stock_update_at DESC NULLS LAST, p.id
  LIMIT GREATEST(p_limit,0);
$$;

-- 3) BAIXO: estoque baixo por threshold do fornecedor (alinha badge #8)
CREATE OR REPLACE FUNCTION public.fn_get_low_stock_alerts(p_limit int DEFAULT 50)
RETURNS TABLE(product_id uuid, product_name text, product_sku text, image_url text,
              stock_quantity int, supplier_id uuid, supplier_name text, low_stock_threshold int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT p.id, p.name::text, p.sku::text, p.primary_image_url::text, p.stock_quantity,
         p.supplier_id, s.name::text, COALESCE(s.low_stock_threshold,10)
  FROM products p LEFT JOIN suppliers s ON s.id=p.supplier_id
  WHERE p.is_active=true AND p.is_stockout=false
    AND p.stock_quantity>0 AND p.stock_quantity <= COALESCE(s.low_stock_threshold,10)
  ORDER BY p.stock_quantity ASC, p.id
  LIMIT GREATEST(p_limit,0);
$$;

-- 4) NOVIDADE: fonte de verdade product_novelties + filtros de qualidade, dedup por produto
CREATE OR REPLACE FUNCTION public.fn_get_novelty_alerts(p_limit int DEFAULT 30)
RETURNS TABLE(product_id uuid, product_name text, product_sku text, image_url text,
              stock_quantity int, supplier_id uuid, supplier_name text,
              detected_at timestamptz, days_remaining int, is_highlighted boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH dedup AS (
    SELECT DISTINCT ON (pn.product_id)
           pn.product_id, p.name::text AS product_name, p.sku::text AS product_sku,
           p.primary_image_url::text AS image_url, p.stock_quantity,
           p.supplier_id, s.name::text AS supplier_name,
           pn.detected_at,
           EXTRACT(DAY FROM (pn.expires_at - now()))::int AS days_remaining,
           pn.is_highlighted
    FROM product_novelties pn
    JOIN products p ON p.id=pn.product_id
    LEFT JOIN suppliers s ON s.id=p.supplier_id
    WHERE pn.is_active=true AND (pn.expires_at IS NULL OR pn.expires_at>now())
      AND p.is_active=true AND p.is_stockout=false
      AND p.sale_price IS NOT NULL AND p.sale_price>0
      AND p.primary_image_url IS NOT NULL AND p.primary_image_url<>''
    ORDER BY pn.product_id, pn.detected_at DESC
  )
  SELECT product_id, product_name, product_sku, image_url, stock_quantity,
         supplier_id, supplier_name, detected_at, days_remaining, is_highlighted
  FROM dedup
  ORDER BY detected_at DESC, product_id
  LIMIT GREATEST(p_limit,0);
$$;

-- 5) CONTADORES exatos (server-side) das 4 categorias, em 1 round-trip
CREATE OR REPLACE FUNCTION public.fn_get_stock_notification_counts()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT jsonb_build_object(
    'stockout', (SELECT count(*) FROM products WHERE is_active AND is_stockout),
    'low_stock', (SELECT count(*) FROM products p LEFT JOIN suppliers s ON s.id=p.supplier_id
                  WHERE p.is_active AND p.is_stockout=false AND p.stock_quantity>0
                    AND p.stock_quantity <= COALESCE(s.low_stock_threshold,10)),
    'novelties', (SELECT count(DISTINCT pn.product_id)
                  FROM product_novelties pn JOIN products p ON p.id=pn.product_id
                  WHERE pn.is_active AND (pn.expires_at IS NULL OR pn.expires_at>now())
                    AND p.is_active AND p.is_stockout=false AND p.sale_price>0
                    AND p.primary_image_url IS NOT NULL AND p.primary_image_url<>''),
    'restocks', (SELECT count(*) FROM (
                   SELECT sds.product_id
                   FROM stock_daily_summary sds JOIN products p ON p.id=sds.product_id
                   WHERE COALESCE(sds.stock_open,0)=0 AND COALESCE(sds.stock_close,0)>0
                     AND sds.restock_detected=true
                     AND sds.summary_date >= CURRENT_DATE - INTERVAL '30 days'
                     AND p.is_active AND p.stock_quantity>0
                   GROUP BY sds.product_id) r)
  );
$$;

-- Hardening ACL: remover PUBLIC + anon, manter authenticated (+ owner/service_role)
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.fn_get_recent_restocks(int)',
    'public.fn_get_stockout_alerts(int)',
    'public.fn_get_low_stock_alerts(int)',
    'public.fn_get_novelty_alerts(int)',
    'public.fn_get_stock_notification_counts()'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;
