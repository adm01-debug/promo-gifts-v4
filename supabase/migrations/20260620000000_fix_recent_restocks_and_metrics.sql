-- ============================================================================
-- BUG-DB-1: fn_get_recent_restocks + fn_get_stock_notification_counts
--   Ambas as funções usavam `restock_detected=true` (campo legado) em vez de
--   `restock_zero_to_positive=true` (campo canônico). Resultado: 24 produtos
--   faltando no sino "Chegou" e no contador de restocks por período.
--
-- BUG-DB-4: fn_get_reposicao_metrics
--   O bloco SELECT que calcula v_ativas (variantes zeradas com previsão) e
--   v_aguardando (todas as variantes com previsão futura) só verificava o
--   slot next_date_1, ignorando next_date_2 … next_date_6. O dado correto
--   deve checar qualquer um dos 6 slots, igual a vw_product_availability.
--
-- Índice afetado: idx_sds_cenario_a ficará órfão após BUG-DB-1 ser corrigido
-- (não referenciado por nenhuma função). Mantido por ora para queries ad-hoc;
-- pode ser removido em migração futura após confirmar que não é usado.
-- ============================================================================

-- ─── 1. fn_get_recent_restocks (BUG-DB-1) ───────────────────────────────────
-- Substitui restock_detected por restock_zero_to_positive.
-- Remove redundância COALESCE(stock_open,0)=0 que restock_zero_to_positive já implica.
-- Mantém assinatura (p_limit int, p_since date) idêntica para compatibilidade.

DROP FUNCTION IF EXISTS public.fn_get_recent_restocks(integer, date);

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
    WHERE sds.restock_zero_to_positive = true
      AND COALESCE(sds.stock_close, 0) > 0
      AND sds.summary_date >= GREATEST(
        COALESCE(p_since, (CURRENT_DATE - INTERVAL '30 days')::date),
        (CURRENT_DATE - INTERVAL '30 days')::date
      )
    GROUP BY sds.product_id
  )
  SELECT p.id, p.name::text, p.sku::text, p.primary_image_url::text, p.stock_quantity,
         p.supplier_id, s.name::text, ca.last_restock_date
  FROM cenario_a ca
  JOIN products p ON p.id = ca.product_id
  LEFT JOIN suppliers s ON s.id = p.supplier_id
  WHERE p.is_active = true AND p.stock_quantity > 0
  ORDER BY ca.last_restock_date DESC, p.stock_quantity DESC, p.id
  LIMIT GREATEST(p_limit, 0);
$$;

-- ─── 2. fn_get_stock_notification_counts (BUG-DB-1) ─────────────────────────
-- O sub-count de 'restocks' usava a mesma lógica legada. Atualizado para
-- restock_zero_to_positive = true, alinhando com fn_get_recent_restocks.

DROP FUNCTION IF EXISTS public.fn_get_stock_notification_counts(date);

