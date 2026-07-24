-- Vincula usuarios orfaos a uma organizacao existente (sem UUID hardcoded)
-- Idempotente e seguro para ambientes com seeds diferentes

INSERT INTO public.user_organizations (user_id, organization_id, role)
SELECT
  u.id,
  o.id,
  (CASE WHEN u.email = 'cad01@promobrindes.com.br' THEN 'admin' ELSE 'member' END)::org_role
FROM auth.users u
CROSS JOIN LATERAL (
  SELECT id
  FROM public.organizations
  ORDER BY id ASC
  LIMIT 1
) o
WHERE NOT EXISTS (
  SELECT 1
  FROM public.user_organizations uo
  WHERE uo.user_id = u.id
);
