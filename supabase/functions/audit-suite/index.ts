import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { buildPublicCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { createStructuredLogger } from '../_shared/structured-logger.ts';
import { getOrCreateRequestId } from '../_shared/request-id.ts';

const getCorsHeaders = () => buildPublicCorsHeaders();

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
  logs: string[];
}

async function signInClient(email: string, password: string): Promise<SupabaseClient> {
  const c = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signIn(${email}): ${error.message}`);
  return c;
}

Deno.serve(async (req) => {
  const __reqId = getOrCreateRequestId(req);
  const log = createStructuredLogger({ fn: 'audit-suite', requestId: __reqId, req });
  log.info('request_start');
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const results: TestResult[] = [];
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const tag = `audit-${Date.now().toString(36)}`;
    const seller1Email = `${tag}-s1@audit.local`;
    const seller2Email = `${tag}-s2@audit.local`;
    const password = "AuditPassword123!";

    // 1. Setup Users
    const createS1 = await admin.auth.admin.createUser({ email: seller1Email, password, email_confirm: true });
    const createS2 = await admin.auth.admin.createUser({ email: seller2Email, password, email_confirm: true });
    
    if (createS1.error || createS2.error) throw new Error("Failed to create test users: " + (createS1.error?.message || createS2.error?.message));
    
    const s1Id = createS1.data.user!.id;
    const s2Id = createS2.data.user!.id;

    await admin.from("user_roles").insert([
      { user_id: s1Id, role: "user" },
      { user_id: s2Id, role: "user" }
    ]);

    const s1Client = await signInClient(seller1Email, password);
    const s2Client = await signInClient(seller2Email, password);

    // TEST 1: Max 3 Carts Constraint
    const test1: TestResult = { name: "Limit 3 Carts", passed: false, details: "", logs: [] };
    try {
      const carts = [];
      for (let i = 0; i < 4; i++) {
        const { data, error } = await s1Client.from("seller_carts").insert({ company_id: `audit-co-${i}`, company_name: `Cart ${i}`, seller_id: s1Id }).select().single();
        if (error) {
          test1.logs.push(`Attempt ${i+1} failed: ${error.message}`);
        } else {
          carts.push(data);
          test1.logs.push(`Attempt ${i+1} succeeded`);
        }
      }
      test1.passed = carts.length === 3;
      test1.details = test1.passed ? "Successfully blocked 4th cart" : `Allowed ${carts.length} carts`;
    } catch (e) {
      test1.details = (e as Error).message;
    }
    results.push(test1);

    // TEST 2: RLS Isolation (No Cross-Access)
    const test2: TestResult = { name: "RLS Isolation", passed: false, details: "", logs: [] };
    try {
      const { data: s1Cart } = await s1Client.from("seller_carts").select("id").limit(1).single();
      const { data: s2Cart } = await s2Client.from("seller_carts").insert({ company_id: "audit-co-s2", company_name: "S2 Cart", seller_id: s2Id }).select().single();
      
      // S1 tries to read S2 cart
      const { data: readOther, error: readError } = await s1Client.from("seller_carts").select("*").eq("id", s2Cart.id).maybeSingle();
      test2.logs.push(`S1 read S2 cart: ${readOther ? "Success (FAIL)" : "Empty (PASS)"}`);
      
      // S1 tries to update S2 cart
      const { error: updateError } = await s1Client.from("seller_carts").update({ company_name: "Hacked" }).eq("id", s2Cart.id);
      test2.logs.push(`S1 update S2 cart: ${updateError ? "Error (PASS)" : "Success (FAIL)"}`);

      test2.passed = !readOther && !!updateError;
      test2.details = test2.passed ? "Strict isolation verified" : "Leakage detected";
    } catch (e) {
      test2.details = (e as Error).message;
    }
    results.push(test2);

    // TEST 3: Concurrency / Unique NULLS NOT DISTINCT
    const test3: TestResult = { name: "Concurrency & Uniqueness", passed: false, details: "", logs: [] };
    try {
      const { data: cart } = await s1Client.from("seller_carts").select("id").limit(1).single();
      // Simulate 50 simultaneous additions of the same product
      const productId = crypto.randomUUID(); 
      const promises = Array.from({ length: 50 }).map(() => 
        s1Client.from("seller_cart_items").insert({ cart_id: cart.id, product_id: productId, product_name: "Audit Product", quantity: 1 })
      );
      const res = await Promise.all(promises);
      const success = res.filter(r => !r.error).length;
      const { count } = await admin.from("seller_cart_items").select("*", { count: 'exact', head: true }).eq("cart_id", cart.id).eq("product_id", productId);
      
      test3.logs.push(`Total successful inserts: ${success}`);
      test3.logs.push(`Final count in DB: ${count}`);
      test3.passed = count === 1;
      test3.details = test3.passed ? "Uniqueness preserved under load" : `Duplicate items found: ${count}`;
    } catch (e) {
      test3.details = (e as Error).message;
    }
    results.push(test3);

    // Cleanup
    await admin.auth.admin.deleteUser(s1Id);
    await admin.auth.admin.deleteUser(s2Id);

    return new Response(JSON.stringify({
      status: results.every(r => r.passed) ? "PASSED" : "FAILED",
      timestamp: new Date().toISOString(),
      results
    }), { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { 
      status: 500, 
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } 
    });
  }
});