CREATE OR REPLACE FUNCTION public.fn_get_stock_notification_counts(p_since date DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT jsonb_build_object(
    'stockout', (
      SELECT count(*) FROM products
      WHERE is_active AND is_stockout
        AND (p_since IS NULL OR last_stock_update_at >= p_since::timestamptz)
    ),
    'low_stock', (
      SELECT count(*) FROM products p LEFT JOIN suppliers s ON s.id = p.supplier_id
      WHERE p.is_active AND p.is_stockout = false AND p.stock_quantity > 0
        AND p.stock_quantity <= COALESCE(s.low_stock_threshold, 10)
        AND (p_since IS NULL OR p.last_stock_update_at >= p_since::timestamptz)
    ),
    'novelties', (
      SELECT count(DISTINCT pn.product_id)
      FROM product_novelties pn JOIN products p ON p.id = pn.product_id
      WHERE pn.is_active AND (pn.expires_at IS NULL OR pn.expires_at > now())
        AND p.is_active AND p.is_stockout = false AND p.sale_price > 0
        AND p.primary_image_url IS NOT NULL AND p.primary_image_url <> ''
        AND (p_since IS NULL OR pn.detected_at >= p_since::timestamptz)
    ),
    'restocks', (
      SELECT count(*) FROM (
        SELECT sds.product_id
        FROM stock_daily_summary sds
        JOIN products p ON p.id = sds.product_id
        WHERE sds.restock_zero_to_positive = true
          AND COALESCE(sds.stock_close, 0) > 0
          AND sds.summary_date >= GREATEST(
            COALESCE(p_since, (CURRENT_DATE - INTERVAL '30 days')::date),
            (CURRENT_DATE - INTERVAL '30 days')::date
          )
          AND p.is_active AND p.stock_quantity > 0
        GROUP BY sds.product_id
      ) r
    )
  );
$$;

-- ─── 3. fn_get_reposicao_metrics (BUG-DB-4) ─────────────────────────────────
-- v_ativas/v_aguardando agora checam todos os 6 slots next_date_1…next_date_6,
-- igual à lógica de vw_product_availability. Versão bump: v4_stable_20260620.

CREATE OR REPLACE FUNCTION public.fn_get_reposicao_metrics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today          date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_hoje           int;
  v_7d             int;
  v_15d            int;
  v_30d            int;
  v_top_supplier   text;
  v_top_count      int;
  v_ativas         int;
  v_aguardando     int;
  v_pct_ativas     numeric;
  v_total_vars     int;
  v_data_min       date;
  v_dias_hist      int;
BEGIN
  SELECT
    COUNT(DISTINCT CASE WHEN sd.summary_date = v_today        THEN sd.product_id END),
    COUNT(DISTINCT CASE WHEN sd.summary_date >= v_today - 7   THEN sd.product_id END),
    COUNT(DISTINCT CASE WHEN sd.summary_date >= v_today - 15  THEN sd.product_id END),
    COUNT(DISTINCT CASE WHEN sd.summary_date >= v_today - 30  THEN sd.product_id END),
    MIN(sd.summary_date),
    (v_today - MIN(sd.summary_date))
  INTO v_hoje, v_7d, v_15d, v_30d, v_data_min, v_dias_hist
  FROM stock_daily_summary sd
  JOIN products p ON p.id = sd.product_id
  WHERE sd.restock_zero_to_positive = true
    AND sd.summary_date >= v_today - 30
    AND sd.stock_close > 0
    AND p.is_active = true;

  SELECT s.name, COUNT(DISTINCT sd.product_id)
  INTO v_top_supplier, v_top_count
  FROM stock_daily_summary sd
  JOIN suppliers s ON s.id = sd.supplier_id
  JOIN products p ON p.id = sd.product_id
  WHERE sd.restock_zero_to_positive = true
    AND sd.summary_date >= v_today - 7
    AND sd.stock_close > 0
    AND p.is_active = true
  GROUP BY s.name
  ORDER BY COUNT(DISTINCT sd.product_id) DESC
  LIMIT 1;

  SELECT COUNT(*) INTO v_total_vars
  FROM product_variants WHERE is_active = true;

  -- BUG-DB-4 fix: verifica todos os 6 slots de data futura, não só next_date_1
  SELECT
    COUNT(*) FILTER (
      WHERE pv.stock_quantity = 0
        AND (
          (pv.next_date_1 IS NOT NULL AND pv.next_date_1 > v_today) OR
          (pv.next_date_2 IS NOT NULL AND pv.next_date_2 > v_today) OR
          (pv.next_date_3 IS NOT NULL AND pv.next_date_3 > v_today) OR
          (pv.next_date_4 IS NOT NULL AND pv.next_date_4 > v_today) OR
          (pv.next_date_5 IS NOT NULL AND pv.next_date_5 > v_today) OR
          (pv.next_date_6 IS NOT NULL AND pv.next_date_6 > v_today)
        )
    ),
    COUNT(*) FILTER (
      WHERE (
        (pv.next_date_1 IS NOT NULL AND pv.next_date_1 > v_today) OR
        (pv.next_date_2 IS NOT NULL AND pv.next_date_2 > v_today) OR
        (pv.next_date_3 IS NOT NULL AND pv.next_date_3 > v_today) OR
        (pv.next_date_4 IS NOT NULL AND pv.next_date_4 > v_today) OR
        (pv.next_date_5 IS NOT NULL AND pv.next_date_5 > v_today) OR
        (pv.next_date_6 IS NOT NULL AND pv.next_date_6 > v_today)
      )
    )
  INTO v_ativas, v_aguardando
  FROM product_variants pv
  WHERE pv.is_active = true;

  v_pct_ativas := ROUND(100.0 * v_ativas / NULLIF(v_total_vars, 0), 1);

  RETURN jsonb_build_object(
    'dias_historico_real',   v_dias_hist,
    'data_inicio_historico', v_data_min,
    'aviso_historico',
      CASE WHEN v_dias_hist < 30
           THEN 'Histórico incompleto: ' || v_dias_hist::text || ' dias disponíveis (meta: 30)'
           ELSE 'OK'
      END,
    'repostos_hoje',        v_hoje,
    'repostos_7d',          v_7d,
    'repostos_15d',         v_15d,
    'repostos_30d',         v_30d,
    '7d_igual_15d_aviso',   (v_7d = v_15d AND v_dias_hist < 15),
    'top_supplier_nome',    v_top_supplier,
    'top_supplier_count',   v_top_count,
    'variacoes_ativas_zero_com_previsao',   v_ativas,
    'variacoes_aguardando_lote',            v_aguardando,
    'pct_variacoes_com_reposicao',          v_pct_ativas,
    'gerado_em',   now(),
    'versao',      'v4_stable_20260620'
  );
END;
$$;

-- ─── 4. ACL hardening ────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.fn_get_recent_restocks(integer, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_get_recent_restocks(integer, date) FROM anon;
GRANT  EXECUTE ON FUNCTION public.fn_get_recent_restocks(integer, date) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_get_stock_notification_counts(date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_get_stock_notification_counts(date) FROM anon;
GRANT  EXECUTE ON FUNCTION public.fn_get_stock_notification_counts(date) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_get_reposicao_metrics() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_get_reposicao_metrics() FROM anon;
GRANT  EXECUTE ON FUNCTION public.fn_get_reposicao_metrics() TO authenticated;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
