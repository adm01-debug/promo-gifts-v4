import { getCorsHeaders } from '../_shared/cors.ts';
import { authenticateRequest, requireRole, authErrorResponse } from '../_shared/auth.ts';
import { z } from "https://esm.sh/zod@3.23.8";
import { fetchWithBreaker, CircuitOpenError, circuitOpenResponse } from '../_shared/external-fetch.ts';
// BUG-005 FIX: import resolveCredential for SSOT credential resolution (DB-first -> env fallback).
// Previously used Deno.env.get("DROPBOX_ACCESS_TOKEN") directly, bypassing the credential
// management system. Tokens stored via /admin/conexoes were not being found.
import { resolveCredential } from '../_shared/credentials.ts';

const BodySchema = z.object({
  path: z.string().max(1000).default(''),
  action: z.enum(['list', 'check']).default('list'),
});

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  try {
    const authCtx = await authenticateRequest(req);
    requireRole(authCtx, "agente");
  } catch (authErr) {
    return authErrorResponse(authErr, corsHeaders);
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body: z.infer<typeof BodySchema>;
    try {
      const raw = await req.json();
      const parsed = BodySchema.safeParse(raw);
      if (!parsed.success) {
        return new Response(
          JSON.stringify({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      body = parsed.data;
    } catch {
      body = { path: '', action: 'list' };
    }

    const { path, action } = body;
    // BUG-005 FIX: use resolveCredential (DB-first SSOT) instead of Deno.env.get().
    const { value: accessToken } = await resolveCredential("DROPBOX_ACCESS_TOKEN");

    if (action === "check") {
      return new Response(
        JSON.stringify({ connected: !!accessToken }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "DROPBOX_ACCESS_TOKEN nao configurado", entries: [] }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const dropboxResponse = await fetchWithBreaker("dropbox", "https://api.dropboxapi.com/2/files/list_folder", {
      method: "POST",
      headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ path: path || "", recursive: false, include_media_info: true, include_deleted: false }),
    });

    if (!dropboxResponse.ok) {
      const errorData = await dropboxResponse.json();
      console.error("Dropbox API error:", errorData);
      throw new Error(errorData.error_summary || "Erro na API do Dropbox");
    }

    const data = await dropboxResponse.json();
    return new Response(
      JSON.stringify({ entries: data.entries, cursor: data.cursor, has_more: data.has_more }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    if (error instanceof CircuitOpenError) return circuitOpenResponse(error, corsHeaders);
    const msg = error instanceof Error ? error.message : "Erro interno";
    console.error("Error in dropbox-list:", msg);
    return new Response(JSON.stringify({ error: msg, entries: [] }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
