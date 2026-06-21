-- FIX: fn_xbz_site_collect had search_path="" (empty) which caused intermittent
-- "relation does not exist" errors for unqualified table names like supplier_products_raw.
-- Setting search_path=public,extensions,pg_temp consistent with fn_xbz_site_tick.

CREATE OR REPLACE FUNCTION public.fn_xbz_site_collect(p_max integer DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_sup uuid := 'd6718a29-e954-4c1b-bd84-03ea24884900';
  rec record; v_sc int; v_body text; v_payload jsonb; v_hash text; v_err text;
  v_ok int := 0; v_fail int := 0; v_wait int := 0;
BEGIN
  FOR rec IN
    SELECT raw_data->>'CodigoAmigavel' AS codigo_key,
           regexp_replace(raw_data->>'CodigoAmigavel','[^A-Za-z0-9-]','','g') AS codigo_url,
           max(site_fetch_req_id) AS req, min(site_source_url) AS url
    FROM supplier_products_raw
    WHERE supplier_id=v_sup AND site_status='processing' AND site_fetch_req_id IS NOT NULL
    GROUP BY 1,2
    LIMIT p_max
  LOOP
    SELECT status_code, content INTO v_sc, v_body FROM net._http_response WHERE id = rec.req;
    IF NOT FOUND THEN v_wait := v_wait + 1; CONTINUE; END IF;
    v_err := NULL;

    IF v_sc <> 200 OR length(COALESCE(v_body,'')) <= 2000 OR position('Just a moment' in v_body) > 0 THEN
      v_err := left(COALESCE(substring(v_body from 'Warning: ([^\n]+)'),
                             'HTTP '||COALESCE(v_sc::text,'?')||' len='||length(COALESCE(v_body,''))), 200);
    ELSE
      v_payload := public.fn_parse_xbz_site_html(v_body, rec.codigo_url, rec.url);
      -- soft-fail: pagina carregou mas nao e um produto
      IF COALESCE(v_payload->>'nome','') IN ('','XBZ Brindes','www.xbzbrindes.com.br')
         OR (v_payload->'categorias' = '[]'::jsonb AND v_payload->'imagens' = '[]'::jsonb) THEN
        v_err := 'pagina nao-produto (generica/redirect)';
      END IF;
    END IF;

    IF v_err IS NULL THEN
      v_hash := encode(extensions.digest(v_payload::text,'sha256'),'hex');
      UPDATE supplier_products_raw t
        SET site_data=v_payload, site_hash=v_hash, site_status='processed',
            site_scraped_at=now(), site_processed_at=now(),
            site_last_error=NULL, site_fetch_req_id=NULL
        WHERE t.supplier_id=v_sup AND t.raw_data->>'CodigoAmigavel'=rec.codigo_key;
      v_ok := v_ok + 1;
    ELSE
      UPDATE supplier_products_raw t
        SET site_status='failed', site_attempts=COALESCE(site_attempts,0)+1,
            site_last_error=v_err, site_fetch_req_id=NULL
        WHERE t.supplier_id=v_sup AND t.raw_data->>'CodigoAmigavel'=rec.codigo_key;
      v_fail := v_fail + 1;
    END IF;
    DELETE FROM net._http_response WHERE id = rec.req;
  END LOOP;
  RETURN jsonb_build_object('processados',v_ok,'falhas',v_fail,'aguardando',v_wait);
END;
$$;
