/**
 * exportDiscountAuditPdf — Gera um PDF do histórico/auditoria de uma
 * solicitação de aprovação de desconto. Consumido pelo painel do gestor
 * (DiscountApprovalAuditTrail) e pela página de detalhes do request.
 *
 * Mantemos o módulo isolado para que o jsPDF seja code-split via dynamic
 * import — o bundle do painel admin não paga o custo de ~200KB até que o
 * usuário realmente clique em "Exportar PDF".
 */

export interface AuditRowForPdf {
  event: 'requested' | 'approved' | 'rejected' | 'expired' | 'cancelled' | 'superseded';
  actor_role: 'seller' | 'admin' | 'supervisor' | 'system';
  actor_name?: string | null;
  actor_email?: string | null;
  requested_discount_percent: number | null;
  max_allowed_percent: number | null;
  real_discount_percent: number | null;
  admin_notes: string | null;
  seller_notes: string | null;
  created_at: string;
}

export interface DiscountAuditPdfContext {
  requestId: string;
  quoteNumber?: string | null;
  clientName?: string | null;
  sellerName?: string | null;
  rows: AuditRowForPdf[];
}

const EVENT_LABEL: Record<AuditRowForPdf['event'], string> = {
  requested: 'Solicitado pelo vendedor',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  expired: 'Expirado',
  cancelled: 'Cancelado',
  superseded: 'Substituído',
};

function fmtPct(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—';
  return `${Number(v).toFixed(2).replace('.', ',')}%`;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return iso;
  }
}

/**
 * buildDiscountAuditPdfPlan — função pura (sem jsPDF) que monta a estrutura
 * lógica do PDF: cabeçalho com vendedor/cliente/orçamento e lista de eventos
 * com timestamps, percentuais e notas. Exposta para que testes automatizados
 * possam validar o conteúdo sem precisar carregar o jsPDF (que requer Canvas).
 */
export interface DiscountAuditPdfPlan {
  title: string;
  header: string[];
  events: Array<{
    index: number;
    title: string;
    timestamp: string;
    actor: string;
    metrics: string;
    sellerNotes?: string;
    adminNotes?: string;
  }>;
  fileName: string;
}

export function buildDiscountAuditPdfPlan(ctx: DiscountAuditPdfContext): DiscountAuditPdfPlan {
  const header: string[] = [`Solicitação: ${ctx.requestId}`];
  if (ctx.quoteNumber) header.push(`Orçamento: ${ctx.quoteNumber}`);
  if (ctx.clientName) header.push(`Cliente: ${ctx.clientName}`);
  if (ctx.sellerName) header.push(`Vendedor: ${ctx.sellerName}`);
  header.push(`Gerado em: ${new Date().toLocaleString('pt-BR')}`);

  const events = ctx.rows.map((row, idx) => ({
    index: idx + 1,
    title: EVENT_LABEL[row.event] ?? row.event,
    timestamp: fmtDate(row.created_at),
    actor:
      row.actor_name || row.actor_email
        ? `${row.actor_name ?? '—'} (${row.actor_email ?? '—'}) · papel: ${row.actor_role}`
        : `papel: ${row.actor_role}`,
    metrics: `Solicitado: ${fmtPct(row.requested_discount_percent)} · Real: ${fmtPct(
      row.real_discount_percent,
    )} · Limite: ${fmtPct(row.max_allowed_percent)}`,
    sellerNotes: row.seller_notes ?? undefined,
    adminNotes: row.admin_notes ?? undefined,
  }));

  return {
    title: 'Histórico de Aprovação de Desconto',
    header,
    events,
    fileName: `historico-desconto-${ctx.quoteNumber ?? ctx.requestId.slice(0, 8)}.pdf`,
  };
}

export async function exportDiscountAuditPdf(ctx: DiscountAuditPdfContext): Promise<void> {
  const plan = buildDiscountAuditPdfPlan(ctx);
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 40;
  let y = 50;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(plan.title, marginX, y);
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90);
  plan.header.forEach((line) => {
    doc.text(line, marginX, y);
    y += 14;
  });
  y += 8;

  doc.setDrawColor(220);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 18;

  doc.setTextColor(20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`Eventos (${plan.events.length})`, marginX, y);
  y += 18;

  if (plan.events.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text('Nenhum evento registrado.', marginX, y);
  }

  plan.events.forEach((row) => {
    if (y > 760) {
      doc.addPage();
      y = 50;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(20);
    doc.text(`${row.index}. ${row.title}`, marginX, y);
    y += 14;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text(`Em ${row.timestamp} · ${row.actor}`, marginX, y);
    y += 13;
    doc.text(row.metrics, marginX, y);
    y += 13;
    if (row.sellerNotes) {
      const lines = doc.splitTextToSize(`Justificativa: ${row.sellerNotes}`, pageWidth - marginX * 2);
      doc.text(lines, marginX, y);
      y += 13 * lines.length;
    }
    if (row.adminNotes) {
      const lines = doc.splitTextToSize(`Notas do gestor: ${row.adminNotes}`, pageWidth - marginX * 2);
      doc.text(lines, marginX, y);
      y += 13 * lines.length;
    }
    y += 10;
  });

  doc.save(plan.fileName);
}

