-- Vincula usuarios orfaos a organizacao Promo Brindes
-- Idempotente via NOT IN

INSERT INTO public.user_organizations (user_id, organization_id, role)
SELECT
  u.id,
  o.id,
  (CASE WHEN u.email = 'cad01@promobrindes.com.br' THEN 'admin' ELSE 'member' END)::org_role
FROM auth.users u
JOIN public.organizations o
  ON o.id = '5db5aee1-064b-4ef4-9193-345dcd8274ea'::uuid
WHERE u.id NOT IN (SELECT user_id FROM public.user_organizations);
