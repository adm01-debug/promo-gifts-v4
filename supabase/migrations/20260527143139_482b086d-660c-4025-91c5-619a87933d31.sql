-- 1. Atualizar o nome da única organização existente no banco para Promo Brindes
UPDATE public.organizations 
SET name = 'Promo Brindes', slug = 'promo-brindes'
WHERE id = '35c6a2a6-5d6d-4ddb-8dbd-8e842a0118e5';

-- 2. Criar função para atribuição automática de organização
-- Isso garante que novos usuários sempre pertençam à Promo Brindes,
-- mantendo as políticas de RLS funcionando sem alterações manuais.
CREATE OR REPLACE FUNCTION public.auto_assign_user_to_promo_brindes()
RETURNS TRIGGER AS $$
BEGIN
  -- Guard: em preview snapshots sem a organização Promo Brindes, viramos no-op
  -- para evitar FK violation em todo INSERT em profiles.
  IF EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = '35c6a2a6-5d6d-4ddb-8dbd-8e842a0118e5'
  ) THEN
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES ('35c6a2a6-5d6d-4ddb-8dbd-8e842a0118e5', NEW.user_id, 'member')
    ON CONFLICT (organization_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger na tabela profiles
-- Sempre que um perfil for criado, vinculamos o usuário à organização.
DROP TRIGGER IF EXISTS trg_auto_assign_promo_brindes ON public.profiles;
CREATE TRIGGER trg_auto_assign_promo_brindes
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_user_to_promo_brindes();

-- 4. Sincronizar perfis existentes que possam estar órfãos de organização
-- Guard: a organização 'Promo Brindes' pode não existir em preview snapshots
-- (organization criada manualmente em produção); evitamos FK violation.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = '35c6a2a6-5d6d-4ddb-8dbd-8e842a0118e5'
  ) THEN
    INSERT INTO public.organization_members (organization_id, user_id, role)
    SELECT '35c6a2a6-5d6d-4ddb-8dbd-8e842a0118e5', user_id, 'member'
    FROM public.profiles
    ON CONFLICT (organization_id, user_id) DO NOTHING;
  ELSE
    RAISE NOTICE 'Organização Promo Brindes não existe — sync de profiles pulado';
  END IF;
END $$;
