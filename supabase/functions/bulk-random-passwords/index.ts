// supabase/functions/bulk-random-passwords/index.ts
// BUG-EF-002 FIXED: Timing attack na comparacao do admin token.
// BUG-EF-010 FIXED: supabase-js@2.49.8 (futuro/typo) -> @2.49.4.
import { createStructuredLogger } from "../_shared/structured-logger.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { buildPublicCorsHeaders } from "../_shared/cors.ts";

type RunMode = "dry_run" | "apply";

interface BulkRequest {
  mode?: RunMode;
  length?: number;
  includeUpper?: boolean;
  includeLower?: boolean;
  includeDigits?: boolean;
  includeSymbols?: boolean;
  excludeEmails?: string[];
  onlyEmails?: string[];
  maxUsers?: number;
  pageSize?: number;
}

interface UpdatedUser {
  id: string;
  email: string | null;
}

const corsHeaders = buildPublicCorsHeaders({
  extraAllowHeaders: ["x-admin-token"],
  allowMethods: "POST, OPTIONS",
});

function pick(chars: string): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return chars[arr[0] % chars.length];
}

function shuffle(input: string): string {
  const a = input.split("");
  for (let i = a.length - 1; i > 0; i--) {
    const rand = new Uint32Array(1);
    crypto.getRandomValues(rand);
    const j = rand[0] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.join("");
}

function generatePassword(
  opts: Required<Pick<BulkRequest, "length" | "includeUpper" | "includeLower" | "includeDigits" | "includeSymbols">>
): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%^&*-_=+?";

  const sets: string[] = [];
  if (opts.includeUpper) sets.push(upper);
  if (opts.includeLower) sets.push(lower);
  if (opts.includeDigits) sets.push(digits);
  if (opts.includeSymbols) sets.push(symbols);

  if (sets.length === 0) throw new Error("At least one charset must be enabled");
  if (opts.length < sets.length) throw new Error("Password length must be >= number of enabled charsets");

  const required = sets.map((s) => pick(s));
  const all = sets.join("");

  let out = required.join("");
  for (let i = required.length; i < opts.length; i++) {
    out += pick(all);
  }
  return shuffle(out);
}

/**
 * BUG-EF-002 FIX: Comparacao em tempo constante para evitar timing attacks.
 * Antes: adminTokenHeader !== expectedAdminToken (comparacao direta vulneravel)
 * Agora: XOR byte-a-byte via TextEncoder (tempo constante independente do match)
 */
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminTokenHeader = req.headers.get("x-admin-token");
    const expectedAdminToken = Deno.env.get("ADMIN_BATCH_TOKEN");

    if (!expectedAdminToken) {
      return new Response(JSON.stringify({ error: "Missing ADMIN_BATCH_TOKEN secret" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // BUG-EF-002 FIX: timingSafeEqual em vez de comparacao direta
    if (!adminTokenHeader || !timingSafeEqual(adminTokenHeader, expectedAdminToken)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase configuration" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: BulkRequest = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const mode: RunMode = body.mode === "apply" ? "apply" : "dry_run";
    const pwLength = Math.min(Math.max(Number(body.length ?? 12), 8), 32);
    const includeUpper = body.includeUpper ?? true;
    const includeLower = body.includeLower ?? true;
    const includeDigits = body.includeDigits ?? true;
    const includeSymbols = body.includeSymbols ?? false;
    const excludeEmails = new Set(body.excludeEmails ?? []);
    const onlyEmails = body.onlyEmails && body.onlyEmails.length > 0
      ? new Set(body.onlyEmails)
      : null;
    const maxUsers = Math.min(Number(body.maxUsers ?? 200), 1000);
    const pageSize = Math.min(Math.max(Number(body.pageSize ?? 100), 10), 500);

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const updatedUsers: UpdatedUser[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && updatedUsers.length < maxUsers) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: pageSize });
      if (error) throw error;

      const users = data?.users ?? [];
      if (users.length < pageSize) hasMore = false;
      page++;

      for (const u of users) {
        if (updatedUsers.length >= maxUsers) break;

        const email = u.email ?? null;
        if (email && excludeEmails.has(email)) continue;
        if (onlyEmails && email && !onlyEmails.has(email)) continue;

        const password = generatePassword({
          length: pwLength,
          includeUpper,
          includeLower,
          includeDigits,
          includeSymbols,
        });

        if (mode === "apply") {
          const { error: updateErr } = await admin.auth.admin.updateUserById(u.id, { password });
          if (updateErr) {
            console.error(`[bulk-passwords] Failed to update user ${u.id}:`, updateErr.message);
            continue;
          }
        }

        updatedUsers.push({ id: u.id, email });
      }
    }

    return new Response(
      JSON.stringify({ mode, count: updatedUsers.length, users: updatedUsers }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[bulk-passwords] Unexpected error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
