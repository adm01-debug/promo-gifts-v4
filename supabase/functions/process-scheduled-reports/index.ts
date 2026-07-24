import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { buildPublicCorsHeaders } from "../_shared/cors.ts";
import { safeErrorResponse } from "../_shared/error-response.ts";
import { authorizeCron } from "../_shared/dispatcher-auth.ts";
import { resolveCredential } from "../_shared/credentials.ts";

const corsHeaders = buildPublicCorsHeaders();

Deno.serve(async (req) => {
  // Cron: exige x-cron-secret para evitar chamadas diretas não autorizadas
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  const cronAuth = await authorizeCron(req, { corsHeaders: {}, secretEnvName: "CRON_SECRET", headerName: "x-cron-secret" });
  if (!cronAuth.ok) return cronAuth.response;

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find reports that are due
    const { data: dueReports, error: fetchError } = await supabase
      .from("scheduled_reports")
      .select("*")
      .eq("is_active", true)
      .lte("next_run_at", new Date().toISOString());

    if (fetchError) throw fetchError;

    if (!dueReports || dueReports.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: "Nenhum relatório pendente" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];

    for (const report of dueReports) {
      try {
        // Generate report data based on type
        let reportData: any = {};
        const filters = report.filters || {};

        if (report.report_type === "sales" || report.report_type === "quotes") {
          const { data: quotes } = await supabase
            .from("quotes")
            .select("id, quote_number, status, total, created_at, client_name, client_company")
            .gte("created_at", getStartDate(report.frequency))
            .order("created_at", { ascending: false })
            .limit(100);

          const total = (quotes || []).reduce((sum, q) => sum + (q.total || 0), 0);
          const approved = (quotes || []).filter(q => q.status === "approved").length;

          reportData = {
            type: "Relatório de Orçamentos",
            period: getPeriodLabel(report.frequency),
            summary: {
              total_quotes: quotes?.length || 0,
              approved_quotes: approved,
              conversion_rate: quotes?.length ? ((approved / quotes.length) * 100).toFixed(1) + "%" : "0%",
              total_value: formatCurrency(total),
            },
            top_quotes: (quotes || []).slice(0, 10).map(q => ({
              number: q.quote_number,
              client: q.client_company || q.client_name || "N/A",
              value: formatCurrency(q.total || 0),
              status: q.status,
            })),
          };
        } else if (report.report_type === "orders") {
          const { data: orders } = await supabase
            .from("orders")
            .select("id, order_number, status, total, created_at, client_name")
            .gte("created_at", getStartDate(report.frequency))
            .order("created_at", { ascending: false })
            .limit(100);

          const total = (orders || []).reduce((sum, o) => sum + (o.total || 0), 0);

          reportData = {
            type: "Relatório de Pedidos",
            period: getPeriodLabel(report.frequency),
            summary: {
              total_orders: orders?.length || 0,
              total_value: formatCurrency(total),
            },
          };
        }

        // Send email via Resend
        const resendKey = await resolveCredential("RESEND_API_KEY");
        if (resendKey) {
          const htmlContent = generateEmailHtml(report.report_name, reportData);

          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${resendKey}`,
            },
            body: JSON.stringify({
              from: "Promo Gifts <noreply@promogifts.com.br>",
              to: [report.email_to],
              subject: `📊 ${report.report_name} — ${reportData.period}`,
              html: htmlContent,
            }),
          });
        }

        // Update next_run_at
        const nextRun = calculateNextRun(report.frequency);
        await supabase
          .from("scheduled_reports")
          .update({
            last_sent_at: new Date().toISOString(),
            next_run_at: nextRun.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", report.id);

        results.push({ id: report.id, status: "sent", email: report.email_to });
      } catch (err) {
        results.push({ id: report.id, status: "error", error: (err as Error).message });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return safeErrorResponse(err, { corsHeaders, publicMessage: "internal_error", logLabel: "process-scheduled-reports error:" });
  }
});

function getStartDate(frequency: string): string {
  const now = new Date();
  switch (frequency) {
    case "daily": now.setDate(now.getDate() - 1); break;
    case "weekly": now.setDate(now.getDate() - 7); break;
    case "monthly": now.setMonth(now.getMonth() - 1); break;
    default: now.setDate(now.getDate() - 7);
  }
  return now.toISOString();
}

function getPeriodLabel(frequency: string): string {
  switch (frequency) {
    case "daily": return "Diário";
    case "weekly": return "Semanal";
    case "monthly": return "Mensal";
    default: return frequency;
  }
}

function calculateNextRun(frequency: string): Date {
  const next = new Date();
  switch (frequency) {
    case "daily": next.setDate(next.getDate() + 1); break;
    case "weekly": next.setDate(next.getDate() + 7); break;
    case "monthly": next.setMonth(next.getMonth() + 1); break;
    default: next.setDate(next.getDate() + 7);
  }
  next.setHours(8, 0, 0, 0); // Always at 8am
  return next;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function generateEmailHtml(reportName: string, data: any): string {
  const summaryRows = Object.entries(data.summary || {})
    .map(([key, val]) => `<tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:600">${key.replace(/_/g, " ")}</td><td style="padding:8px;border-bottom:1px solid #eee">${val}</td></tr>`)
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
      <h2 style="color:#7c3aed">📊 ${reportName}</h2>
      <p style="color:#666">Período: ${data.period} | Tipo: ${data.type}</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0">
        ${summaryRows}
      </table>
      <p style="color:#999;font-size:12px;margin-top:30px">
        Relatório gerado automaticamente pelo Promo Gifts em ${new Date().toLocaleDateString("pt-BR")}.
      </p>
    </div>
  `;
}
