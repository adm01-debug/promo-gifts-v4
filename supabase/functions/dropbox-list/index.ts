import { getCorsHeaders } from '../_shared/cors.ts';
import { authenticateRequest, requireRole, authErrorResponse } from '../_shared/auth.ts';
import { z } from '../_shared/zod-validate.ts';
import { fetchWithBreaker, CircuitOpenError, circuitOpenResponse } from '../_shared/external-fetch.ts';
import { resolveCredential } from '../_shared/credentials.ts';

const BodySchema = z.object({
  path: z.string().max(1000).default(''),
  action: z.enum(['list', 'check']).default('list'),
  // BUG-A19 FIX: aceita cursor para paginação (Dropbox has_more / cursor)
  cursor: z.string().max(500).optional(),
});

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authCtx = await authenticateRequest(req);
    requireRole(authCtx, 'agente');
  } catch (authErr) {
    return authErrorResponse(authErr, corsHeaders);
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

    const { path, action, cursor } = body;
    const { value: accessToken } = await resolveCredential('DROPBOX_ACCESS_TOKEN');

    if (action === 'check') {
      return new Response(
        JSON.stringify({ connected: !!accessToken }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'DROPBOX_ACCESS_TOKEN nao configurado', entries: [] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // BUG-A19 FIX: suporte a paginação via cursor.
    // Anteriormente a função retornava has_more/cursor mas nunca os usava.
    // Agora: se cursor fornecido, chama list_folder/continue; caso contrário, list_folder normal.
    let dropboxResponse: Response;

    if (cursor) {
      // Continua da página anterior
      dropboxResponse = await fetchWithBreaker('dropbox', 'https://api.dropboxapi.com/2/files/list_folder/continue', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cursor }),
      });
    } else {
      // Primeira página
      dropboxResponse = await fetchWithBreaker('dropbox', 'https://api.dropboxapi.com/2/files/list_folder', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: path || '',
          recursive: false,
          include_media_info: true,
          include_deleted: false,
        }),
      });
    }

    if (!dropboxResponse.ok) {
      const errorData = await dropboxResponse.json();
      console.error('Dropbox API error:', errorData);
      // Token expirado: 401
      if (dropboxResponse.status === 401) {
        return new Response(
          JSON.stringify({
            error: 'Token Dropbox expirado ou inválido. Reconfigure DROPBOX_ACCESS_TOKEN em /admin/conexoes.',
            error_code: 'token_expired',
            entries: [],
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(errorData.error_summary || 'Erro na API do Dropbox');
    }

    const data = await dropboxResponse.json();
    return new Response(
      JSON.stringify({
        entries: data.entries,
        cursor: data.cursor,
        has_more: data.has_more,
        // BUG-A19 FIX: instrução explícita de como buscar a próxima página
        next_page_hint: data.has_more
          ? 'Envie { cursor: "<valor acima>" } para obter a próxima página'
          : null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    if (error instanceof CircuitOpenError) return circuitOpenResponse(error, corsHeaders);
    const msg = error instanceof Error ? error.message : 'Erro interno';
    console.error('Error in dropbox-list:', msg);
    return new Response(
      JSON.stringify({ error: msg, entries: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
