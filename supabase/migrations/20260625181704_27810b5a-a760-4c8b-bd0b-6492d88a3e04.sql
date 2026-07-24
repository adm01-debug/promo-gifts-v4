DO $$
BEGIN
  -- Reativa realtime para discount_approval_requests (vendedor recebe approved/rejected
  -- imediatamente no widget; RLS dar_select_scope filtra por seller_id = auth.uid()).
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'discount_approval_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.discount_approval_requests;
  END IF;
END $$;

-- REPLICA IDENTITY FULL para que o payload do UPDATE inclua a row completa
-- (necessário para o cliente filtrar/atualizar cache react-query corretamente).
ALTER TABLE public.discount_approval_requests REPLICA IDENTITY FULL;