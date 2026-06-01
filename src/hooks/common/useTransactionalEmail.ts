/**
 * useTransactionalEmail — Hook para enviar emails transacionais.
 */
import { supabase } from '@/integrations/supabase/client';

export type EmailEventType = 'quote_sent' | 'quote_approved' | 'quote_rejected' | 'order_created';

interface SendEmailParams {
  event_type: EmailEventType;
  recipient_email: string;
  recipient_name?: string;
  data: Record<string, unknown>;
}

export async function sendTransactionalEmail(params: SendEmailParams) {
  try {
    const { data, error } = await supabase.functions.invoke('send-transactional-email', {
      body: params,
    });

    if (error) {
      console.error('[TransactionalEmail] Error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    console.error('[TransactionalEmail] Unexpected error:', err);
    return { success: false, error: 'Unexpected error' };
  }
}
