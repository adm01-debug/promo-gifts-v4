-- Restaura as colunas de geometria e layout em generated_mockups.
-- Estas colunas já são declaradas pelas migrações 20251215011449 (position_x/y,
-- logo_width_cm/height_cm) e 20260301135215 (layout_url) presentes no repositório,
-- mas nunca chegaram ao banco vivo (divergência pós-colapso 2026-05-24).
-- Aditivo e idempotente: sem impacto em dados existentes.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='generated_mockups' AND column_name='position_x') THEN
    ALTER TABLE public.generated_mockups ADD COLUMN position_x INTEGER DEFAULT 50;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='generated_mockups' AND column_name='position_y') THEN
    ALTER TABLE public.generated_mockups ADD COLUMN position_y INTEGER DEFAULT 50;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='generated_mockups' AND column_name='logo_width_cm') THEN
    ALTER TABLE public.generated_mockups ADD COLUMN logo_width_cm NUMERIC DEFAULT 5;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='generated_mockups' AND column_name='logo_height_cm') THEN
    ALTER TABLE public.generated_mockups ADD COLUMN logo_height_cm NUMERIC DEFAULT 3;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='generated_mockups' AND column_name='layout_url') THEN
    ALTER TABLE public.generated_mockups ADD COLUMN layout_url TEXT;
  END IF;
END $$;
