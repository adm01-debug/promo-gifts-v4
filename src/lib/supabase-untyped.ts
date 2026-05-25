/**
 * Typed wrapper for Supabase tables not yet in the generated schema.
 * Eliminates `as any` casts at call sites while maintaining type safety.
 *
 * Usage:
 *   const { data } = await untypedFrom<MyType>("my_table").select("*").eq("id", id);
 *   //              data is MyType[] (from generic), not never[]
 *
 * Strategy:
 *   The Supabase generated types narrow `from()` to known table names — any
 *   other string falls back to `audit_logs` row shape, which causes TS2339
 *   floods on every property access. Casting `supabase` itself to a
 *   permissive `SupabaseClient<any>` restores the unrestricted builder so
 *   the row-shape generic `T` flows through `select()/insert()/update()`.
 *
 * MIGRATION NOTE (post-colapso 2026-05-24):
 *   The 5 tables previously listed in UntypedTable below now exist in the
 *   database (PRs #315 and #317). Once `supabase gen types typescript` is
 *   re-run and types.ts updated, the remaining `untypedFrom("...")` call
 *   sites in src/ should migrate to `supabase.from("...")` for full type
 *   safety. This file stays as a safety net for future tables that haven't
 *   landed in the generated schema yet.
 *
 *   CI guard: `.github/workflows/lint-untyped-from.yml` fails the build if
 *   any `untypedFrom("X")` call references a table NOT in types.ts —
 *   which is the precise condition that caused a 2026-05-24 silent
 *   failures (tables missing from the database).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- needed for permissive SupabaseClient cast (see file header)
type AnyClient = SupabaseClient<any, any, any>;

/**
 * Access a Supabase table that doesn't exist in the generated types.
 *
 * Pass the row shape as `T` to recover full typing on `.select()`,
 * `.insert()`, `.update()` — otherwise falls back to a permissive
 * `Record<string, unknown>` that is still safer than `any`.
 */
export function untypedFrom<T = Record<string, unknown>>(table: string) {
  return (supabase as unknown as AnyClient).from(table) as ReturnType<AnyClient['from']> & {
    _row?: T;
  };
}

/**
 * Known untyped table names for documentation.
 *
 * All entries here should also exist in the database (validated by CI).
 * When a name is added here OR a new `untypedFrom("X")` call is added in
 * src/, the lint job will fail unless X also appears in
 * src/integrations/supabase/types.ts (i.e. the schema was regenerated).
 *
 * Empty since the 2026-05-24 cleanup — the 5 previous entries now exist
 * in the database and should be migrated to `supabase.from()` once
 * types.ts is regenerated.
 */
export type UntypedTable = never;
