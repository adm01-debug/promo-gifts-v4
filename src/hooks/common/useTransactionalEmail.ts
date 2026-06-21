/**
 * useTransactionalEmail — Hook para enviar emails transacionais.
 */
import { supabase } from '@/integrations/supabase/client';

import { logger } from '@/lib/logger';
export type EmailEventType = 'order_created' | 'quote_approved' | 'quote_rejected' | 'quote_sent';

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
      logger.error('[TransactionalEmail] Error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    logger.error('[TransactionalEmail] Unexpected error:', err);
    return { success: false, error: 'Unexpected error' };
  }
}
