/**
 * Kit PDF Generator
 * Generates a professional PDF for an assembled kit with composition,
 * price breakdown, and personalization details.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  type KitState,
  formatCurrency,
  formatVolume,
  formatDimensions,
  generatePriceBreakdown,
  calculateTotalKitPrice,
} from '@/lib/kit-builder';

interface KitPdfOptions {
  kitState: KitState;
  kitQuantity: number;
  kitName: string;
  orgName?: string;
  orgLogoUrl?: string;
}

// Brand colors
const PRIMARY = [30, 64, 175] as const; // blue-700
const GRAY_800 = [31, 41, 55] as const;
const GRAY_500 = [107, 114, 128] as const;
const _GRAY_200 = [229, 231, 235] as const;
const WHITE = [255, 255, 255] as const;
const _GREEN = [16, 185, 129] as const;

function hexToRgb(hex?: string): readonly [number, number, number] | null {
  if (!hex) return null;
  const m = hex.replace('#', '').match(/^([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
}

function drawHeader(
  doc: jsPDF,
  kitName: string,
  y: number,
  orgName?: string,
  orgLogoUrl?: string,
  identity?: { color?: string; tag?: string | null; icon?: string },
): number {
  const accent = hexToRgb(identity?.color) ?? PRIMARY;

  // Identity color stripe (top 2mm) — reflects kit identity color
  doc.setFillColor(...accent);
  doc.rect(0, 0, 210, 2, 'F');

  // Main header bar
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 2, 210, 34, 'F');

  const textStartX = 14;

  doc.setTextColor(...WHITE);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(kitName || 'Kit Personalizado', textStartX, 18);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const dateStr = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  doc.text(`Gerado em ${dateStr}${orgName ? ` • ${orgName}` : ''}`, textStartX, 28);

  // Identity tag pill (right side, above the badge)
  if (identity?.tag) {
    doc.setFillColor(...accent);
    const tagText = identity.tag.toUpperCase();
    doc.setFontSize(7);
    const tagW = doc.getTextWidth(tagText) + 6;
    doc.roundedRect(196 - tagW, 10, tagW, 6, 1.5, 1.5, 'F');
    doc.setTextColor(...WHITE);
    doc.text(tagText, 196 - tagW / 2, 14.2, { align: 'center' });
  }

  // Right-aligned badge
  doc.setTextColor(...WHITE);
  doc.setFontSize(8);
  doc.text('FICHA DO KIT', 196, 22, { align: 'right' });

  return 44;
}

function drawSectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GRAY_800);
  doc.text(title, 14, y);

  // Underline
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.6);
  doc.line(14, y + 2, 60, y + 2);

  return y + 10;
}

function drawKpiCards(doc: jsPDF, kitState: KitState, kitQuantity: number, y: number): number {
  const { items, personalization, totalWeight, box } = kitState;
  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const personalizedCount =
    (personalization.box.enabled ? 1 : 0) +
    Object.values(personalization.items).filter((p) => p.enabled).length;

  const cards = [
    { label: 'Embalagem', value: '1', sub: box?.name || '-' },
    { label: 'Itens', value: String(totalItems), sub: `${items.length} diferentes` },
    {
      label: 'Personalizações',
      value: String(personalizedCount),
      sub: personalizedCount === 1 ? 'item' : 'itens',
    },
    {
      label: 'Peso estimado',
      value: totalWeight >= 1000 ? `${(totalWeight / 1000).toFixed(1)}kg` : `${totalWeight}g`,
      sub: `x${kitQuantity} kits`,
    },
  ];

  const cardW = 43;
  const gap = 4;
  const startX = 14;

  cards.forEach((card, i) => {
    const x = startX + i * (cardW + gap);
    // Card bg
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(x, y, cardW, 26, 2, 2, 'F');

    // Value
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GRAY_800);
    doc.text(card.value, x + cardW / 2, y + 12, { align: 'center' });

    // Label
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY_500);
    doc.text(card.label, x + cardW / 2, y + 18, { align: 'center' });

    // Sub
    doc.setFontSize(6);
    doc.text(card.sub, x + cardW / 2, y + 23, { align: 'center' });
  });

  return y + 34;
}

function drawCompositionTable(doc: jsPDF, kitState: KitState, y: number): number {
  const { box, items, personalization } = kitState;

  const rows: (string | number)[][] = [];

  // Box row
  if (box) {
    rows.push([
      '📦 ' + box.name,
      box.sku || '-',
      box.material || '-',
      '1',
      formatCurrency(box.price),
      personalization.box.enabled ? personalization.box.techniqueName || 'Sim' : '-',
    ]);
  }

  // Item rows
  items.forEach((item) => {
    const itemP = personalization.items[item.id];
    rows.push([
      '🎁 ' + item.name + (item.isOptional ? ' (Opcional)' : ''),
      item.sku || '-',
      item.material || '-',
      String(item.quantity),
      formatCurrency(item.price),
      itemP?.enabled ? itemP.techniqueName || 'Sim' : '-',
    ]);
  });

  autoTable(doc, {
    startY: y,
    head: [['Item', 'SKU', 'Material', 'Qtd', 'Preço Unit.', 'Personalização']],
    body: rows,
    theme: 'striped',
    headStyles: {
      fillColor: PRIMARY as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      textColor: WHITE as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      fontSize: 8,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: GRAY_800 as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 55 },
      3: { halign: 'center', cellWidth: 14 },
      4: { halign: 'right', cellWidth: 24 },
      5: { cellWidth: 30 },
    },
    margin: { left: 14, right: 14 },
  });

  return doc.lastAutoTable.finalY + 8;
}

function drawPersonalizationDetails(doc: jsPDF, kitState: KitState, y: number): number {
  const { personalization, box, items } = kitState;

  const entries: {
    name: string;
    technique: string;
    colors: string;
    dimensions: string;
    price: string;
  }[] = [];

  if (personalization.box.enabled && box) {
    entries.push({
      name: `Caixa: ${box.name}`,
      technique: personalization.box.techniqueName || '-',
      colors: personalization.box.colors ? `${personalization.box.colors} cor(es)` : '-',
      dimensions:
        personalization.box.width && personalization.box.height
          ? `${personalization.box.width}x${personalization.box.height}cm`
          : '-',
      price: personalization.box.estimatedPrice
        ? formatCurrency(personalization.box.estimatedPrice)
        : '-',
    });
  }

  items.forEach((item) => {
    const p = personalization.items[item.id];
    if (p?.enabled) {
      entries.push({
        name: item.name,
        technique: p.techniqueName || '-',
        colors: p.colors ? `${p.colors} cor(es)` : '-',
        dimensions: p.width && p.height ? `${p.width}x${p.height}cm` : '-',
        price: p.estimatedPrice ? formatCurrency(p.estimatedPrice) + '/un' : '-',
      });
    }
  });

  if (entries.length === 0) return y;

  y = drawSectionTitle(doc, 'Detalhes de Personalização', y);

  autoTable(doc, {
    startY: y,
    head: [['Item', 'Técnica', 'Cores', 'Área', 'Custo/un']],
    body: entries.map((e) => [e.name, e.technique, e.colors, e.dimensions, e.price]),
    theme: 'grid',
    headStyles: {
      fillColor: [99, 102, 241] as number[],
      textColor: WHITE as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      fontSize: 8,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: GRAY_800 as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    },
    margin: { left: 14, right: 14 },
  });

  return doc.lastAutoTable.finalY + 8;
}

function drawPriceBreakdown(
  doc: jsPDF,
  kitState: KitState,
  kitQuantity: number,
  y: number,
): number {
  const { box, items, personalization } = kitState;
  const breakdown = generatePriceBreakdown(box, items, personalization, kitQuantity);
  const pricing = calculateTotalKitPrice(box, items, personalization, kitQuantity);

  y = drawSectionTitle(doc, 'Detalhamento de Preços', y);

  const rows = breakdown.map((item) => [
    item.isPersonalization ? `   ↳ ${item.label}` : item.label,
    item.quantity ? String(item.quantity) : '-',
    formatCurrency(item.unitPrice),
    formatCurrency(item.totalPrice),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Descrição', 'Qtd', 'Preço Unit.', 'Subtotal']],
    body: rows,
    theme: 'striped',
    headStyles: {
      fillColor: GRAY_800 as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      textColor: WHITE as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      fontSize: 8,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: GRAY_800 as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    },
    columnStyles: {
      1: { halign: 'center', cellWidth: 18 },
      2: { halign: 'right', cellWidth: 26 },
      3: { halign: 'right', cellWidth: 26 },
    },
    margin: { left: 14, right: 14 },
    didParseCell: (data: {
      cell: { raw: unknown; styles: Record<string, unknown> };
      column: { index: number };
      row: { index: number };
      section: string;
    }) => {
      // Indent personalization rows
      if (data.section === 'body') {
        const text = String(data.cell.raw);
        if (text.startsWith('   ↳')) {
          data.cell.styles.textColor = [99, 102, 241];
          data.cell.styles.fontStyle = 'italic';
        }
      }
    },
  });

  const finalTableY = doc.lastAutoTable.finalY;

  // Total box
  const totalBoxY = finalTableY + 4;
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(110, totalBoxY, 86, 24, 2, 2, 'F');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY_500);
  doc.text(`Subtotal (${kitQuantity} kit${kitQuantity > 1 ? 's' : ''})`, 114, totalBoxY + 7);
  doc.text(formatCurrency(pricing.subtotal), 192, totalBoxY + 7, { align: 'right' });

  if (pricing.personalizationPrice > 0) {
    doc.text('Personalização', 114, totalBoxY + 13);
    doc.setTextColor(99, 102, 241);
    doc.text(formatCurrency(pricing.personalizationPrice), 192, totalBoxY + 13, { align: 'right' });
  }

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PRIMARY);
  doc.text('TOTAL', 114, totalBoxY + 21);
  doc.text(formatCurrency(pricing.total), 192, totalBoxY + 21, { align: 'right' });

  // Unit price
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY_500);
  doc.text(`(${formatCurrency(pricing.unitPrice)}/kit)`, 140, totalBoxY + 21);

  return totalBoxY + 30;
}

function drawFooter(doc: jsPDF) {
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY_500);
  doc.text(
    'Valores estimados, sujeitos a confirmação. Preços de personalização podem variar conforme arte final.',
    14,
    pageHeight - 10,
  );
  doc.text(`Página 1`, 196, pageHeight - 10, { align: 'right' });
}

export function generateKitPDF(options: KitPdfOptions): Blob {
  const { kitState, kitQuantity, kitName } = options;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  let y = drawHeader(doc, kitName, 0, options.orgName, options.orgLogoUrl, kitState.identity);

  // KPI cards
  y = drawKpiCards(doc, kitState, kitQuantity, y);

  // Composition section
  y = drawSectionTitle(doc, 'Composição do Kit', y);
  y = drawCompositionTable(doc, kitState, y);

  // Box info line
  if (kitState.box) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY_500);
    doc.text(
      `Caixa: ${formatDimensions(kitState.box.internalWidth, kitState.box.internalHeight, kitState.box.internalDepth)} | Volume: ${formatVolume(kitState.box.internalVolume)} | Ocupação: ${kitState.volumeUsagePercent.toFixed(0)}%`,
      14,
      y,
    );
    y += 8;
  }

  // Personalization details
  y = drawPersonalizationDetails(doc, kitState, y);

  // Check if we need a new page for price breakdown
  if (y > 210) {
    doc.addPage();
    y = 20;
  }

  // Price breakdown
  y = drawPriceBreakdown(doc, kitState, kitQuantity, y);

  // Footer
  drawFooter(doc);

  return doc.output('blob');
}

export function downloadKitPDF(options: KitPdfOptions): void {
  const blob = generateKitPDF(options);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kit-${(options.kitName || 'personalizado').replace(/\s+/g, '-').toLowerCase()}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
