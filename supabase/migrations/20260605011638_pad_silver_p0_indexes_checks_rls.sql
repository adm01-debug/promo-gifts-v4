-- (3) FK raw_id sem índice -> cria índice
CREATE INDEX IF NOT EXISTS idx_pad_raw ON public.produtos_padronizacao(raw_id);

-- (2) Invariante do fluxo medallion: promoted exige product_id
ALTER TABLE public.produtos_padronizacao
  ADD CONSTRAINT chk_promoted_requires_gold
  CHECK (status <> 'promoted' OR product_id IS NOT NULL);

-- (6) supplier_reference nunca em branco (parte da chave natural)
ALTER TABLE public.produtos_padronizacao
  ADD CONSTRAINT chk_supplier_reference_not_blank
  CHECK (btrim(supplier_reference) <> '');

-- (6) is_active deixa de aceitar NULL
ALTER TABLE public.produtos_padronizacao ALTER COLUMN is_active SET DEFAULT true;
UPDATE public.produtos_padronizacao SET is_active = true WHERE is_active IS NULL;
ALTER TABLE public.produtos_padronizacao ALTER COLUMN is_active SET NOT NULL;

-- (1) RLS + fechar anon (escrita destrutiva pública)
ALTER TABLE public.produtos_padronizacao ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.produtos_padronizacao FROM anon;
DROP POLICY IF EXISTS pad_authenticated_all ON public.produtos_padronizacao;
CREATE POLICY pad_authenticated_all ON public.produtos_padronizacao
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- service_role ignora RLS (pipeline N8N permanece intacto)