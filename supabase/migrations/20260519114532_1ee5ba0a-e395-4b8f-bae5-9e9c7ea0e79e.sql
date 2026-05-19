CREATE OR REPLACE FUNCTION public.create_organization_with_owner(
  _name text,
  _slug text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_org_id uuid;
  current_user_id uuid;
BEGIN
  -- Get current user
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Insert organization
  INSERT INTO public.organizations (name, slug)
  VALUES (_name, _slug)
  RETURNING id INTO new_org_id;

  -- Insert owner membership
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org_id, current_user_id, 'owner');

  RETURN new_org_id;
END;
$$;