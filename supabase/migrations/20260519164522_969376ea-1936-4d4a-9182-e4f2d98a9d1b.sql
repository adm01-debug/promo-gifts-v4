-- Garantir que as colunas essenciais existam para o webhook de sincronização
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_id UUID;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_name TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS supplier_name TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS colors JSONB DEFAULT '[]';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Criar índices para busca rápida por SKU e ID externo
CREATE INDEX IF NOT EXISTS idx_products_sku_sync ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_ext_id_sync ON public.products(external_id);

-- Atualizar logs de sincronização para suportar métricas detalhadas
ALTER TABLE public.product_sync_logs ADD COLUMN IF NOT EXISTS products_received INTEGER DEFAULT 0;
ALTER TABLE public.product_sync_logs ADD COLUMN IF NOT EXISTS products_updated INTEGER DEFAULT 0;
ALTER TABLE public.product_sync_logs ADD COLUMN IF NOT EXISTS error_message TEXT;
