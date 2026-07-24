/**
 * Export utilities for Trends module — CSV (lightweight, no deps).
 * PDF/Excel users can leverage the existing excelExport.ts for richer formats.
 */

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportTrendsCsv(
  filename: string,
  rows: Array<Record<string, unknown>>,
  columns?: Array<{ key: string; header: string }>,
): void {
  if (!rows.length) return;
  const cols = columns ?? Object.keys(rows[0]).map((k) => ({ key: k, header: k }));
  const header = cols.map((c) => escapeCsv(c.header)).join(',');
  const body = rows.map((r) => cols.map((c) => escapeCsv(r[c.key])).join(',')).join('\n');
  const csv = `\ufeff${header}\n${body}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ts = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  a.href = url;
  a.download = `${filename}_${ts}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
