import { getCorsHeaders } from '../_shared/cors.ts';
import { authenticateRequest, authErrorResponse } from '../_shared/auth.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { runBotProtection } from '../_shared/bot-protection.ts';
import { fetchWithBreaker, CircuitOpenError, circuitOpenResponse } from '../_shared/external-fetch.ts';

const VALID_VOICE_IDS = [
  '5lrBPYY4YvMbKHTo8kvZ', // Chosen voice (default)
  'FGY2WhTYpPnrIDTdsKH5', // Laura
  'CwhRBWXzGAHq8TQ4Fs17', // Roger
  'EXAVITQu4vr4xnSDxMaL', // Sarah
  'IKne3meq5aSn9XLyUdCD', // Charlie
  'JBFqnCBsd6RMkjVDRZzb', // George
  'TX3LPaxmHKxFdv7VOQHJ', // Liam
];

const TtsRequestSchema = z.object({
  text: z.string().min(1, 'text cannot be empty').max(5000, 'text too long (max 5000 chars)'),
  voiceId: z.string().optional(),
});

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
      endpoint: 'elevenlabs-tts',
      maxRequests: 30,
      windowSeconds: 60,
      blockSeconds: 1800,
      customIdentifier: `user:${userId}`,
    }, corsHeaders);
    if (!protection.allowed) return protection.blockResponse!;

    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const parsed = TtsRequestSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { text, voiceId } = parsed.data;

    // Use chosen voice by default
    // If voiceId provided but not in allowlist, still use it (custom voices)
    const selectedVoiceId = voiceId || '5lrBPYY4YvMbKHTo8kvZ';

    const response = await fetchWithBreaker(
      "elevenlabs",
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}?output_format=mp3_22050_32`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            speed: 1.1,
          },
        }),
      }
    );

    if (!response.ok) {
      await response.text();
      console.error('ElevenLabs TTS error:', { status: response.status });

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'TTS rate limit exceeded. Try again shortly.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: `TTS failed: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return raw binary audio for best performance
    const audioBuffer = await response.arrayBuffer();

    return new Response(audioBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error: unknown) {
    console.error('TTS error:', error);
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
