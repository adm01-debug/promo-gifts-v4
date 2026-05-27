CREATE TABLE public.system_error_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    function_name TEXT NOT NULL,
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    severity TEXT DEFAULT 'error',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Use GRANT to set permissions
GRANT INSERT ON public.system_error_logs TO authenticated;
GRANT SELECT ON public.system_error_logs TO authenticated;
GRANT ALL ON public.system_error_logs TO service_role;

-- Enable RLS
ALTER TABLE public.system_error_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can insert their own error logs" 
ON public.system_error_logs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can view their own error logs" 
ON public.system_error_logs 
FOR SELECT 
USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX idx_system_error_logs_user_id ON public.system_error_logs(user_id);
CREATE INDEX idx_system_error_logs_function_name ON public.system_error_logs(function_name);
CREATE INDEX idx_system_error_logs_created_at ON public.system_error_logs(created_at);