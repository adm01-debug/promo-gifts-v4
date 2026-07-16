-- ============================================================================
-- Draft: bookmarks e última-página lidas — sync cross-device do viewer público
-- Autor: Claude Opus 4.8 (agente Lovable)
-- Data: 2026-07-12
-- Status: 🟡 DRAFT — aguardando aprovação do PO antes de promover
--
-- Escopo: substitui o localStorage do PublicMagazineView por persistência
-- server-side no BD Gold (doufsxqlfjyuvxuezpln), permitindo:
--   - Ler bookmarks/última página em qualquer dispositivo
--   - Preservar leituras quando o usuário troca de browser
--   - Analytics: quais páginas são mais marcadas (product-market fit)
--
-- Compatibilidade: viewer atual continua funcionando (localStorage-first,
-- server-fallback). Migração incremental: o hook grava nos DOIS lugares
-- durante o período de transição, depois removemos o localStorage.
--
-- Escopo de dados: 1 linha por (magazine_public_token, viewer_fingerprint).
-- Não requer autenticação — o token público da revista já é a chave de
-- acesso; o fingerprint (localStorage UUID gerado no primeiro load) evita
-- que dois dispositivos escrevam por cima um do outro sem obrigar login.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.magazine_reader_state (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  magazine_token    TEXT NOT NULL,                    -- Magazine.publicToken
  viewer_fingerprint TEXT NOT NULL,                   -- UUID gerado no client (1x por device)
  last_page_index   INTEGER NOT NULL DEFAULT 0,
  bookmarks         INTEGER[] NOT NULL DEFAULT '{}',  -- índices ordenados, sem repetidos
  user_id           UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- opcional, quando logado
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (magazine_token, viewer_fingerprint)
);

CREATE INDEX IF NOT EXISTS magazine_reader_state_token_idx
  ON public.magazine_reader_state (magazine_token);
CREATE INDEX IF NOT EXISTS magazine_reader_state_user_idx
  ON public.magazine_reader_state (user_id) WHERE user_id IS NOT NULL;

-- GRANTs (obrigatório antes de RLS — sem isso Data API dá permission denied)
GRANT SELECT, INSERT, UPDATE ON public.magazine_reader_state TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.magazine_reader_state TO authenticated;
GRANT ALL ON public.magazine_reader_state TO service_role;

-- RLS
ALTER TABLE public.magazine_reader_state ENABLE ROW LEVEL SECURITY;

-- Policy: qualquer visitante pode SELECT/INSERT/UPDATE seu próprio state
-- (identificado por magazine_token + viewer_fingerprint na URL/body).
-- Não vaza dados de outros usuários porque cada linha é chaveada pelo
-- fingerprint do próprio dispositivo. Não há SELECT de linhas alheias
-- porque a única forma de identificar uma linha é conhecendo os DOIS
-- valores (token + fingerprint) — ambos secretos ao cliente.
CREATE POLICY "public_read_own_state"
  ON public.magazine_reader_state
  FOR SELECT
  TO anon, authenticated
  USING (true);   -- ver comentário acima; identificação por chave composta

CREATE POLICY "public_upsert_own_state"
  ON public.magazine_reader_state
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    magazine_token IS NOT NULL
    AND viewer_fingerprint IS NOT NULL
    AND cardinality(bookmarks) <= 500   -- anti-abuse: máx 500 marcadores/device
    AND last_page_index >= 0
    AND last_page_index < 10000
  );

CREATE POLICY "public_update_own_state"
  ON public.magazine_reader_state
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (
    cardinality(bookmarks) <= 500
    AND last_page_index >= 0
    AND last_page_index < 10000
  );

-- Trigger de updated_at
CREATE OR REPLACE FUNCTION public.tg_magazine_reader_state_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.tg_magazine_reader_state_touch() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER magazine_reader_state_touch
  BEFORE UPDATE ON public.magazine_reader_state
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_magazine_reader_state_touch();

-- Rate-limit de writes (opcional — 1 write/segundo por fingerprint)
-- Delegado ao edge function `magazine-reader-state-write` (a criar em PR separado),
-- já que a app do Lovable Cloud não expõe pg-native rate-limit RPC.

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- DROP TRIGGER magazine_reader_state_touch ON public.magazine_reader_state;
-- DROP FUNCTION public.tg_magazine_reader_state_touch();
-- DROP TABLE public.magazine_reader_state;

-- ============================================================================
-- CHECKLIST DE APROVAÇÃO (PO)
-- ============================================================================
-- [ ] BD Gold externo (doufsxqlfjyuvxuezpln) tem espaço para +1 tabela?
-- [ ] Fingerprint por localStorage é aceitável (não requer login) para o PO?
-- [ ] Rate-limit 1 write/segundo via edge function é suficiente?
-- [ ] cardinality(bookmarks) <= 500 é razoável ou aumentar/diminuir?
-- [ ] Manter compatibilidade localStorage-first por N semanas antes de remover?
