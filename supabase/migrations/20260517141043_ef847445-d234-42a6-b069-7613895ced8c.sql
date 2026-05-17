CREATE TABLE IF NOT EXISTS public.password_reset_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES auth.users(id),
    reviewer_notes TEXT,
    user_id UUID REFERENCES auth.users(id)
);

-- Habilitar RLS
ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

-- Política para inserção (pública - tela de login)
CREATE POLICY "Anyone can request a password reset" 
ON public.password_reset_requests 
FOR INSERT 
WITH CHECK (true);

-- Política para visualização (apenas admins/supervisores)
CREATE POLICY "Admins can view password reset requests" 
ON public.password_reset_requests 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_roles.user_id = auth.uid() 
        AND user_roles.role IN ('dev', 'supervisor', 'admin')
    )
);

-- Política para atualização (apenas admins/supervisores)
CREATE POLICY "Admins can update password reset requests" 
ON public.password_reset_requests 
FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_roles.user_id = auth.uid() 
        AND user_roles.role IN ('dev', 'supervisor', 'admin')
    )
);

-- Index para performance
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_status ON public.password_reset_requests(status);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_email ON public.password_reset_requests(email);
