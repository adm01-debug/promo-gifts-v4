-- ============================================================================
-- audit_log — Trilha de auditoria GENERICA por entidade (application-level)
-- VERSAO RECONCILIADORA / IDEMPOTENTE
-- ----------------------------------------------------------------------------
-- MOTIVO
--   O frontend (src/hooks/admin/useAuditLog.ts -> logAction / fetchAuditHistory
--   / fetchAllAuditLogs; AdminProductFormPage; src/components/audit/AuditHistory.tsx)
--   le e escreve em public.audit_log. A tabela foi dropada manualmente do Gold
--   (doufsxqlfjyuvxuezpln) entre mai e jun/2026 SEM migration de reversao.
--   Resultado: PGRST205 "Could not find the table 'public.audit_log' in the
--   schema cache" -> 404 no painel de historico de auditoria do produto.
--
-- APLICACAO EM PRODUCAO
--   Esta migration foi aplicada ao Gold em 2026-06-26 ~20:24 UTC via Supabase MCP
--   (registro supabase_migrations.schema_migrations, version 20260626202416).
--   Em producao a tabela JA esta no contrato canonico; o bloco reconciliador
--   abaixo e NO-OP (todos os passos sao guardados por IF [NOT] EXISTS). Este
--   arquivo existe para rastreabilidade e para reconstruir o estado correto em
--   `supabase db reset` / ambientes novos.
--
-- POR QUE RECONCILIADORA (e nao um simples CREATE TABLE)
--   O historico de migrations deste repo deixa a tabela num estado "Frankenstein":
--     * 2025-01 (complete_schema / schema_no_gamification): cria o contrato
--       CANONICO (entity_type/entity_id, ip_address inet, FK->profiles).
--     * 2025-12 (audit_log_universal): enxerta colunas LEGADAS (table_name,
--       record_id, changed_fields), troca ip_address p/ TEXT, cria FK->auth.users,
--       triggers + audit_trigger_func() + get_record_history().
--   Num replay, um "CREATE TABLE IF NOT EXISTS" simples NAO corrigiria a tabela
--   legada pre-existente. Este script converge ao contrato canonico a partir de
--   QUALQUER estado anterior, PRESERVANDO dados (nunca dropa a tabela).
--   Validado por dry-run (BEGIN...ROLLBACK) nos dois caminhos em 2026-06-26:
--     - estado canonico (producao): no-op idempotente;
--     - estado Frankenstein simulado: converge e preserva linhas (rows_preserved=2,
--       ip TEXT->inet, FK auth.users->profiles, colunas/indices/policies legados removidos).
--
-- CONTRATO
--   id uuid PK, user_id uuid (FK profiles ON DELETE SET NULL),
--   action text CHECK IN (INSERT/UPDATE/DELETE), entity_type text, entity_id uuid,
--   old_values/new_values jsonb, ip_address inet, user_agent text, created_at timestamptz.
--   O embed PostgREST (profiles:user_id) exige a FK user_id->profiles.
--
-- SEGURANCA (RLS)
--   * RLS ON; INSERT self-attributed (auth.uid()=user_id) — NAO quebra editores
--     org-owner/admin que nao sao supervisores globais; SELECT dev-only
--     (can_view_audit_logs); SEM UPDATE/DELETE (imutavel).
--   * Grants: anon=(nada), authenticated=SELECT,INSERT, service_role=ALL.
--
-- POPULACAO: application-level (a app escreve via cliente autenticado).
--   NAO adicionar triggers de auditoria aqui — duplicaria as escritas da app.
--
-- fix_version: 2026-06-26 audit_log_create
-- ANTI-REGRESSAO (Lovable bot / gpt-engineer-app): NAO dropar esta tabela nem
--   suas policies ao regenerar types.ts; e o SSOT do historico de auditoria por
--   entidade. Manter este cabecalho.
-- ============================================================================

-- PARTE 1: limpeza de funcs/triggers legados (enxerto Frankenstein audit_log_universal dez/2025)
DROP FUNCTION IF EXISTS public.audit_trigger_func() CASCADE;
DROP FUNCTION IF EXISTS public.get_record_history(text, uuid);

-- PARTE 2: garantir tabela + TODAS as colunas canonicas (idempotente)
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id     uuid        NULL,
  action      text        NOT NULL,
  entity_type text        NOT NULL,
  entity_id   uuid        NOT NULL,
  old_values  jsonb       NULL,
  new_values  jsonb       NULL,
  ip_address  inet        NULL,
  user_agent  text        NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS action text;
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS entity_type text;
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS entity_id uuid;
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS old_values jsonb;
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS new_values jsonb;
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS ip_address inet;
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS user_agent text;
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS created_at timestamptz;

-- PARTE 3: reconciliar ip_address TEXT(legado) -> inet (neutraliza valores nao-IP para NULL)
DO $b3$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='audit_log'
               AND column_name='ip_address' AND udt_name <> 'inet') THEN
    EXECUTE 'ALTER TABLE public.audit_log ALTER COLUMN ip_address TYPE inet USING CASE WHEN ip_address::text ~ ''^[0-9a-fA-F:.]+(/[0-9]+)?$'' THEN ip_address::text::inet ELSE NULL END';
  END IF;
