-- Migration: P0.2 — Tabela de kill-switches para edge functions legadas
-- Contexto: edge function `external-db-bridge` (aposentada no Caminho B, PRs #230-232 do antigo repo Promo_Gifts)
-- ainda está sendo chamada por clientes legados em LOOP (30-50 invocações/segundo),
-- cada uma disparando 5-7 sub-queries no banco. O resultado é uma tempestade que satura
-- o pool de 90 conexões do Postgres.
--
-- Estratégia: edge functions devem checar esta tabela ANTES de processar e retornar
-- 410 Gone imediatamente quando o switch correspondente estiver desabilitado.
-- Aplicada em produção em 2026-05-24.

CREATE TABLE IF NOT EXISTS public.system_kill_switches (
  switch_name        text PRIMARY KEY,
  enabled            boolean NOT NULL DEFAULT true,
  reason             text,
  legacy_message     text,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.system_kill_switches ENABLE ROW LEVEL SECURITY;

-- Leitura pública (edge functions precisam checar antes de validar JWT)
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
GRANT ALL    ON public.system_kill_switches TO postgres;

INSERT INTO public.system_kill_switches (switch_name, enabled, reason, legacy_message)
VALUES (
  'edge_external_db_bridge',
  false,
  'Substituída pelo Caminho B: PostgREST nativo. PRs #230-232 do antigo repo Promo_Gifts.',
  'A função external-db-bridge foi descontinuada. Use chamadas REST nativas em /rest/v1/.'
)
ON CONFLICT (switch_name) DO NOTHING;

COMMENT ON TABLE public.system_kill_switches IS
'Switches para desligar features/edge-functions legadas a quente. Edge functions devem checar esta tabela antes de processar.';
