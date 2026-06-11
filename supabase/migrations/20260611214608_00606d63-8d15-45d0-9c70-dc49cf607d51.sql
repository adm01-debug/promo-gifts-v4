-- 1. Atualizar can_view_all_sales para permitir acesso a todos os usuários autenticados
-- Isso libera a leitura de orders/order_items para o BI
CREATE OR REPLACE FUNCTION public.can_view_all_sales(_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Agora qualquer usuário autenticado pode ver (vendedor, etc)
  -- para que o BI e Tendências funcionem corretamente para todos.
  SELECT _user_id IS NOT NULL;
$function$;

-- 2. Atualizar políticas de product_views
-- Remover política restritiva anterior
DROP POLICY IF EXISTS "Admins can read all views" ON public.product_views;
DROP POLICY IF EXISTS "Users can view own views" ON public.product_views;

-- Criar política unificada de leitura para todos os autenticados
CREATE POLICY "Authenticated users can read all product views"
  ON public.product_views
  FOR SELECT
  TO authenticated
  USING (true);

-- 3. Garantir que search_history (se existir) também seja legível
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'search_history') THEN
        DROP POLICY IF EXISTS "Users can view own searches" ON public.search_history;
        CREATE POLICY "Authenticated users can read all search history"
          ON public.search_history
          FOR SELECT
          TO authenticated
          USING (true);
    END IF;
END $$;
