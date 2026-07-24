-- Hardening (gap encontrado na validação exaustiva): as views de observabilidade
-- criadas na auditoria de Estoque são internas (admin/serviço) e não devem ficar
-- na superfície de API anon/authenticated (PostgREST/pg_graphql).
-- security_invoker=true já aplica a RLS do chamador, mas removemos o SELECT por higiene.
revoke select on public.vw_stock_quantity_outliers  from anon, authenticated;
revoke select on public.vw_orphan_active_variants    from anon, authenticated;
