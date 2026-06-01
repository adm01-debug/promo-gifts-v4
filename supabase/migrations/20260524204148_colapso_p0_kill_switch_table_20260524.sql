-- =============================================================
-- P0.2 — Tabela de kill-switches para parar tráfego em edge functions
-- legadas (ex.: external-db-bridge — Caminho B já migrou para PostgREST nativo,
-- mas a edge function continua sendo chamada por clientes legados, em LOOP,
-- gerando 30-50 invocações/segundo e saturando o pool de conexões).
--
-- Edge functions devem checar esta tabela no início e retornar 410 Gone
-- se estiverem desabilitadas. A leitura é pública (anon/authenticated)
-- pois a checagem precisa ocorrer cedo na request, sem JWT validado ainda.
-- =============================================================
CREATE TABLE IF NOT EXISTS public.system_kill_switches (
  switch_name        text PRIMARY KEY,
  enabled            boolean NOT NULL DEFAULT true,
  reason             text,
  legacy_message     text,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.system_kill_switches ENABLE ROW LEVEL SECURITY;

-- Leitura pública (para edge functions checarem rapidamente)
DROP POLICY IF EXISTS "kill_switches_read_all" ON public.system_kill_switches;
CREATE POLICY "kill_switches_read_all"
  ON public.system_kill_switches
  FOR SELECT
  USING (true);

-- Escrita apenas admins
DROP POLICY IF EXISTS "kill_switches_write_admin" ON public.system_kill_switches;
CREATE POLICY "kill_switches_write_admin"
  ON public.system_kill_switches
  FOR ALL
  USING (public.is_admin_or_above((SELECT auth.uid())))
  WITH CHECK (public.is_admin_or_above((SELECT auth.uid())));

GRANT SELECT ON public.system_kill_switches TO anon, authenticated, service_role;
GRANT ALL ON public.system_kill_switches TO postgres;

-- Pré-popular com o switch para external-db-bridge (DESABILITADO por padrão)
INSERT INTO public.system_kill_switches (switch_name, enabled, reason, legacy_message)
VALUES (
  'edge_external_db_bridge',
  false,  -- DESABILITADO: força front-ends legados a migrar para PostgREST nativo (Caminho B)
  'Substituída pelo Caminho B: PostgREST nativo. PRs #230-232 do antigo repo Promo_Gifts.',
  'A função external-db-bridge foi descontinuada. Use chamadas REST nativas em /rest/v1/.'
)
ON CONFLICT (switch_name) DO NOTHING;

COMMENT ON TABLE public.system_kill_switches IS
'Switches para desligar features/edge-functions legadas a quente. Edge functions devem checar esta tabela antes de processar.';
