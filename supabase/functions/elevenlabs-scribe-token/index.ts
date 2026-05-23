import { getCorsHeaders } from '../_shared/cors.ts';
import { authenticateRequest, authErrorResponse } from '../_shared/auth.ts';
import { runBotProtection } from '../_shared/bot-protection.ts';
import { fetchWithBreaker, CircuitOpenError, circuitOpenResponse } from '../_shared/external-fetch.ts';

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    let userId: string;
    try {
      const authResult = await authenticateRequest(req);
      userId = authResult.userId;
    } catch (authErr) {
      return authErrorResponse(authErr, corsHeaders);
    }

    const protection = await runBotProtection(req, {
      endpoint: 'elevenlabs-scribe-token',
      maxRequests: 20,
      windowSeconds: 60,
      blockSeconds: 1800,
      customIdentifier: `user:${userId}`,
    }, corsHeaders);
    if (!protection.allowed) return protection.blockResponse!;

    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }

    const response = await fetchWithBreaker(
      "elevenlabs",
      'https://api.elevenlabs.io/v1/single-use-token/realtime_scribe',
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
        },
      }
    );

    if (!response.ok) {
      await response.body?.cancel();
      console.error('ElevenLabs scribe credential request failed:', { status: response.status });
      return new Response(
        JSON.stringify({ error: `ElevenLabs API error: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { token } = await response.json();

    return new Response(
      JSON.stringify({ token }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Scribe credential generation failed:', {
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    if (error instanceof CircuitOpenError) {
      return circuitOpenResponse(error, corsHeaders);
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
