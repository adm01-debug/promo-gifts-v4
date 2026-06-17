import { format } from 'date-fns';
import { toast } from 'sonner';
import type { TelemetryRow, TimeFilter } from '@/pages/admin/telemetry/useTelemetryData';

export function exportCSV(rows: TelemetryRow[], timeFilter: TimeFilter) {
  if (!rows.length) {
    toast.warning('Sem dados para exportar');
    return;
  }
  const headers = [
    'Data/Hora',
    'Operação',
    'Tabela/RPC',
    'Duração (ms)',
    'Severidade',
    'Registros',
    'Limit',
    'Offset',
    'Count Mode',
    'Erro',
  ];
  const csvRows = rows.map((r) => [
    new Date(r.created_at).toLocaleString('pt-BR'),
    r.operation,
    r.table_name || r.rpc_name || '-',
    r.duration_ms,
    r.severity,
    r.record_count ?? '-',
    r.query_limit ?? '-',
    r.query_offset ?? '-',
    r.count_mode ?? '-',
    (r.error_message ?? '').replace(/"/g, '""'),
  ]);
  const csv = [headers.join(','), ...csvRows.map((row) => row.map((v) => `"${v}"`).join(','))].join(
    '\n',
  );
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `telemetria_${new Date().toISOString().slice(0, 10)}_${timeFilter}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  toast.success(`${rows.length} registros exportados`);
}

export async function exportPDF(
  rows: TelemetryRow[],
  timeFilter: TimeFilter,
  customDateFrom?: Date,
  customDateTo?: Date,
) {
  if (!rows.length) {
    toast.warning('Sem dados para exportar');
    return;
  }
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const now = new Date();
  doc.setFontSize(16);
  doc.text('Telemetria de Queries', 14, 15);
  doc.setFontSize(9);
  doc.setTextColor(100);
  const periodLabel =
    timeFilter === 'custom' && customDateFrom
      ? `${format(customDateFrom, 'dd/MM/yyyy')} a ${customDateTo ? format(customDateTo, 'dd/MM/yyyy') : 'hoje'}`
      : timeFilter;
  doc.text(
    `Exportado em ${now.toLocaleString('pt-BR')} · Período: ${periodLabel} · ${rows.length} registros`,
    14,
    22,
  );
  const headers = [
    'Data/Hora',
    'Operação',
    'Tabela/RPC',
    'Duração',
    'Sev.',
    'Regs',
    'Limit',
    'Erro',
  ];
  const body = rows.map((r) => [
    new Date(r.created_at).toLocaleString('pt-BR'),
    r.operation,
    r.table_name || r.rpc_name || '-',
    `${r.duration_ms}ms`,
    r.severity,
    r.record_count !== null ? String(r.record_count) : '-',
    r.query_limit !== null ? String(r.query_limit) : '-',
    (r.error_message || '-').slice(0, 60),
  ]);
  autoTable(doc, {
    head: [headers],
    body,
    startY: 28,
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [41, 37, 36], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 244] },
    columnStyles: {
      0: { cellWidth: 35 },
      3: { halign: 'right', cellWidth: 18 },
      4: { cellWidth: 14 },
      5: { halign: 'right', cellWidth: 14 },
      6: { halign: 'right', cellWidth: 14 },
      7: { cellWidth: 60 },
    },
  });
  doc.save(`telemetria_${now.toISOString().slice(0, 10)}_${timeFilter}.pdf`);
  toast.success(`${rows.length} registros exportados em PDF`);
}
