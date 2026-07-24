-- ============================================================================
-- Etapa 4 (pré-requisito) — Endurecimento de RLS de ESCRITA: GESTÃO != VENDEDOR
-- Projeto: pqpdolkaeqlyzpdpbizo (Promo Brindes / PromoGifts)
-- Aplicado em produção via Supabase MCP em 2026-05-30 (este arquivo = rastreio git).
-- ----------------------------------------------------------------------------
-- REGRA DE NEGÓCIO: gestão (editar/criar/excluir) de produtos, fornecedores,
-- cores, materiais, variações e gravação NÃO é permitida a vendedores.
--
-- PROBLEMA: vendedores são `member` da org. Diversas policies de escrita exigiam
-- apenas user_is_org_member()/user_belongs_to_org() — ou seja, qualquer membro
-- (incl. vendedor) podia escrever tabelas-filhas de catálogo. Ligar o caminho de
-- escrita REST-native (Etapa 4) sem corrigir isso permitiria a vendedor o que a
-- regra proíbe.
--
-- CORREÇÃO: para as 21 tabelas de GESTÃO abaixo, remover toda policy de escrita
-- nível-membro e recriar escrita (INSERT/UPDATE/DELETE) exigindo OWNER/ADMIN via
-- is_org_owner_or_admin() — direto (organization_id) ou via tabela-pai
-- (products/suppliers). Para policies `FOR ALL` nível-membro, o SELECT é recriado
-- com o mesmo predicado para PRESERVAR a leitura (sem regressão).
--
-- FORA DE ESCOPO (NÃO tocadas — são o trabalho do vendedor): orders, order_items,
-- quotes. Gravação (tecnicas_gravacao, tabela_preco_gravacao_oficial[_faixa]) já
-- exige is_admin_or_above/is_dev.
--
-- Supera a migration 20260530170000 (print_area_techniques/supplier_branches), que
-- usava nível-membro p/ pat — aqui ambas recebem owner/admin.
--
-- Idempotente (DROP IF EXISTS) e AUTO-VERIFICÁVEL: aborta (rollback) se sobrar
-- qualquer policy de escrita nível-membro nas tabelas do conjunto.
-- ============================================================================

DO $$
DECLARE
  direct text[] := array['category_relationships','color_equivalences','color_groups','color_nuances',
     'color_variations','material_groups','product_materials','supplier_colors','tags',
     'variant_supplier_sources','variation_types','variation_values'];
  parent jsonb := jsonb_build_array(
     jsonb_build_object('t','product_images','fk','product_id','pt','products'),
     jsonb_build_object('t','product_videos','fk','product_id','pt','products'),
     jsonb_build_object('t','product_variants','fk','product_id','pt','products'),
     jsonb_build_object('t','product_kit_components','fk','kit_product_id','pt','products'),
     jsonb_build_object('t','product_category_assignments','fk','product_id','pt','products'),
     jsonb_build_object('t','product_relationships','fk','product_id','pt','products'),
     jsonb_build_object('t','product_tags','fk','product_id','pt','products'),
     jsonb_build_object('t','print_area_techniques','fk','product_id','pt','products'),
     jsonb_build_object('t','supplier_branches','fk','supplier_id','pt','suppliers'));
  t text; pj jsonb; fk text; pt text; r record; remaining int;
