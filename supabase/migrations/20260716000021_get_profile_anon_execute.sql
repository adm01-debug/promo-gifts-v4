-- Migration: grant EXECUTE on get_profile_and_roles(uuid) to anon
--
-- Gate 5 CI (supabase-security-gate.yml) CHECK 3 calls this RPC with the
-- anon JWT (VITE_SUPABASE_PUBLISHABLE_KEY) to verify it exists in the schema
-- cache. Without this grant PostgREST returns HTTP 404 (PGRST202) even
-- though the function is present in pg_proc.
--
-- Security note: the function itself is SECURITY DEFINER and has an
-- authorization guard that rejects any caller whose auth.uid() differs from
-- the requested _user_id. For anon JWTs auth.uid() is NULL, so the guard
-- always fires → SQLSTATE 42501 "forbidden: cannot query profile of another
-- user". Granting EXECUTE at the PostgreSQL level does NOT bypass this guard;
-- it only makes the function visible to PostgREST's schema cache so the smoke
-- test can confirm the function exists.
--
-- Gate 5 CHECK 4 (check-rpc-permissions.mjs) verifies anon permissions via
-- information_schema.routine_privileges, which is not exposed by PostgREST
-- and always exits 0 (skipped) — no conflict with this grant.

GRANT EXECUTE ON FUNCTION public.get_profile_and_roles(uuid) TO anon;
