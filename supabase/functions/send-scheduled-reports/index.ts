import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { buildPublicCorsHeaders } from "../_shared/cors.ts";
import { authorizeCron } from "../_shared/dispatcher-auth.ts";
import { getCredential } from "../_shared/credentials.ts";

const corsHeaders = buildPublicCorsHeaders();

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Cron: exige x-cron-secret para evitar chamadas diretas não autorizadas
  const cronAuth = await authorizeCron(req, {
    corsHeaders,
    secretEnvName: "CRON_SECRET",
    headerName: "x-cron-secret",
  });
  if (!cronAuth.ok) return cronAuth.response;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // fix: ssot-bypass — credential vault
    const resendKey = await getCredential("RESEND_API_KEY");
    const supabase = createClient(supabaseUrl, serviceKey);

    // Find reports due to run
    const now = new Date().toISOString();
    const { data: dueReports, error: fetchErr } = await supabase
      .from("scheduled_reports")
      .select("*")
      .eq("is_active", true)
      .lte("next_run_at", now)
      .limit(20);

    if (fetchErr) throw fetchErr;
    if (!dueReports || dueReports.length === 0) {
      return new Response(JSON.stringify({ message: "No reports due", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ id: string; status: string; error?: string }> = [];

    for (const report of dueReports) {
      try {
        // Generate report data
        const reportData = await generateReportData(supabase, report);

        // Send email via Resend (if key available) or log
        if (resendKey) {
          await sendEmailViaResend(resendKey, report.email_to, report.report_name, reportData);
        } else {
          console.log("[send-scheduled-reports] Email provider not configured; report send skipped", {
            reportId: report.id,
          });
        }

        // Calculate next run
        const nextRun = calculateNextRun(report.frequency);

        // Update report
        await supabase
          .from("scheduled_reports")
          .update({
            last_sent_at: now,
            next_run_at: nextRun.toISOString(),
            updated_at: now,
          })
          .eq("id", report.id);

        results.push({ id: report.id, status: "sent" });
      } catch (err) {
        console.error("Error processing scheduled report:", {
          reportId: report.id,
          message: err instanceof Error ? err.message : "Unknown error",
        });
        results.push({ id: report.id, status: "error", error: err instanceof Error ? err.message : "Unknown error" });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-scheduled-reports error:", {
      message: err instanceof Error ? err.message : "Internal error",
    });
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function generateReportData(supabase: any, report: any): Promise<string> {
  const { report_type, user_id } = report;
  let html = `<h2>${report.report_name}</h2><p>Gerado em ${new Date().toLocaleDateString("pt-BR")}</p>`;

  switch (report_type) {
    case "quotes": {
      const { data, count } = await supabase
        .from("quotes")
        .select("id, quote_number, client_name, status, total, created_at", { count: "exact" })
        .eq("seller_id", user_id)
        .order("created_at", { ascending: false })
        .limit(20);

      html += `<p><strong>Total de orçamentos:</strong> ${count || 0}</p>`;
      html += "<table border='1' cellpadding='8' cellspacing='0' style='border-collapse:collapse;width:100%'>";
      html += "<tr><th>Nº</th><th>Cliente</th><th>Status</th><th>Total</th><th>Data</th></tr>";
      for (const q of data || []) {
        html += `<tr>
          <td>${q.quote_number}</td>
          <td>${q.client_name || "—"}</td>
          <td>${q.status}</td>
          <td>R$ ${Number(q.total).toFixed(2)}</td>
          <td>${new Date(q.created_at).toLocaleDateString("pt-BR")}</td>
        </tr>`;
      }
      html += "</table>";
      break;
    }
    case "orders": {
      const { data, count } = await supabase
        .from("orders")
        .select("id, order_number, client_name, status, total, created_at", { count: "exact" })
        .eq("seller_id", user_id)
        .order("created_at", { ascending: false })
        .limit(20);

      html += `<p><strong>Total de pedidos:</strong> ${count || 0}</p>`;
      html += "<table border='1' cellpadding='8' cellspacing='0' style='border-collapse:collapse;width:100%'>";
      html += "<tr><th>Nº</th><th>Cliente</th><th>Status</th><th>Total</th><th>Data</th></tr>";
      for (const o of data || []) {
        html += `<tr>
          <td>${o.order_number}</td>
          <td>${o.client_name || "—"}</td>
          <td>${o.status}</td>
          <td>R$ ${Number(o.total || 0).toFixed(2)}</td>
          <td>${new Date(o.created_at).toLocaleDateString("pt-BR")}</td>
        </tr>`;
      }
      html += "</table>";
      break;
    }
    default: {
      // Generic summary
      const [quotesRes, ordersRes] = await Promise.all([
        supabase.from("quotes").select("id", { count: "exact", head: true }).eq("seller_id", user_id),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("seller_id", user_id),
      ]);

      html += `<ul>
        <li><strong>Orçamentos:</strong> ${quotesRes.count || 0}</li>
        <li><strong>Pedidos:</strong> ${ordersRes.count || 0}</li>
      </ul>`;
    }
  }

  html += `<hr/><p style='font-size:12px;color:#888'>Relatório automático — Promo Gifts</p>`;
  return html;
}

async function sendEmailViaResend(apiKey: string, to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Promo Gifts <noreply@promogifts.com.br>",
      to: [to],
      subject: `📊 ${subject}`,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${err}`);
  }
}

function calculateNextRun(frequency: string): Date {
  const now = new Date();
  switch (frequency) {
    case "daily":
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case "weekly":
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case "monthly": {
      const next = new Date(now);
      next.setMonth(next.getMonth() + 1);
      return next;
    }
    default:
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
}
