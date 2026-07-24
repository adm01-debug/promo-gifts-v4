/**
 * logVoiceCommand — Logs a voice command to the database for analytics.
 * Fire-and-forget — does not throw or block the UI.
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import type { VoiceAgentAction } from './types';

export function logVoiceCommand(
  action: VoiceAgentAction,
  meta: { transcript: string; durationMs?: number; success?: boolean },
) {
  // Fire and forget — don't await, don't block
  (async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // BUG-VOICELOG-SILENT-FAIL FIX: bare await swallowed RLS and constraint errors.
      // Supabase JS v2 never throws for DB errors — must destructure { error }.
      const { error: logErr } = await supabase.from('voice_command_logs').insert({
        user_id: user.id,
        transcript: meta.transcript,
        action: action.action,
        response: action.response,
        data: action.data || {},
        duration_ms: meta.durationMs ?? null,
        success: meta.success ?? true,
      });
      if (logErr) logger.warn('[logVoiceCommand] insert failed:', logErr);
    } catch {
      // Silent — analytics should never break UX
    }
  })();
}
