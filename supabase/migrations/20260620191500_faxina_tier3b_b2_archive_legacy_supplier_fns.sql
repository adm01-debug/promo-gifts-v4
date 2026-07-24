-- Faxina Tier 3b · batch 2 — arquiva (reversível) helpers legados de ingestão/fornecedor.
-- Gates: DB-orphan (0 refs em prosrc/views/crons/policies/defaults/constraints/índices/triggers)
--        + code-absent (sem consumidores externos, confirmado) + corpo confirmado legado/wrapper órfão.
-- Sucessores vivos preservados: fn_expire_novelties_with_stats, fn_process_asia_stock_pending,
--   fn_spot_stock_fast_sync, fn_apply_auto_tag_rules, edge fn asia-ingestion, materials-api.
-- Mecânica: ALTER FUNCTION ... SET SCHEMA archive (sem DROP). Reversão: scripts/faxina-rollback.sql.
do $$
declare
  v_fns text[] := array[
    'fn_ingest_asia_api_batch','fn_ingest_asia_product','fn_classify_spot_image','fn_spot_process_batch',
    'comparar_precos_spot','fn_resolve_supplier','fn_color_link_all_suppliers','fn_tag_product_complete',
    'fn_import_product_properties','extract_xbz_image_metadata','fn_get_asia_api_key','fn_get_asia_secret_key',
    'fn_get_cf_credentials','fn_extract_color_from_name','fn_extract_material_from_name','fn_recomendar_tecnica',
    'fn_list_deactivation_requests','create_material_with_equivalence','fn_expire_novelties'
  ];
  r record; n_fn int := 0; leftover int;
begin
  for r in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind='f' and p.proname = any(v_fns)
  loop
    if exists (select 1 from pg_trigger t where t.tgfoid=r.oid and not t.tgisinternal) then
      raise exception 'ABORT: %(%) é trigger-bound', r.proname, r.args;
    end if;
    execute format('alter function public.%I(%s) set schema archive', r.proname, r.args);
    insert into archive._cleanup_manifest(object_type,object_name,from_schema,to_schema,reason,evidence,session)
    select 'function', r.proname||'('||r.args||')','public','archive',
           'Tier3b-b2: DB-orphan + code-absent; helper legado ingestão/fornecedor (sucessor vivo no pipeline)',
           jsonb_build_object('args', r.args),
           'claude-faxina-2026-06-20'
    where not exists (select 1 from archive._cleanup_manifest m
                      where m.session='claude-faxina-2026-06-20' and m.object_type='function'
                        and m.object_name = r.proname||'('||r.args||')');
    n_fn := n_fn + 1;
  end loop;
  select count(*) into leftover from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind='f' and p.proname = any(v_fns);
  if leftover <> 0 then raise exception 'ABORT: % funções-alvo ainda no public', leftover; end if;
  raise notice 'Tier3b-b2 OK: % funções arquivadas', n_fn;
end $$;
