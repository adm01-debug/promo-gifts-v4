/**
 * Cart export utilities — CSV, PDF, share link
 */
import { toast } from 'sonner';
import type { SellerCart } from '@/hooks/products';
import { formatCurrency } from '../CartUtilComponents';

/**
 * Escapa um valor para uma célula CSV de forma segura:
 *  - duplica aspas internas e envolve em aspas (RFC 4180), evitando que vírgulas,
 *    quebras de linha ou aspas no conteúdo quebrem a estrutura do arquivo;
 *  - neutraliza injeção de fórmula (CSV/Excel/Google Sheets): valores que começam
 *    com = + - @ TAB ou CR são prefixados com aspa simples para não serem
 *    interpretados como fórmula ao abrir a planilha.
 */
export function csvCell(value: string | number | null | undefined): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const guarded = /^[=+\-@\t\r\n]/.test(raw) ? `'${raw}` : raw;
  return `"${guarded.replace(/"/g, '""')}"`;
}

/** Coage para número finito (preço/quantidade vindos do banco podem ser null/NaN). */
const safeNumber = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Gera um nome de arquivo seguro a partir do nome da empresa: remove caracteres
 * inválidos em sistemas de arquivos (/ \ : * ? " < > |), colapsa espaços em
 * hífens e normaliza. Sem isso, uma empresa como "A/B Ltda" produziria um
 * download quebrado (o "/" vira separador de caminho) ou um nome vazio.
 */
export function safeCartFileName(companyName: string | null | undefined, ext: string): string {
  const base = (companyName ?? '')
    .replace(/[/\\:*?"<>|]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `carrinho-${base || 'sem-nome'}.${ext}`;
}

/** Monta o conteúdo CSV (sem efeitos colaterais) — separado para ser testável. */
export function buildCartCsv(cart: SellerCart): string {
  const header = ['SKU', 'Produto', 'Cor', 'Qtd', 'Preço Unit.', 'Subtotal', 'Observações']
    .map(csvCell)
    .join(',');
  const rows = cart.items.map((i) => {
    const price = safeNumber(i.product_price);
    const qty = safeNumber(i.quantity);
    return [
      csvCell(i.product_sku || ''),
      csvCell(i.product_name),
      csvCell(i.color_name || ''),
      csvCell(qty),
      csvCell(price.toFixed(2)),
      csvCell((price * qty).toFixed(2)),
      csvCell(i.notes || ''),
    ].join(',');
  });
  const total = cart.items.reduce(
    (s, i) => s + safeNumber(i.product_price) * safeNumber(i.quantity),
    0,
  );
  rows.push(['', '', '', '', 'Total', total.toFixed(2), ''].map(csvCell).join(','));

  return [header, ...rows].join('\n');
}

export function exportCartToCSV(cart: SellerCart): void {
  const csv = buildCartCsv(cart);
  // Prefixa BOM para o Excel reconhecer UTF-8 e exibir acentos corretamente.
  const BOM = '\uFEFF';
  const blob = new Blob([`${BOM}${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeCartFileName(cart.company_name, 'csv');
  a.click();
  URL.revokeObjectURL(url);
  toast.success('CSV exportado com sucesso');
}

export async function exportCartToPDF(cart: SellerCart): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF();
  const total = cart.items.reduce(
    (s, i) => s + safeNumber(i.product_price) * safeNumber(i.quantity),
    0,
  );
  const totalQty = cart.items.reduce((s, i) => s + safeNumber(i.quantity), 0);

  doc.setFontSize(18);
  doc.text(`Carrinho — ${cart.company_name}`, 14, 20);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(cart.company_location || '', 14, 28);
  doc.text(`${cart.items.length} SKUs • ${totalQty} unidades • ${formatCurrency(total)}`, 14, 34);
  if (cart.notes) {
    doc.text(`Notas: ${cart.notes}`, 14, 40);
  }

  autoTable(doc, {
    startY: cart.notes ? 46 : 40,
    head: [['SKU', 'Produto', 'Cor', 'Qtd', 'Unit.', 'Subtotal', 'Obs.']],
    body: cart.items.map((i) => {
      const price = safeNumber(i.product_price);
      const qty = safeNumber(i.quantity);
      return [
        i.product_sku || '-',
        i.product_name,
        i.color_name || '-',
        qty.toString(),
        formatCurrency(price),
        formatCurrency(price * qty),
        i.notes || '',
      ];
    }),
    foot: [['', '', '', totalQty.toString(), '', formatCurrency(total), '']],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [16, 185, 129] },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
  });

  doc.setFontSize(7);
  doc.setTextColor(180);
  doc.text('Gerado pelo CRM', 14, doc.internal.pageSize.getHeight() - 10);
  doc.save(safeCartFileName(cart.company_name, 'pdf'));
  toast.success('PDF exportado com sucesso');
}

export function shareCartLink(cartId: string): void {
  const url = `${window.location.origin}/carrinhos/${cartId}`;
  const clip = navigator.clipboard?.writeText?.(url);
  // Em contexto inseguro (HTTP) ou sem permissão, a Clipboard API pode estar
  // ausente ou rejeitar — não deixamos a Promise pendente sem tratamento.
  if (clip && typeof clip.then === 'function') {
    clip
      .then(() => toast.success('Link copiado!', { description: url }))
      .catch(() => toast.error('Não foi possível copiar o link', { description: url }));
  } else {
    toast.error('Não foi possível copiar o link', { description: url });
  }
}
