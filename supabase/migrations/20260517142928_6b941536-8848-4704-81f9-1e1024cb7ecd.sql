CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2),
    stock_quantity INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Política de visualização (todos os autenticados)
CREATE POLICY "Products are viewable by all authenticated users" 
ON public.products FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Política de inserção inicial para teste (pública temporária ou restrita)
CREATE POLICY "Allow initial sync insert" 
ON public.products FOR INSERT 
WITH CHECK (true);
