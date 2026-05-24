import { createClient } from "npm:@supabase/supabase-js@2.49.8";
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
  password: string;
}

// Use the SSOT helper instead of inline CORS literal.
// extraAllowHeaders: this endpoint needs x-admin-token for auth.
// allowMethods: restrict to POST + OPTIONS (admin-only mutation).
// The SSOT helper automatically includes x-request-id in both Allow-Headers
// and Expose-Headers, which satisfies the edge-cors gate.
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

function generatePassword(opts: Required<Pick<BulkRequest, "length" | "includeUpper" | "includeLower" | "includeDigits" | "includeSymbols">>): string {
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
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!adminTokenHeader || adminTokenHeader !== expectedAdminToken) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => ({}))) as BulkRequest;

    const mode: RunMode = body.mode ?? "dry_run";
    const length = body.length ?? 14;
    const includeUpper = body.includeUpper ?? true;
    const includeLower = body.includeLower ?? true;
    const includeDigits = body.includeDigits ?? true;
    const includeSymbols = body.includeSymbols ?? true;
    const excludeEmails = new Set((body.excludeEmails ?? []).map((e) => e.toLowerCase()));
    const onlyEmails = new Set((body.onlyEmails ?? []).map((e) => e.toLowerCase()));
    const maxUsers = body.maxUsers ?? 10000;
    const pageSize = Math.min(Math.max(body.pageSize ?? 200, 1), 1000);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase env vars" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const targetUsers: Array<{ id: string; email: string | null }> = [];
    let page = 1;

    while (targetUsers.length < maxUsers) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: pageSize });
      if (error) throw error;

      const users = data?.users ?? [];
      if (users.length === 0) break;

      for (const u of users) {
        const email = (u.email ?? "").toLowerCase();

        if (onlyEmails.size > 0 && (!email || !onlyEmails.has(email))) continue;
        if (email && excludeEmails.has(email)) continue;

        targetUsers.push({ id: u.id, email: u.email ?? null });
        if (targetUsers.length >= maxUsers) break;
      }

      if (users.length < pageSize) break;
      page += 1;
    }

    const opts = { length, includeUpper, includeLower, includeDigits, includeSymbols };

    if (mode === "dry_run") {
      return new Response(
        JSON.stringify({
          mode,
          total_selected: targetUsers.length,
          sample: targetUsers.slice(0, 20),
          note: "No password was changed (dry_run).",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const updated: UpdatedUser[] = [];
    const failed: Array<{ id: string; email: string | null; error: string }> = [];

    for (const u of targetUsers) {
      const password = generatePassword(opts);
      const { error } = await admin.auth.admin.updateUserById(u.id, { password });

      if (error) {
        failed.push({ id: u.id, email: u.email, error: error.message });
      } else {
        updated.push({ id: u.id, email: u.email, password });
      }
    }

    return new Response(
      JSON.stringify({
        mode,
        total_selected: targetUsers.length,
        updated_count: updated.length,
        failed_count: failed.length,
        updated,
        failed,
        warning: "Temporary passwords are returned once. Store securely and rotate after first login.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
