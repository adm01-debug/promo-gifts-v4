-- FAXINA DB — Tier 3: archive provably-dead VIEWS (reversible: ALTER VIEW ... SET SCHEMA)
--
-- Applied to production (doufsxqlfjyuvxuezpln) on 2026-06-20 via Supabase MCP. Mirrors DB state.
-- Archived 113 views (public views 171 -> 58).
--
-- Gates (recomputed at run time): 0 dependent views, 0 refs in function bodies, 0 refs in cron
-- commands, 0 refs in RLS policies, 0 refs anywhere in the repo (.ts/.tsx/.js/.mjs across
-- src/edge/tests/e2e/scripts), and never a *_public view (those are intentionally PostgREST-exposed).
-- Idempotent + manifest-logged. Rollback: scripts/faxina-rollback.sql.

do $$
declare
  r record; n int := 0;
  v_keep text[] := array[
    'v_products_public','v_suppliers_public','v_print_area_techniques_public','v_products_without_video',
    'v_products_without_videos','v_kit_component_complete','materials_complete','v_product_images_cdn',
    'v_product_videos_cdn','v_media_stats','v_products_with_tags','v_products_min_price','v_products_without_images',
    'v_products_missing_primary_image','v_kit_with_components','vw_sitemap_products','vw_sitemap_categories',
    'v_commemorative_dates_calendar','v_commemorative_dates_with_colors','v_variants_with_commemorative_dates',
    'vw_product_commemorative_dates','v_n8n_sync_summary','v_n8n_sync_errors','v_n8n_sync_success_recent',
    'v_variant_sale_prices_public','v_price_history_safe','v_products_with_techniques','v_products_with_stock',
    'v_product_print_areas_complete','v_product_attributes_formatted','v_kit_component_print_areas',
    'v_customization_price_summary','v_variant_pricing_complete','v_technique_stats','v_techniques_stricker_mapping',
    'vw_medallion_coverage','v_pipeline_progress','v_super_filtro_options','v_catalog_stats',
    'v_kill_switch_hits_summary','v_smoke_tests_latest_run','v_smoke_tests_trend','v_ai_function_routing_effective'
  ];
begin
  for r in
    with v as (
      select c.oid, c.relname from pg_class c join pg_namespace nsp on nsp.oid=c.relnamespace
      where nsp.nspname='public' and c.relkind='v'
    )
    select v.relname from v
    where (select count(distinct rw.ev_class) from pg_depend d join pg_rewrite rw on rw.oid=d.objid where d.refobjid=v.oid and rw.ev_class<>v.oid)=0
      and (select count(*) from pg_proc p join pg_namespace n2 on n2.oid=p.pronamespace where n2.nspname='public' and p.prosrc ~ ('\m'||v.relname||'\M'))=0
      and (select count(*) from cron.job j where j.command ~ ('\m'||v.relname||'\M'))=0
      and (select count(*) from pg_policies pp where (coalesce(pp.qual,'')||' '||coalesce(pp.with_check,'')) ~ ('\m'||v.relname||'\M'))=0
      and v.relname <> all(v_keep)
      and v.relname not like '%\_public'
    order by v.relname
  loop
    if exists (select 1 from information_schema.tables where table_schema='archive' and table_name=r.relname) then
      raise notice 'SKIP view % (collision in archive)', r.relname; continue; end if;
    execute format('alter view public.%I set schema archive', r.relname);
    insert into archive._cleanup_manifest(object_type,object_name,reason,evidence,session)
    values ('view', r.relname,
            'dead view: 0 dependents, 0 refs in functions/crons/policies/repo, not *_public',
            jsonb_build_object('phase','tier3_view'),'claude-faxina-2026-06-20');
    n := n + 1;
    raise notice 'ARCHIVED view public.% -> archive.%', r.relname, r.relname;
  end loop;
  raise notice 'Tier-3 archived % views', n;
end $$;
