-- Faxina Tier 3b · batch 1 — arquiva (reversível) funções/views comprovadamente mortas.
--
-- Continuação de:
--   20260620160500_faxina_tier3_archive_dead_functions.sql (Tier 3 — 113 views + 11 funções)
-- Metodologia (5 gates, todos obrigatórios):
--   1. DB-orphan: 0 refs em prosrc de outras funções, defs de views/matviews, cron.job,
--      pg_policies (qual/with_check), defaults (pg_attrdef), constraints, índices, triggers.
--   2. code-absent: 0 ocorrências como string em src/ supabase/functions/ tests/ e2e/ scripts/
--      (apenas migrations/types.ts/*.md ignorados). Usuário confirmou: SEM consumidores externos
--      ao repositório, logo code-absent = prova completa de não-uso.
--   3. perfil de resíduo inequívoco: versionado-superado (_v10/_v11 com _v12 vivo),
--      classify_* legado (superado por fn_backfill_product_categories), helpers de ingestão
--      Asia "legacy"/"wp_to_canonical" (superados pelo edge fn asia-ingestion + crons atuais),
--      e views internas órfãs (NUNCA *_public — reservadas à exposição PostgREST).
--   4. sem overloads vivos (cada nome tem 1 overload, todos cobertos pelo gate 1).
--   5. reversível: ALTER ... SET SCHEMA archive (sem DROP) + log em archive._cleanup_manifest.
--
-- Rollback: scripts/faxina-rollback.sql  (ou ALTER ... SET SCHEMA public objeto-a-objeto).
-- Excluídos por evidência ao vivo: fn_spot_reconcile_variant_to_legacy (db_refs=1),
--   seed_discount_test_users (usado em tests/integration/discountApprovalFlow.test.ts),
--   generate_order_number_v5 e fn_simular_combo_gravacao base (mantidos por precaução — revisão).
do $$
declare
  v_fns text[] := array[
    'fn_simular_combo_gravacao_v10','fn_simular_combo_gravacao_v11',
    'classify_headphone','classify_powerbank','classify_speaker',
    'fn_asia_legacy_dispatch_batch','fn_asia_legacy_harvest_batch','fn_asia_wp_to_canonical'
  ];
  v_views text[] := array['v_audit_paradoxos_gravacao','v_product_videos_ready','vw_color_mapping'];
  r record; vname text; n_fn int := 0; n_vw int := 0; leftover int;
begin
  if not exists (select 1 from pg_namespace where nspname='archive') then
    raise exception 'ABORT: schema archive inexistente';
  end if;

  -- FUNÇÕES: move toda sobrecarga de cada nome alvo
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
           'Tier3b-b1: DB-orphan + code-absent; resíduo versionado/legacy/classify',
           jsonb_build_object('args', r.args),
           'claude-faxina-2026-06-20'
    where not exists (
      select 1 from archive._cleanup_manifest m
      where m.session='claude-faxina-2026-06-20' and m.object_type='function'
        and m.object_name = r.proname||'('||r.args||')'
    );
    n_fn := n_fn + 1;
  end loop;

  -- VIEWS
  foreach vname in array v_views loop
    if exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
               where n.nspname='public' and c.relname=vname and c.relkind='v') then
      execute format('alter view public.%I set schema archive', vname);
      insert into archive._cleanup_manifest(object_type,object_name,from_schema,to_schema,reason,evidence,session)
      select 'view', vname,'public','archive',
             'Tier3b-b1: view DB-orphan + code-absent; não é *_public',
             jsonb_build_object('kind','orphan_internal_view'),
             'claude-faxina-2026-06-20'
      where not exists (
        select 1 from archive._cleanup_manifest m
        where m.session='claude-faxina-2026-06-20' and m.object_type='view' and m.object_name=vname
      );
      n_vw := n_vw + 1;
    end if;
  end loop;

  -- INTEGRIDADE pós-move: nenhum alvo permanece no public
  select count(*) into leftover from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind='f' and p.proname = any(v_fns);
  if leftover <> 0 then raise exception 'ABORT: % funções-alvo ainda no public', leftover; end if;
  select count(*) into leftover from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='v' and c.relname = any(v_views);
  if leftover <> 0 then raise exception 'ABORT: % views-alvo ainda no public', leftover; end if;

  raise notice 'Tier3b-b1 OK: % funções, % views arquivadas', n_fn, n_vw;
end $$;
