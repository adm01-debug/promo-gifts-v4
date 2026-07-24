/**
 * RLS Policy Validation Tests for 10 Critical Tables
 * 
 * Validates RLS is enabled and policies are correctly structured
 * by inspecting pg_policy with pg_get_expr() for readable SQL.
 */
import { assertEquals, assert } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const DB_URL = Deno.env.get("SUPABASE_DB_URL") ?? "";
const pool = new Pool(DB_URL, 2, true);

interface PolicyRow {
  polname: string;
  cmd: string;
  qual: string | null;
  with_check: string | null;
}

async function getPolicies(table: string): Promise<PolicyRow[]> {
  const c = await pool.connect();
  try {
    const r = await c.queryObject<PolicyRow>(`
      SELECT polname,
        CASE polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT' WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE' WHEN '*' THEN 'ALL' END as cmd,
        pg_get_expr(polqual, polrelid) as qual,
        pg_get_expr(polwithcheck, polrelid) as with_check
      FROM pg_policy WHERE polrelid = ('public.' || '${table}')::regclass ORDER BY polname
    `);
    return r.rows;
  } finally { c.release(); }
}

async function isRlsEnabled(table: string): Promise<boolean> {
  const c = await pool.connect();
  try {
    const r = await c.queryObject<{ relrowsecurity: boolean }>(`
      SELECT relrowsecurity FROM pg_class WHERE oid = ('public.' || '${table}')::regclass
    `);
    return r.rows[0]?.relrowsecurity ?? false;
  } finally { c.release(); }
}

/** Check if any policy (SELECT or ALL) contains a substring */
function hasReadPolicy(policies: PolicyRow[], substring: string): boolean {
  return policies.some(p => (p.cmd === 'SELECT' || p.cmd === 'ALL') && p.qual?.includes(substring));
}

// ============================================
// CROSS: RLS enabled on ALL critical tables
// ============================================
Deno.test({ name: "CROSS: all 9 critical tables have RLS enabled", fn: async () => {
  for (const t of ["profiles","user_roles","quotes","orders","order_items","organizations","organization_members","admin_audit_log","quote_items"]) {
    assertEquals(await isRlsEnabled(t), true, `RLS must be enabled on ${t}`);
  }
}});

// 1. PROFILES
Deno.test({ name: "1. profiles: view-own + admin-read + update-own", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const p = await getPolicies("profiles");
  assert(p.length >= 3, `Expected >= 3 policies, got ${p.length}`);
  assert(p.some(x => (x.cmd==='SELECT'||x.cmd==='ALL') && x.qual?.includes("auth.uid()") && x.qual?.includes("user_id")), "Need self-scoped SELECT");
  assert(p.some(x => (x.cmd==='SELECT'||x.cmd==='ALL') && (x.qual?.includes("has_role") || x.qual?.includes("is_admin"))), "Need admin SELECT via has_role() or is_admin()");
  assert(p.some(x => (x.cmd==='UPDATE'||x.cmd==='ALL') && x.qual?.includes("auth.uid()")), "Need UPDATE with auth.uid()");
}});

// 2. USER_ROLES
Deno.test({ name: "2. user_roles: admin-only management + own-role read", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const p = await getPolicies("user_roles");
  assert(p.length >= 2, `Expected >= 2 policies, got ${p.length}`);
  
  // Admin management policy must exist
  assert(p.some(x => (x.qual?.includes("has_role") || x.qual?.includes("is_admin")) && (x.qual?.includes("admin") || x.qual?.includes("dev"))), "Must have admin management policy");
  
  // Self-read must be scoped to own user_id only
  const selfRead = p.find(x => x.cmd === 'SELECT' && x.qual?.includes("auth.uid()") && !x.qual?.includes("has_role"));
  if (selfRead) {
    assert(selfRead.qual?.includes("user_id"), "Self-read must be scoped to user_id = auth.uid()");
  }
  
  // No open 'true' policy
  assert(!p.some(x => x.qual === 'true'), "Must NOT have open 'true' policy");
}});

// 3. ORGANIZATIONS
Deno.test({ name: "3. organizations: member-scoped via get_user_org_ids", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const p = await getPolicies("organizations");
  assert(p.length >= 2, `Expected >= 2 policies, got ${p.length}`);
  assert(hasReadPolicy(p, "get_user_org_ids"), "SELECT must use get_user_org_ids");
  assertEquals(p.find(x => x.cmd === 'DELETE'), undefined, "No DELETE on organizations");
}});

