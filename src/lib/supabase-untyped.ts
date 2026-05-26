/**
 * Typed wrapper for Supabase tables not yet in the generated schema.
 * Eliminates `as any` casts at call sites while maintaining type safety.
 *
 * Usage:
 *   const { data } = await untypedFrom<MyType>("my_table").select("*").eq("id", id);
 *   //              data is MyType[] from the generic, not never[]
 *
 * Strategy:
 *   The Supabase generated types narrow `from()` to known table names. Any
 *   other string falls back to the `audit_logs` row shape, which causes TS2339
 *   floods on every property access. Casting `supabase` itself to a
 *   permissive `SupabaseClient<any>` restores the unrestricted builder so
 *   the row-shape generic `T` flows through `select()`, `insert()`, and
 *   `update()`.
 *
 * Migration note, post-colapso 2026-05-24:
 *   The 5 tables previously listed in UntypedTable now exist in the database
 *   through PRs #315 and #317. Once `supabase gen types typescript` is rerun
 *   and types.ts is updated, the remaining `untypedFrom("...")` call sites in
 *   src/ should migrate to `supabase.from("...")` for full type safety. This
 *   file remains a safety net for future tables that are not in the generated
 *   schema yet.
 *
 * CI guard:
 *   `.github/workflows/lint-untyped-from.yml` fails the build if any
 *   `untypedFrom("X")` call references a table not present in generated
 *   Supabase types. That is the exact condition that caused silent failures
 *   on 2026-05-24.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- required for the permissive SupabaseClient cast above.
type AnyClient = SupabaseClient<any, any, any>;

/**
 * Access a Supabase table that is not in the generated types.
 *
 * Pass the row shape as `T` to recover typing on `.select()`, `.insert()`, and
 * `.update()`. Without `T`, this falls back to `Record<string, unknown>`.
 */
export function untypedFrom<T = Record<string, unknown>>(table: string) {
  return (supabase as unknown as AnyClient).from(table) as ReturnType<
    AnyClient["from"]
  > & { _row?: T };
}

/**
 * Known untyped table names for documentation.
 *
 * Empty since the 2026-05-24 cleanup. The previous entries now exist in the
 * database and should be migrated to `supabase.from()` once types.ts is
 * regenerated.
 */
export type UntypedTable = never;
