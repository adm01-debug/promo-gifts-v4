/**
 * logVoiceCommand — Logs a voice command to the database for analytics.
 * Fire-and-forget — does not throw or block the UI.
 */
import { supabase } from '@/integrations/supabase/client';
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

      await supabase.from('voice_command_logs').insert({
        user_id: user.id,
        transcript: meta.transcript,
        action: action.action,
        response: action.response,
        data: action.data ?? {},
        duration_ms: meta.durationMs ?? null,
        success: meta.success ?? true,
      });
    } catch {
      // Silent — analytics should never break UX
    }
  })();
}
