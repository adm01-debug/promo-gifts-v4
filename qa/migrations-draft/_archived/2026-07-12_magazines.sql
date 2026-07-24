-- ============================================================================
-- Draft Migration — Módulo Magazine (revistas de produtos)
-- Alvo: BD canônico Gold `doufsxqlfjyuvxuezpln` (Supabase Gestão de Produtos).
-- NÃO rodar no Lovable Cloud interno (pqpdolkaeqlyzpdpbizo) — proibido por
-- política do projeto (ver CLAUDE.md e project-knowledge).
--
-- Este arquivo é APENAS um rascunho para revisão do PO. Nada será aplicado
-- até aprovação explícita.
--
-- Contém:
--   • magazines           — rascunho/publicação da revista
--   • magazine_items      — 1 linha por produto (posição, variante, overrides)
--   • magazine_templates  — templates reutilizáveis por usuário/organização
--
-- Ordem obrigatória (SSOT do projeto):
--   1) CREATE TABLE
--   2) GRANT (nunca pular)
--   3) ENABLE RLS
--   4) CREATE POLICY
-- ============================================================================

-- 1) TABELAS -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.magazines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NULL,
  title TEXT NOT NULL DEFAULT 'Nova Revista',
  subtitle TEXT NOT NULL DEFAULT '',
  template_id TEXT NOT NULL DEFAULT 'editorial-vogue',
  client_name TEXT NULL,
  client_logo_url TEXT NULL,
  client_crm_id TEXT NULL,
  client_brand_colors JSONB NOT NULL DEFAULT '{"primary":"#0f172a","secondary":"#f97316","text":"#0f172a"}'::jsonb,
  content_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  page_order JSONB NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  public_token TEXT NULL UNIQUE,
  pdf_url TEXT NULL,
  pdf_signature TEXT NULL,
  published_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.magazine_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  magazine_id UUID NOT NULL REFERENCES public.magazines(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  variant_id UUID NULL,
  variant_color_name TEXT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  page_number INTEGER NULL,
  product_snapshot JSONB NOT NULL,
  overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.magazine_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NULL,
  name TEXT NOT NULL,
  template_id TEXT NOT NULL,
  content_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  branding JSONB NOT NULL DEFAULT '{}'::jsonb,
  shared_in_org BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_magazines_owner ON public.magazines(owner_id);
CREATE INDEX IF NOT EXISTS idx_magazines_org   ON public.magazines(organization_id);
CREATE INDEX IF NOT EXISTS idx_magazines_token ON public.magazines(public_token) WHERE public_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_magazine_items_mag_pos ON public.magazine_items(magazine_id, position);
CREATE INDEX IF NOT EXISTS idx_magazine_templates_owner ON public.magazine_templates(owner_id);
CREATE INDEX IF NOT EXISTS idx_magazine_templates_org   ON public.magazine_templates(organization_id);

-- Trigger updated_at (reutiliza public.update_updated_at_column() se existir)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column' AND pronamespace = 'public'::regnamespace) THEN
    CREATE OR REPLACE FUNCTION public.update_updated_at_column()
    RETURNS TRIGGER AS $trg$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $trg$ LANGUAGE plpgsql SET search_path = public;
  END IF;
END $$;

CREATE TRIGGER trg_magazines_updated_at BEFORE UPDATE ON public.magazines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_magazine_items_updated_at BEFORE UPDATE ON public.magazine_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_magazine_templates_updated_at BEFORE UPDATE ON public.magazine_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) GRANTS ------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.magazines           TO authenticated;
GRANT ALL                              ON public.magazines           TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.magazine_items      TO authenticated;
GRANT ALL                              ON public.magazine_items      TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.magazine_templates  TO authenticated;
GRANT ALL                              ON public.magazine_templates  TO service_role;
-- Sem grants para anon — leitura pública somente via edge function que valida token.

-- 3) RLS ---------------------------------------------------------------------
ALTER TABLE public.magazines          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.magazine_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.magazine_templates ENABLE ROW LEVEL SECURITY;

-- 4) POLICIES ----------------------------------------------------------------
-- magazines: dono + membros da mesma org (via organization_members se existir).
CREATE POLICY magazines_owner_all ON public.magazines
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Leitura por membros da mesma organização (padrão do projeto):
CREATE POLICY magazines_org_read ON public.magazines
  FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = public.magazines.organization_id
        AND om.user_id = auth.uid()
    )
  );

-- magazine_items: acesso derivado do dono/membro da revista pai.
CREATE POLICY magazine_items_via_magazine ON public.magazine_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.magazines m
      WHERE m.id = magazine_items.magazine_id
        AND (
          m.owner_id = auth.uid()
          OR (
            m.organization_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM public.organization_members om
              WHERE om.organization_id = m.organization_id
                AND om.user_id = auth.uid()
            )
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.magazines m
      WHERE m.id = magazine_items.magazine_id AND m.owner_id = auth.uid()
    )
  );

-- magazine_templates: dono + leitura em org quando shared_in_org=true.
CREATE POLICY magazine_templates_owner_all ON public.magazine_templates
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY magazine_templates_org_read ON public.magazine_templates
  FOR SELECT TO authenticated
  USING (
    shared_in_org = true
    AND organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = public.magazine_templates.organization_id
        AND om.user_id = auth.uid()
    )
  );

-- NOTA: leitura pública (rota /revista-publica/:token) NÃO é feita direto no
-- cliente. Deverá ser servida por edge function `magazine-public-view` (a ser
-- criada em supabase/functions/magazine-public-view/index.ts) que valida
-- `public_token`, aplica rate-limit por IP e retorna somente campos safe.
