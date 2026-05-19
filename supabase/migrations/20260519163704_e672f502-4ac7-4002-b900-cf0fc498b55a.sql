-- Add missing columns to products table if they don't exist
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_id UUID;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_name TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS subcategory TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS supplier_id UUID;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS supplier_name TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock INTEGER;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock_status TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_kit BOOLEAN DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS new_arrival BOOLEAN DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS on_sale BOOLEAN DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS colors JSONB DEFAULT '[]';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS materials TEXT[] DEFAULT '{}';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '{}';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS kit_items JSONB DEFAULT '[]';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS variations JSONB DEFAULT '[]';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS synced_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_external_id ON public.products(external_id);

-- Also fix product_sync_logs missing columns
ALTER TABLE public.product_sync_logs ADD COLUMN IF NOT EXISTS products_received INTEGER DEFAULT 0;
ALTER TABLE public.product_sync_logs ADD COLUMN IF NOT EXISTS products_created INTEGER DEFAULT 0;
ALTER TABLE public.product_sync_logs ADD COLUMN IF NOT EXISTS products_updated INTEGER DEFAULT 0;
ALTER TABLE public.product_sync_logs ADD COLUMN IF NOT EXISTS products_failed INTEGER DEFAULT 0;
ALTER TABLE public.product_sync_logs ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE public.product_sync_logs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
