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

export async function exportDiscountAuditPdf(ctx: DiscountAuditPdfContext): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 40;
  let y = 50;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Histórico de Aprovação de Desconto', marginX, y);
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(`Solicitação: ${ctx.requestId}`, marginX, y);
  y += 14;
  if (ctx.quoteNumber) {
    doc.text(`Orçamento: ${ctx.quoteNumber}`, marginX, y);
    y += 14;
  }
  if (ctx.clientName) {
    doc.text(`Cliente: ${ctx.clientName}`, marginX, y);
    y += 14;
  }
  if (ctx.sellerName) {
    doc.text(`Vendedor: ${ctx.sellerName}`, marginX, y);
    y += 14;
  }
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, marginX, y);
  y += 22;

  doc.setDrawColor(220);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 18;

  doc.setTextColor(20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`Eventos (${ctx.rows.length})`, marginX, y);
  y += 18;

  if (ctx.rows.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text('Nenhum evento registrado.', marginX, y);
  }

  ctx.rows.forEach((row, idx) => {
    if (y > 760) {
      doc.addPage();
      y = 50;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(20);
    doc.text(`${idx + 1}. ${EVENT_LABEL[row.event] ?? row.event}`, marginX, y);
    y += 14;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text(`Em ${fmtDate(row.created_at)} · papel: ${row.actor_role}`, marginX, y);
    y += 13;
    if (row.actor_name || row.actor_email) {
      doc.text(`Por ${row.actor_name ?? '—'} (${row.actor_email ?? '—'})`, marginX, y);
      y += 13;
    }
    doc.text(
      `Solicitado: ${fmtPct(row.requested_discount_percent)} · Real: ${fmtPct(row.real_discount_percent)} · Limite: ${fmtPct(row.max_allowed_percent)}`,
      marginX,
      y,
    );
    y += 13;
    if (row.seller_notes) {
      const lines = doc.splitTextToSize(`Justificativa: ${row.seller_notes}`, pageWidth - marginX * 2);
      doc.text(lines, marginX, y);
      y += 13 * lines.length;
    }
    if (row.admin_notes) {
      const lines = doc.splitTextToSize(`Notas do gestor: ${row.admin_notes}`, pageWidth - marginX * 2);
      doc.text(lines, marginX, y);
      y += 13 * lines.length;
    }
    y += 10;
  });

  const fileName = `historico-desconto-${ctx.quoteNumber ?? ctx.requestId.slice(0, 8)}.pdf`;
  doc.save(fileName);
}