// 4. ORGANIZATION_MEMBERS
Deno.test({ name: "4. organization_members: owner-only write, member read", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const p = await getPolicies("organization_members");
  const insertP = p.find(x => x.cmd === 'INSERT');
  assert(insertP, "Must have INSERT policy");
  assert(`${insertP!.qual??''} ${insertP!.with_check??''}`.includes("owner"), "INSERT needs owner");
  const updateP = p.find(x => x.cmd === 'UPDATE');
  assert(updateP, "Must have UPDATE policy");
  assert(updateP!.qual?.includes("owner"), "UPDATE needs owner");
}});

// 5. QUOTES
Deno.test({ name: "5. quotes: seller_id + org isolation + admin bypass", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const p = await getPolicies("quotes");
  assert(p.length >= 2, `Expected >= 2 policies, got ${p.length}`);
  
  // Must have seller-scoped policy (can be SELECT or ALL)
  assert(hasReadPolicy(p, "seller_id"), "Must have seller_id check in read policy");
  assert(hasReadPolicy(p, "get_user_org_ids"), "Must enforce org isolation via get_user_org_ids");
  
  // Admin/manager bypass
  const allText = p.map(x => x.qual ?? '').join(' ');
  assert(allText.includes("has_role") || allText.includes("is_admin") || allText.includes("is_manager_or_admin"), "Must include admin/manager bypass");
}});

// 6. ORDERS
Deno.test({ name: "6. orders: seller_id + org isolation enforced", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const p = await getPolicies("orders");
  assert(p.length >= 2, `Expected >= 2 policies, got ${p.length}`);
  assert(hasReadPolicy(p, "seller_id"), "Must have seller_id in read policy");
  assert(hasReadPolicy(p, "get_user_org_ids"), "Must enforce org isolation");
}});

// 7. ORDER_ITEMS
Deno.test({ name: "7. order_items: org-scoped + seller ownership for writes", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const p = await getPolicies("order_items");
  assert(p.length >= 2, `Expected >= 2 policies, got ${p.length}`);
  assert(hasReadPolicy(p, "get_user_org_ids"), "SELECT must be org-scoped");
  // Write policies must check seller ownership via orders join
  const writePolicies = p.filter(x => x.cmd === 'INSERT' || x.cmd === 'UPDATE' || x.cmd === 'DELETE');
  for (const pol of writePolicies) {
    const expr = `${pol.qual ?? ''} ${pol.with_check ?? ''}`;
    assert(expr.includes("orders") && expr.includes("seller_id"), `"${pol.polname}" must verify seller ownership via orders`);
  }
}});

// 8. QUOTE_ITEMS
Deno.test({ name: "8. quote_items: access via quote ownership", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const p = await getPolicies("quote_items");
  assert(p.length >= 1);
  assert(hasReadPolicy(p, "quotes") || hasReadPolicy(p, "seller_id"), "Must verify via quote ownership");
}});


// 10. ADMIN_AUDIT_LOG
Deno.test({ name: "10. admin_audit_log: admin-only, no update/delete", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const p = await getPolicies("admin_audit_log");
  assert(p.length >= 2);
  for (const pol of p) {
    const expr = `${pol.qual??''} ${pol.with_check??''}`;
    assert((expr.includes("has_role") || expr.includes("is_admin")) && (expr.includes("admin") || expr.includes("dev")), `"${pol.polname}" must require admin`);
  }
  assertEquals(p.some(x => x.cmd==='UPDATE' || x.cmd==='DELETE'), false, "No UPDATE/DELETE on audit logs");
}});

// CROSS: No open policies
Deno.test({ name: "CROSS: no open 'true' policies on sensitive tables", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  for (const t of ["profiles","user_roles","quotes","orders","admin_audit_log"]) {
    const p = await getPolicies(t);
    assert(!p.some(x => x.qual === 'true'), `${t} has dangerously open policy`);
  }
}});

Deno.test({ name: "CLEANUP", sanitizeOps: false, sanitizeResources: false, fn: async () => { await pool.end(); }});
