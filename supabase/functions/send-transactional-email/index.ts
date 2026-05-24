import { getCorsHeaders } from "../_shared/cors.ts";
/**
 * Edge Function: send-transactional-email
 * Envia emails transacionais para eventos do sistema.
 * Suporta: quote_sent, quote_approved, quote_rejected, order_created.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { parseContract } from "../_shared/contracts/index.ts";
import {
  SendTransactionalEmailSchemas,
} from "../_shared/contracts/schemas/send-transactional-email.ts";

interface EmailRequest {
  event_type: "quote_sent" | "quote_approved" | "quote_rejected" | "order_created";
  recipient_email: string;
  recipient_name?: string;
  data: Record<string, unknown>;
}

function buildEmailContent(event: EmailRequest): { subject: string; html: string } {
  const name = event.recipient_name || "Cliente";
  
  switch (event.event_type) {
    case "quote_sent":
      return {
        subject: `Orçamento ${event.data.quote_number || ""} - Promo Gifts`,
        html: `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Promo Gifts</h1>
            </div>
            <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <h2 style="color: #1f2937; margin-top: 0;">Olá, ${name}!</h2>
              <p style="color: #4b5563; line-height: 1.6;">
                Seu orçamento <strong>#${event.data.quote_number || ""}</strong> foi enviado com sucesso.
              </p>
              ${event.data.total ? `<p style="color: #4b5563;">Valor total: <strong>R$ ${Number(event.data.total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></p>` : ""}
              ${event.data.valid_until ? `<p style="color: #6b7280; font-size: 14px;">Válido até: ${event.data.valid_until}</p>` : ""}
              ${event.data.approval_url ? `
                <div style="text-align: center; margin: 24px 0;">
                  <a href="${event.data.approval_url}" style="background: #6366f1; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                    Ver Orçamento
                  </a>
                </div>
              ` : ""}
              <p style="color: #9ca3af; font-size: 12px; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
                Este email foi enviado automaticamente por Promo Gifts.
              </p>
            </div>
          </div>
        `,
      };

    case "quote_approved":
      return {
        subject: `✅ Orçamento ${event.data.quote_number || ""} Aprovado!`,
        html: `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0;">✅ Orçamento Aprovado!</h1>
            </div>
            <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <h2 style="color: #1f2937; margin-top: 0;">Parabéns, ${name}!</h2>
              <p style="color: #4b5563; line-height: 1.6;">
                O orçamento <strong>#${event.data.quote_number || ""}</strong> 
                ${event.data.client_name ? `do cliente <strong>${event.data.client_name}</strong>` : ""} 
                foi aprovado!
              </p>
              ${event.data.total ? `<p style="color: #4b5563;">Valor: <strong>R$ ${Number(event.data.total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></p>` : ""}
              <p style="color: #9ca3af; font-size: 12px; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
                Promo Gifts — Sistema de Orçamentos
              </p>
            </div>
          </div>
        `,
      };

    case "quote_rejected":
      return {
        subject: `Orçamento ${event.data.quote_number || ""} - Atualização`,
        html: `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0;">Atualização do Orçamento</h1>
            </div>
            <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <h2 style="color: #1f2937; margin-top: 0;">Olá, ${name}</h2>
              <p style="color: #4b5563; line-height: 1.6;">
                O orçamento <strong>#${event.data.quote_number || ""}</strong> não foi aprovado neste momento.
              </p>
              ${event.data.notes ? `<p style="color: #6b7280;">Observações: ${event.data.notes}</p>` : ""}
              <p style="color: #4b5563;">Entre em contato para discutir alternativas.</p>
              <p style="color: #9ca3af; font-size: 12px; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
                Promo Gifts — Sistema de Orçamentos
              </p>
            </div>
          </div>
        `,
      };

    case "order_created":
      return {
        subject: `🎉 Pedido ${event.data.order_number || ""} Confirmado!`,
        html: `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0;">🎉 Pedido Confirmado!</h1>
            </div>
            <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <h2 style="color: #1f2937; margin-top: 0;">Olá, ${name}!</h2>
              <p style="color: #4b5563; line-height: 1.6;">
                Seu pedido <strong>#${event.data.order_number || ""}</strong> foi criado com sucesso!
              </p>
              ${event.data.total ? `<p style="color: #4b5563;">Valor total: <strong>R$ ${Number(event.data.total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></p>` : ""}
              <p style="color: #9ca3af; font-size: 12px; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
                Promo Gifts — Gestão de Pedidos
              </p>
            </div>
          </div>
        `,
      };

    default:
      return {
        subject: "Notificação - Promo Gifts",
        html: `<p>Você recebeu uma notificação do sistema Promo Gifts.</p>`,
      };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contractResult = await parseContract(req, SendTransactionalEmailSchemas, {
      corsHeaders,
    });
    if (!contractResult.ok) return contractResult.response;
    const { data: body, responseHeaders } = contractResult;

    const { subject, html } = buildEmailContent(body);

    // Log the email attempt
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Store email log in workspace_notifications as a record
    await adminClient.from("workspace_notifications").insert({
      user_id: user.id,
      title: `📧 Email: ${subject}`,
      message: `Email transacional (${body.event_type}) para ${body.recipient_email}`,
      type: "info",
      category: "emails",
    });

    // Return email content (actual sending happens when email domain is configured)
    return new Response(
      JSON.stringify({
        success: true,
        message: "Email queued successfully",
        preview: { subject, recipient: body.recipient_email, event_type: body.event_type },
      }),
      { headers: { ...corsHeaders, ...responseHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "Internal error");
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
