import { getCorsHeaders } from "../_shared/cors.ts";
/**
 * Edge Function: send-transactional-email
 * Envia emails transacionais para eventos do sistema.
 * Suporta: quote_sent, quote_approved, quote_rejected, order_created.
 *
 * BUG-A01 FIX (26/05/2026): Email nunca era enviado — apenas registrava
 * uma notificação interna e retornava "Email queued successfully".
 * Agora envia de fato via Resend usando a credencial RESEND_API_KEY.
 */
import {
  SendTransactionalEmailSchemas,
} from '../_shared/contracts/schemas/send-transactional-email.ts';
import { parseContract } from '../_shared/contracts/index.ts';
import { authenticateRequest, authErrorResponse } from '../_shared/auth.ts';
import { resolveCredential } from '../_shared/credentials.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

interface EmailRequest {
  event_type: string;
  recipient_email: string;
  recipient_name?: string;
  data?: Record<string, unknown>;
}

function buildEmailContent(event: EmailRequest): { subject: string; html: string } {
  const name = event.recipient_name ?? 'Cliente';
  const data = event.data ?? {};

  switch (event.event_type) {
    case 'quote_sent':
      return {
        subject: `Cotação ${data.quote_number ?? ''} enviada — Promo Gifts`,
        html: `<h2>Olá, ${name}!</h2><p>Sua cotação <strong>${data.quote_number ?? ''}</strong> foi enviada.</p><p>Valor total: <strong>R$ ${data.total ?? '—'}</strong></p>`,
      };
    case 'quote_approved':
      return {
        subject: `Cotação ${data.quote_number ?? ''} aprovada — Promo Gifts`,
        html: `<h2>Ótima notícia, ${name}!</h2><p>Sua cotação <strong>${data.quote_number ?? ''}</strong> foi aprovada.</p>`,
      };
    case 'quote_rejected':
      return {
        subject: `Cotação ${data.quote_number ?? ''} — retorno necessário`,
        html: `<h2>Olá, ${name}.</h2><p>Precisamos conversar sobre a cotação <strong>${data.quote_number ?? ''}</strong>.</p>`,
      };
    case 'order_created':
      return {
        subject: `Pedido ${data.order_number ?? ''} recebido — Promo Gifts`,
        html: `<h2>Pedido recebido, ${name}!</h2><p>Seu pedido <strong>${data.order_number ?? ''}</strong> está em processamento.</p>`,
      };
    default:
      return {
        subject: `Notificação Promo Gifts`,
        html: `<p>Olá, ${name}. Você tem uma nova notificação da Promo Gifts.</p>`,
      };
  }
}

const responseHeaders = { 'X-Function': 'send-transactional-email' };

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let user: { id: string; email?: string };
  try {
    const auth = await authenticateRequest(req);
    user = { id: auth.userId };
  } catch (authErr) {
    return authErrorResponse(authErr, corsHeaders);
  }

  try {
    const contractResult = await parseContract(req, SendTransactionalEmailSchemas, {
      corsHeaders,
    });
    if (!contractResult.ok) return contractResult.response;
    const body = contractResult.data as EmailRequest;

    const { subject, html } = buildEmailContent(body);

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    // Store email log in workspace_notifications as a record
    await adminClient.from('workspace_notifications').insert({
      user_id: user.id,
      title: `📧 Email: ${subject}`,
      message: `Email transacional (${body.event_type}) para ${body.recipient_email}`,
      type: 'info',
      category: 'emails',
    });

    // BUG-A01 FIX (26/05/2026): Email era "queued" mas nunca enviado.
    // Agora envia de fato via Resend usando a credencial configurada.
    const { value: resendKey } = await resolveCredential('RESEND_API_KEY');
    if (!resendKey) {
      console.error('[send-transactional-email] RESEND_API_KEY nao configurado');
      return new Response(
        JSON.stringify({ error: 'Email service not configured. Set RESEND_API_KEY in /admin/conexoes.' }),
        { status: 503, headers: { ...corsHeaders, ...responseHeaders, 'Content-Type': 'application/json' } }
      );
    }

    async function sendViaResend(apiKey: string, to: string, subj: string, htmlBody: string) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Promo Gifts <noreply@promogifts.com.br>',
          to: [to],
          subject: subj,
          html: htmlBody,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Resend error ${res.status}: ${err}`);
      }
      return res.json();
    }

    const sendResult = await sendViaResend(resendKey, body.recipient_email, subject, html);
    console.log('[send-transactional-email] sent via Resend', sendResult?.id);

    // Log activity (non-fatal)
    console.info('[send-transactional-email] activity', JSON.stringify({
      userId: user.id, action: 'email_sent', resourceType: 'email',
      event_type: body.event_type, recipient: body.recipient_email, email_id: sendResult?.id,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email sent successfully',
        email_id: sendResult?.id ?? null,
        preview: { subject, recipient: body.recipient_email, event_type: body.event_type },
      }),
      { headers: { ...corsHeaders, ...responseHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? 'Internal error');
    console.error('[send-transactional-email] error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