END $b3$;

-- PARTE 4: remover colunas legadas (audit_log_universal)
ALTER TABLE public.audit_log DROP COLUMN IF EXISTS table_name;
ALTER TABLE public.audit_log DROP COLUMN IF EXISTS record_id;
ALTER TABLE public.audit_log DROP COLUMN IF EXISTS changed_fields;

-- PARTE 5: defaults
ALTER TABLE public.audit_log ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.audit_log ALTER COLUMN created_at SET DEFAULT now();

-- PARTE 6: NOT NULL guards (so se nao houver violacao)
DO $b6$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.audit_log WHERE id IS NULL) THEN
    ALTER TABLE public.audit_log ALTER COLUMN id SET NOT NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.audit_log WHERE action IS NULL) THEN
    ALTER TABLE public.audit_log ALTER COLUMN action SET NOT NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.audit_log WHERE entity_type IS NULL) THEN
    ALTER TABLE public.audit_log ALTER COLUMN entity_type SET NOT NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.audit_log WHERE entity_id IS NULL) THEN
    ALTER TABLE public.audit_log ALTER COLUMN entity_id SET NOT NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.audit_log WHERE created_at IS NULL) THEN
    ALTER TABLE public.audit_log ALTER COLUMN created_at SET NOT NULL; END IF;
END $b6$;

-- PARTE 7: PK guard
DO $b7$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.audit_log'::regclass AND contype='p') THEN
    ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);
  END IF;
END $b7$;

-- PARTE 8: CHECK action guard
DO $b8$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.audit_log'::regclass AND conname='audit_log_action_check')
     AND NOT EXISTS (SELECT 1 FROM public.audit_log WHERE action IS NOT NULL AND action NOT IN ('INSERT','UPDATE','DELETE')) THEN
    ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_action_check CHECK (action IN ('INSERT','UPDATE','DELETE'));
  END IF;
END $b8$;

-- PARTE 9: FK reconcile (remove FK nao-profiles em user_id; garante FK->profiles)
DO $b9$
DECLARE
  v_userattnum smallint;
  r record;
BEGIN
  SELECT attnum INTO v_userattnum FROM pg_attribute
   WHERE attrelid='public.audit_log'::regclass AND attname='user_id' AND NOT attisdropped;
  IF v_userattnum IS NULL THEN RETURN; END IF;
  FOR r IN
    SELECT conname, confrelid::regclass::text AS reftbl
    FROM pg_constraint
    WHERE conrelid='public.audit_log'::regclass AND contype='f' AND v_userattnum = ANY(conkey)
  LOOP
    IF r.reftbl NOT IN ('profiles','public.profiles') THEN
      EXECUTE format('ALTER TABLE public.audit_log DROP CONSTRAINT %I', r.conname);
    END IF;
  END LOOP;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.audit_log'::regclass AND contype='f'
      AND v_userattnum = ANY(conkey) AND confrelid='public.profiles'::regclass
  ) THEN
    ALTER TABLE public.audit_log
      ADD CONSTRAINT audit_log_user_id_fkey FOREIGN KEY (user_id)
      REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $b9$;

-- PARTE 10: indices (dropa legados, cria canonicos)
DROP INDEX IF EXISTS public.idx_audit_log_table;
DROP INDEX IF EXISTS public.idx_audit_log_record;
DROP INDEX IF EXISTS public.idx_audit_log_action;
CREATE INDEX IF NOT EXISTS idx_audit_log_entity     ON public.audit_log (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id    ON public.audit_log (user_id);

-- PARTE 11: RLS + policies (dropa legadas; cria canonicas com fallback de helper)
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_log;
DROP POLICY IF EXISTS "Users can view own audit logs" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_insert_self" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_select_dev" ON public.audit_log;
CREATE POLICY "audit_log_insert_self" ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
DO $b11$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname='public' AND p.proname='can_view_audit_logs') THEN
    EXECUTE 'CREATE POLICY "audit_log_select_dev" ON public.audit_log FOR SELECT TO authenticated USING (public.can_view_audit_logs((SELECT auth.uid())))';
  ELSIF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname='public' AND p.proname='is_dev') THEN
    EXECUTE 'CREATE POLICY "audit_log_select_dev" ON public.audit_log FOR SELECT TO authenticated USING (public.is_dev((SELECT auth.uid())))';
  ELSE
    EXECUTE 'CREATE POLICY "audit_log_select_dev" ON public.audit_log FOR SELECT TO authenticated USING (false)';
  END IF;
END $b11$;

-- PARTE 12: grants (revoga amplos; concede o minimo)
REVOKE ALL ON public.audit_log FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL          ON public.audit_log TO service_role;

COMMENT ON TABLE public.audit_log IS
  'Trilha de auditoria generica por entidade (application-level), escrita por useAuditLog.logAction (INSERT/UPDATE/DELETE) e lida por fetchAuditHistory/fetchAllAuditLogs. Imutavel; leitura dev-only (can_view_audit_logs); embed profiles:user_id via FK. fix_version 2026-06-26. NAO adicionar triggers (duplicaria escritas da app).';

-- PostgREST: expor a tabela e a relacao FK (embed profiles:user_id) imediatamente
NOTIFY pgrst, 'reload schema';
