-- Reconcile: un-archive 7 LIVE RPC functions wrongly moved to schema `archive`
-- by the FAXINA DB Tier-3 stats-gated cleanup (2026-06-20).
--
-- ROOT CAUSE
--   The faxina selection classified a function as "dead" partly via execution
--   stats (pg_stat_statements). These 7 functions were freshly merged in the
--   2026-06-21 integration wave, so they had ~zero execution stats at archive
--   time and were misclassified as dead — despite being referenced in the app
--   (src/**/*.ts via supabase.rpc()/untypedRpc()). This is the exact failure
--   mode CLAUDE.md REGRA #3 warns about: "nunca classifique como dead code sem
--   verificar". cf. REGRA #5 (faxina) + the bulk-archive evidence header which
--   relied on "0 repo refs" computed before the favorites/collections/kit code
--   landed.
--
-- IMPACT (before this migration)
--   PostgREST resolves supabase.rpc('<name>') against `public`. While these sat
--   in `archive`, every call failed at runtime with PGRST202 (function not
--   found), breaking:
--     restore_favorite_from_trash   -> Favoritos: restaurar item da lixeira
--     get_collections_weekly_count  -> Coleções: heatmap semanal
--     get_top_collected_products    -> Coleções: empty-state inteligente
--     increment_kit_template_usage  -> Kit builder: contador de uso de template
--     check_hardening_status        -> Admin: card de hardening de segurança
--     get_auto_test_job_status      -> Admin: status do job de auto-teste
--     execute_role_migration_batch  -> Admin: migração de roles em lote
--
-- SAFETY
--   * ALTER FUNCTION ... SET SCHEMA carries the ACL; these functions still hold
--     authenticated=EXECUTE in archive, so no re-grant is required.
--   * Idempotent + reset-safe: only moves a function that is currently in
--     `archive` and absent from `public`. On a fresh `supabase db reset` the
--     functions already exist in `public` (their original migrations) and
--     nothing is in `archive`, so every iteration is a no-op.
--   * Reversible: ALTER FUNCTION public.<sig> SET SCHEMA archive.
--
-- DELIBERATELY NOT RESTORED
--   check_auth_config_status — intentionally absent from public; the call site
--   (src/lib/auth/auth-audit.ts) documents this and degrades gracefully.

do $$
declare
  targets text[][] := array[
    array['restore_favorite_from_trash', '_trash_id uuid, _user_id uuid'],
    array['get_collections_weekly_count', '_weeks integer'],
    array['get_top_collected_products',  '_days integer, _limit integer'],
    array['increment_kit_template_usage', '_template_id uuid'],
    array['check_hardening_status',       ''],
    array['get_auto_test_job_status',     '_limit integer'],
    array['execute_role_migration_batch', '_label text, _reason text, _items jsonb, _dry_run boolean']
  ];
  t text[];
  sig text;
  moved int := 0;
begin
  foreach t slice 1 in array targets loop
    sig := format('%I(%s)', t[1], t[2]);

    if exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'archive' and p.proname = t[1]
        and pg_get_function_identity_arguments(p.oid) = t[2]
    ) and not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = t[1]
        and pg_get_function_identity_arguments(p.oid) = t[2]
    ) then
      execute format('ALTER FUNCTION archive.%s SET SCHEMA public', sig);
      moved := moved + 1;
      raise notice 'reconcile: moved archive.% -> public', sig;
    else
      raise notice 'reconcile: skip % (already in public or not in archive)', sig;
    end if;
  end loop;

  raise notice 'reconcile: % function(s) moved back to public', moved;
end $$;
