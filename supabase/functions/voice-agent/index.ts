import { getCorsHeaders } from '../_shared/cors.ts';
import { authenticateRequest, authErrorResponse } from '../_shared/auth.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { callAiWithTracking, QuotaExceededError } from '../_shared/ai-usage.ts';
import { SYSTEM_PROMPT, VOICE_COMMAND_TOOL, TOOL_CHOICE } from './systemPrompt.ts';
import { parseAiResponse } from './parseAiResponse.ts';
import { runBotProtection } from '../_shared/bot-protection.ts';
import { buildValidationErrorResponse } from "../_shared/validation-errors.ts";

const TranscriptSchema = z.object({
  transcript: z.string().min(1, 'transcript cannot be empty').max(1000, 'transcript too long'),
});

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    let authUserId: string;
    try {
      const authResult = await authenticateRequest(req);
      authUserId = authResult.userId;
    } catch (authErr) {
      return authErrorResponse(authErr, corsHeaders);
    }

    const protection = await runBotProtection(req, {
      endpoint: 'voice-agent',
      maxRequests: 30,
      windowSeconds: 60,
      blockSeconds: 1800,
      customIdentifier: `user:${authUserId}`,
    }, corsHeaders);
    if (!protection.allowed) return protection.blockResponse!;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
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

    const parsed = TranscriptSchema.safeParse(body);
    if (!parsed.success) {
      return buildValidationErrorResponse(parsed.error, req, corsHeaders);
    }

    const { transcript } = parsed.data;

    const response = await callAiWithTracking({
      userId: authUserId,
      functionName: "voice-agent",
      model: 'google/gemini-3-flash-preview',
      apiKey: LOVABLE_API_KEY,
      requestBody: {
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: transcript },
        ],
        tools: [VOICE_COMMAND_TOOL],
        tool_choice: TOOL_CHOICE,
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add funds.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errText = await response.text();
      console.error('AI gateway error:', response.status, errText);
      return new Response(
        JSON.stringify({ error: 'AI processing failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await response.json();
    const result = parseAiResponse(aiData);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    if (error instanceof QuotaExceededError) {
      return new Response(
        JSON.stringify({ error: 'Limite mensal de IA atingido.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.error('Voice agent error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
