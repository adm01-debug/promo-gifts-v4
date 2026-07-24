-- Aplicada via Supabase dashboard em 2026-05-25 19:32 UTC
-- Recuperada do schema_migrations para sincronizar o repo
-- ============================================================
-- MIGRATION: sync user_organizations → organization_members
-- ============================================================

-- Replay-safe: em preview-branches a coluna user_organizations.updated_at pode
-- ainda não existir neste ponto da sequência (drift de ordem de aplicação) → 42703.
-- O backfill só roda quando a coluna existe (em prod ela existe → roda normal); no
-- preview, organization_members já vem populado do clone, então é no-op de qualquer
-- forma. O IF EXISTS só planeja o INSERT quando o ramo é tomado (evita o 42703).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_organizations' AND column_name = 'updated_at'
  ) THEN
    INSERT INTO public.organization_members (organization_id, user_id, role, joined_at, created_at, updated_at)
    SELECT uo.organization_id, uo.user_id, uo.role, uo.created_at AS joined_at, uo.created_at, uo.updated_at
    FROM public.user_organizations uo
    WHERE NOT EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = uo.organization_id AND om.user_id = uo.user_id
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sync_user_org_to_org_members()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.organization_members (organization_id, user_id, role, joined_at, created_at, updated_at)
    VALUES (NEW.organization_id, NEW.user_id, NEW.role, NEW.created_at, NEW.created_at, NEW.updated_at)
    ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role, updated_at = EXCLUDED.updated_at;
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    UPDATE public.organization_members SET role = NEW.role, updated_at = NEW.updated_at
    WHERE organization_id = NEW.organization_id AND user_id = NEW.user_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    DELETE FROM public.organization_members WHERE organization_id = OLD.organization_id AND user_id = OLD.user_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_user_org_to_org_members ON public.user_organizations;
CREATE TRIGGER trg_sync_user_org_to_org_members
  AFTER INSERT OR UPDATE OR DELETE ON public.user_organizations
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_org_to_org_members();
