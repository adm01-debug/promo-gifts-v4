-- ============================================================================
-- Reconcile out-of-band enum types (clean migration replay)
-- ============================================================================
-- These enum types exist in production but are never created by any migration
-- (built out-of-band). The function reconciliation migration
-- (20260513000000) and other out-of-band objects reference some of them in
-- their signatures, so they must exist before that point on a fresh replay.
--
-- Guarded so this is a no-op when the type already exists (some, like
-- payment_status, are created earlier via dynamic SQL), and no later migration
-- creates them unguarded, so there is no conflict either way.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' AND t.typname = 'conversation_event_type') THEN
    CREATE TYPE public.conversation_event_type AS ENUM ('text','image','audio','video','file','system');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' AND t.typname = 'payment_status') THEN
    CREATE TYPE public.payment_status AS ENUM ('pending','authorized','captured','refunded','failed');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' AND t.typname = 'categoria_cor_enum') THEN
    CREATE TYPE public.categoria_cor_enum AS ENUM ('pantone','basica','institucional','especial','bordado','hot_stamping','serigrafia','sublimacao');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' AND t.typname = 'familia_cor_enum') THEN
    CREATE TYPE public.familia_cor_enum AS ENUM ('amarelo','laranja','vermelho','coral','rosa','magenta','roxo','lilas','azul','ciano','verde','marrom','bege','neutro','metalico');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' AND t.typname = 'tipo_cor_enum') THEN
    CREATE TYPE public.tipo_cor_enum AS ENUM ('solid','metalica','fluorescente','pastel','neon','especial');
  END IF;
END $$;
