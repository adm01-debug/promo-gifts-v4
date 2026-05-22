import { getCorsHeaders } from '../_shared/cors.ts';
import { authenticateRequest, requireRole, authErrorResponse } from '../_shared/auth.ts';
import { z } from "https://esm.sh/zod@3.23.8";
import { fetchWithBreaker, CircuitOpenError, circuitOpenResponse } from '../_shared/external-fetch.ts';
import { buildValidationErrorResponse } from "../_shared/validation-errors.ts";

const BodySchema = z.object({
  path: z.string().max(1000).default(''),
  action: z.enum(['list', 'check']).default('list'),
});

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  // Auth: exige vendedor autenticado (agente ou acima)
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
    // Parse & validate body (graceful fallback for empty body)
    let body: z.infer<typeof BodySchema>;
    try {
      const raw = await req.json();
      const parsed = BodySchema.safeParse(raw);
      if (!parsed.success) {
        return buildValidationErrorResponse(parsed.error, req, corsHeaders);
      }
      body = parsed.data;
    } catch {
      body = { path: '', action: 'list' };
    }

    const { path, action } = body;
    const accessToken = Deno.env.get("DROPBOX_ACCESS_TOKEN");

    // Check if Dropbox is configured
    if (action === "check") {
      return new Response(
        JSON.stringify({ connected: !!accessToken }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "DROPBOX_ACCESS_TOKEN não configurado", entries: [] }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // List files from Dropbox
    const dropboxResponse = await fetchWithBreaker("dropbox", "https://api.dropboxapi.com/2/files/list_folder", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: path || "",
        recursive: false,
        include_media_info: true,
        include_deleted: false,
        include_has_explicit_shared_members: false,
        include_mounted_folders: true,
        include_non_downloadable_files: false,
      }),
    });

    if (!dropboxResponse.ok) {
      const errorData = await dropboxResponse.json();
      console.error("Dropbox API error:", errorData);
      throw new Error(errorData.error_summary || "Erro na API do Dropbox");
    }

    const data = await dropboxResponse.json();

    // Get thumbnails for images
    const entriesWithThumbnails = await Promise.all(
      data.entries.map(async (entry: Record<string, unknown>) => {
        const tag = entry[".tag"] as string;
        const name = entry.name as string;
        const pathLower = entry.path_lower as string;
        if (tag === "file" && /\.(jpg|jpeg|png|gif)$/i.test(name)) {
          try {
            const thumbnailResponse = await fetchWithBreaker(
              "dropbox", "https://content.dropboxapi.com/2/files/get_thumbnail_v2",
              {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${accessToken}`,
                  "Dropbox-API-Arg": JSON.stringify({
                    resource: { ".tag": "path", path: pathLower },
                    format: "jpeg",
                    size: "w128h128",
                    mode: "strict",
                  }),
                },
              }
            );

            if (thumbnailResponse.ok) {
              const blob = await thumbnailResponse.blob();
              const base64 = await blobToBase64(blob);
              return { ...entry, thumbnail_url: `data:image/jpeg;base64,${base64}` };
            }
          } catch (err) {
            console.error("Error getting thumbnail:", err);
          }
        }
        return entry;
      })
    );

    return new Response(
      JSON.stringify({
        entries: entriesWithThumbnails,
        cursor: data.cursor,
        has_more: data.has_more,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    if (error instanceof CircuitOpenError) {
      return circuitOpenResponse(error, corsHeaders);
    }
    const msg = error instanceof Error ? error.message : "Erro interno";
    console.error("Error in dropbox-list:", msg);
    return new Response(
      JSON.stringify({ error: msg, entries: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function blobToBase64(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