BEGIN
  FOREACH t IN ARRAY direct LOOP
    -- Skip tabelas que não existem ou não têm coluna organization_id no preview snapshot
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t)
       OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='organization_id') THEN
      CONTINUE;
    END IF;
    FOR r IN SELECT polname, polcmd, pg_get_expr(polqual,polrelid) q FROM pg_policy
       WHERE polrelid=('public.'||t)::regclass AND polcmd IN ('a','w','d','*')
       AND (coalesce(pg_get_expr(polqual,polrelid),'')~*'user_is_org_member|user_belongs_to_org'
         OR coalesce(pg_get_expr(polwithcheck,polrelid),'')~*'user_is_org_member|user_belongs_to_org') LOOP
      EXECUTE format('drop policy %I on public.%I', r.polname, t);
      IF r.polcmd='*' AND r.q IS NOT NULL THEN
        EXECUTE format('drop policy if exists %I on public.%I', t||'_member_read', t);
        EXECUTE format('create policy %I on public.%I for select to authenticated using (%s)', t||'_member_read', t, r.q);
      END IF;
    END LOOP;
    EXECUTE format('drop policy if exists %I on public.%I', t||'_oa_ins', t);
    EXECUTE format('drop policy if exists %I on public.%I', t||'_oa_upd', t);
    EXECUTE format('drop policy if exists %I on public.%I', t||'_oa_del', t);
    EXECUTE format('create policy %I on public.%I for insert to authenticated with check (is_org_owner_or_admin(organization_id))', t||'_oa_ins', t);
    EXECUTE format('create policy %I on public.%I for update to authenticated using (is_org_owner_or_admin(organization_id)) with check (is_org_owner_or_admin(organization_id))', t||'_oa_upd', t);
    EXECUTE format('create policy %I on public.%I for delete to authenticated using (is_org_owner_or_admin(organization_id))', t||'_oa_del', t);
  END LOOP;

  FOR pj IN SELECT * FROM jsonb_array_elements(parent) LOOP
    t := pj->>'t'; fk := pj->>'fk'; pt := pj->>'pt';
    -- Skip se tabela filho/pai ou coluna FK/organization_id estão ausentes no preview snapshot
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t)
       OR NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=pt)
       OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name=fk)
       OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=pt AND column_name='organization_id') THEN
      CONTINUE;
    END IF;
    FOR r IN SELECT polname FROM pg_policy WHERE polrelid=('public.'||t)::regclass AND polcmd IN ('a','w','d','*')
       AND (coalesce(pg_get_expr(polqual,polrelid),'')~*'user_is_org_member|user_belongs_to_org'
         OR coalesce(pg_get_expr(polwithcheck,polrelid),'')~*'user_is_org_member|user_belongs_to_org') LOOP
      EXECUTE format('drop policy %I on public.%I', r.polname, t);
    END LOOP;
    EXECUTE format('drop policy if exists %I on public.%I', t||'_oa_ins', t);
    EXECUTE format('drop policy if exists %I on public.%I', t||'_oa_upd', t);
    EXECUTE format('drop policy if exists %I on public.%I', t||'_oa_del', t);
    EXECUTE format('create policy %I on public.%I for insert to authenticated with check (exists(select 1 from public.%I p where p.id=%I.%I and is_org_owner_or_admin(p.organization_id)))', t||'_oa_ins', t, pt, t, fk);
    EXECUTE format('create policy %I on public.%I for update to authenticated using (exists(select 1 from public.%I p where p.id=%I.%I and is_org_owner_or_admin(p.organization_id))) with check (exists(select 1 from public.%I p where p.id=%I.%I and is_org_owner_or_admin(p.organization_id)))', t||'_oa_upd', t, pt, t, fk, pt, t, fk);
    EXECUTE format('create policy %I on public.%I for delete to authenticated using (exists(select 1 from public.%I p where p.id=%I.%I and is_org_owner_or_admin(p.organization_id)))', t||'_oa_del', t, pt, t, fk);
  END LOOP;

  -- invariante: nenhuma policy de escrita nível-membro pode sobrar
  -- (verifica apenas tabelas que realmente existem)
  SELECT count(*) INTO remaining FROM pg_policy pl JOIN pg_class c ON c.oid=pl.polrelid
   WHERE c.relname = any(direct || array(select jsonb_array_elements(parent)->>'t'))
     AND pl.polcmd IN ('a','w','d','*')
     AND (coalesce(pg_get_expr(pl.polqual,pl.polrelid),'')~*'user_is_org_member|user_belongs_to_org'
       OR coalesce(pg_get_expr(pl.polwithcheck,pl.polrelid),'')~*'user_is_org_member|user_belongs_to_org');
  IF remaining <> 0 THEN
    RAISE EXCEPTION 'harden RLS abortado: % policies de escrita nível-membro restantes', remaining;
  END IF;
END $$;
