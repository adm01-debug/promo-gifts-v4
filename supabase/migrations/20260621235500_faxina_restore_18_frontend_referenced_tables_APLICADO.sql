-- =============================================================================
-- APLICADO em 2026-06-21 via Supabase MCP (apply_migration:
--   restore_18_wrongly_archived_frontend_tables). Projeto doufsxqlfjyuvxuezpln.
-- Decisão de arquiteto (Pink e Cérebro): opção (B) — restaurar em lote as 18
-- tabelas que a FAXINA deixou em archive mas que possuem .from() VIVO no
-- frontend (mesma classe do admin_settings). Não-destrutivo: SET SCHEMA preserva
-- dados/RLS/policies por OID.
-- =============================================================================
--
-- COMO FORAM ENCONTRADAS
--   grep cruzado: 113 nomes distintos em .from('...') no src/ × schema archive.
--   - 90 OK em public
--   - 3 falsos-positivos: avatars (bucket Storage), tpgo/tpgo_faixa (só em comentário)
--   - 20 só em archive. Destes:
--       * 18 presentes em types.ts (contrato afirma public) -> 404 silencioso. ESTES.
--       * companies, notifications -> fora de types.ts (tratados à parte; ver flag).
--         [notifications/device_login_notifications já restaurados na 20260621230000]
--
-- PRÉ-FLIGHT ADVERSARIAL (0 FAIL) antes da mutação:
--   - fns_consomem_archive = 0 em todas as 18 (ninguém lê de propósito archive.<t>)
--   - RLS habilitado + policies presentes em todas (1-4 cada)
--   - Sem colisão: nenhuma das 18 existia em public no momento da restauração
--   - Grants: 12 já tinham grants de app (viajam no SET SCHEMA); 6 com grants
--     zerados precisaram re-grant
--   - Policies de SELECT dos 6 re-grantados auditadas: anon recebe 0 linhas em
--     todas (deny por ausência de policy anon, ou USING falso p/ auth.uid() NULL)
--
-- VERIFICAÇÃO PÓS: 18/18 em public, 0 em archive, 6/6 re-grants OK, NOTIFY pgrst.
-- =============================================================================

-- MIGRATION: restore_18_wrongly_archived_frontend_tables
DO $$
DECLARE t text; moved int := 0;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ai_usage_events','art_file_attachments','cart_templates','collection_items_trash',
    'component_media','file_scan_logs','generated_mockups','hardening_health_snapshots',
    'magic_up_brand_kits','magic_up_campaigns','magic_up_generations','mockup_drafts',
    'mockup_prompt_configs','product_component_locations','product_group_members',
    'product_price_freshness_overrides','product_sync_logs','visual_search_feedback'
  ] LOOP
    IF to_regclass('public.'||t) IS NULL AND to_regclass('archive.'||t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE archive.%I SET SCHEMA public', t);
      moved := moved + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'tabelas movidas archive->public: %', moved;
END $$;

-- Re-grant dos 6 com grants de app removidos. authenticated full CRUD;
-- anon apenas SELECT (RLS é o gate real; anon -> 0 linhas em todas, auditado).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'magic_up_brand_kits','magic_up_campaigns','product_component_locations',
    'product_price_freshness_overrides','product_sync_logs','visual_search_feedback'
  ] LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON public.%I TO authenticated', t);
      EXECUTE format('GRANT SELECT ON public.%I TO anon', t);
    END IF;
  END LOOP;
END $$;

-- Pós-aplicação: NOTIFY pgrst, 'reload schema'; (executado via execute_sql)
