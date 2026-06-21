/**
 * Gerador puro do Dossiê BI em PDF.
 * Recebe dados já resolvidos e produz um Blob PDF de 4 páginas máx.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from '@/lib/format';
import type { ClientBI } from '@/hooks/bi/useClientBI';
import type { ClientVsIndustryResult, MetricComparison } from '@/hooks/bi/useClientVsIndustry';
import type { ClientAffinityResult } from '@/hooks/bi/useClientAffinity';
import type { IndustryTrendsResult } from '@/hooks/bi/useIndustryTrends';
import type { SeasonalityResult } from '@/hooks/bi/useClientSeasonality';
import type { IndustryRecommendation } from '@/lib/bi/industryRecommendations';
import type { CategorySection } from '@/lib/bi/executive-summary';

export interface DossierClient {
  name: string;
  cnpj?: string | null;
  ramo?: string | null;
  cidade?: string | null;
  estado?: string | null;
}

export interface DossierData {
  client: DossierClient;
  sellerName: string;
  clientBI: ClientBI;
  vsIndustry: ClientVsIndustryResult;
  affinity: ClientAffinityResult;
  industryTrends: IndustryTrendsResult;
  seasonality?: SeasonalityResult;
  empiricalRec: IndustryRecommendation;
  categorySection?: CategorySection;
}

const PRIMARY: [number, number, number] = [124, 58, 237]; // violet-600
const MUTED: [number, number, number] = [120, 120, 130];
const TEXT: [number, number, number] = [25, 25, 35];

function formatDateBR(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return '—';
  }
}

function classificationLabel(c: MetricComparison['classification']): string {
  switch (c) {
    case 'above':
      return 'Acima da média';
    case 'below':
      return 'Abaixo da média';
    case 'on_par':
      return 'Na média';
    default:
      return 'Sem dados';
  }
}

function metricValue(m: MetricComparison, which: 'client' | 'industry'): string {
  const v = which === 'client' ? m.clientValue : m.industryAvg;
  if (m.format === 'currency') return formatCurrency(v);
  return v.toFixed(v < 10 ? 1 : 0);
}

function addFooter(doc: jsPDF, generatedAt: string) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.setFont('helvetica', 'normal');
    doc.text(`Confidencial · uso interno comercial · gerado em ${generatedAt}`, 14, h - 8);
    doc.text(`Página ${i} de ${pageCount}`, w - 14, h - 8, { align: 'right' });
  }
}

function addSectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...TEXT);
  doc.text(title, 14, y);
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.6);
  doc.line(14, y + 1.5, 50, y + 1.5);
  return y + 8;
}

export function generateBIDossierPDF(data: DossierData): Blob {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const generatedAt = new Date().toLocaleString('pt-BR');

  // ============ CAPA ============
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, W, 55, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('PROMO GIFTS', 14, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Inteligência Comercial · Business Analytic', 14, 24);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('Dossiê Comercial', 14, 42);

  // Bloco do cliente
  doc.setTextColor(...TEXT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(data.client.name, 14, 75);

  const meta: string[] = [];
  if (data.client.ramo) meta.push(`Ramo: ${data.client.ramo}`);
  if (data.client.cnpj) meta.push(`CNPJ: ${data.client.cnpj}`);
  if (data.client.cidade) {
    meta.push(
      `Localidade: ${data.client.cidade}${data.client.estado ? `/${data.client.estado}` : ''}`,
    );
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  let cy = 84;
  for (const line of meta) {
    doc.text(line, 14, cy);
    cy += 5.5;
  }

  // Caixa de emissão
  doc.setDrawColor(220, 220, 230);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, cy + 6, W - 28, 26, 2, 2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  doc.text('Emitido em', 18, cy + 14);
  doc.text('Vendedor responsável', 18, cy + 23);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED);
  doc.text(generatedAt, 60, cy + 14);
  doc.text(data.sellerName || '—', 60, cy + 23);

  // ============ PÁGINA 2 — Visão 360° ============
  doc.addPage();
  let y = 22;
  y = addSectionTitle(doc, 'Visão 360° do Cliente', y);

  const bi = data.clientBI;
  const kpiBoxes: Array<[string, string]> = [
    ['LTV Total', formatCurrency(bi.ltv)],
    ['Ticket médio', formatCurrency(bi.avgTicket)],
    ['Pedidos', String(bi.ordersCount)],
    ['Última compra', formatDateBR(bi.lastOrderDate)],
  ];
  const boxW = (W - 28 - 9) / 4;
  kpiBoxes.forEach(([label, value], i) => {
    const x = 14 + i * (boxW + 3);
    doc.setFillColor(248, 248, 252);
    doc.roundedRect(x, y, boxW, 22, 2, 2, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(label.toUpperCase(), x + 3, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...TEXT);
    doc.text(value, x + 3, y + 15);
  });
  y += 30;

  if (bi.recentOrders.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...TEXT);
    doc.text('Pedidos recentes', 14, y);
    y += 3;
    autoTable(doc, {
      startY: y,
      head: [['Nº', 'Data', 'Itens', 'Total', 'Resumo']],
      body: bi.recentOrders
        .slice(0, 5)
        .map((o) => [
          o.id,
          formatDateBR(o.date),
          String(o.itemsCount),
          formatCurrency(o.total),
          o.productPreview,
        ]),
      theme: 'striped',
      headStyles: { fillColor: PRIMARY, textColor: 255, fontSize: 8.5 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 22 },
        2: { cellWidth: 14, halign: 'center' },
        3: { cellWidth: 28, halign: 'right' },
      },
    });
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text('Sem histórico de pedidos registrado.', 14, y + 5);
  }

  // ============ PÁGINA 3 — Cliente × Setor ============
  doc.addPage();
  y = 22;
  y = addSectionTitle(doc, 'Cliente × Setor', y);

  const vs = data.vsIndustry;
  if (vs.hasEnoughSample && vs.metrics.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(
      `Benchmark contra ${vs.sampleSize} empresa(s) do mesmo ramo · últimos ${vs.daysWindow} dias`,
      14,
      y,
    );
    y += 5;

    autoTable(doc, {
      startY: y,
      head: [['Métrica', 'Cliente', 'Média do setor', 'Δ %', 'Classificação']],
      body: vs.metrics.map((m) => {
        const sign = m.deltaPercent > 0 ? '+' : '';
        return [
          m.label,
          metricValue(m, 'client'),
          metricValue(m, 'industry'),
          `${sign}${Math.round(m.deltaPercent)}%`,
          classificationLabel(m.classification),
        ];
      }),
      theme: 'grid',
      headStyles: { fillColor: PRIMARY, textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right', fontStyle: 'bold' },
      },
    });

    if (vs.insight) {
      const finalY = doc.lastAutoTable.finalY + 8;
      doc.setFillColor(245, 243, 255);
      doc.roundedRect(14, finalY, W - 28, 18, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...PRIMARY);
      doc.text('INSIGHT', 18, finalY + 6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...TEXT);
      const wrapped = doc.splitTextToSize(vs.insight, W - 36);
      doc.text(wrapped, 18, finalY + 12);
    }
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text('Amostra do ramo ainda insuficiente para benchmark (mínimo 3 empresas).', 14, y + 5);
  }

  // ============ PÁGINA 4 — Recomendações ============
  doc.addPage();
  y = 22;
  y = addSectionTitle(doc, 'Recomendações Comerciais', y);

  // Top afinidade
  const topAffinity = data.affinity.topProducts.slice(0, 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  doc.text(
    `Afinidade do cliente${data.affinity.isMock ? ' (simulado)' : ' (histórico real)'}`,
    14,
    y,
  );
  y += 3;

  if (topAffinity.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Produto', 'Categoria proxy', 'Vezes', 'Receita']],
      body: topAffinity.map((p) => [
        p.product_name,
        '—',
        String(p.occurrences),
        formatCurrency(Number(p.total_revenue) || 0),
      ]),
      theme: 'striped',
      headStyles: { fillColor: PRIMARY, textColor: 255, fontSize: 8.5 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
      columnStyles: {
        2: { halign: 'center', cellWidth: 16 },
        3: { halign: 'right', cellWidth: 28 },
      },
    });
    y = doc.lastAutoTable.finalY + 6;
  } else if (data.affinity.categories.length > 0) {
    const rows = data.affinity.categories
      .flatMap((c) => c.suggestions.slice(0, 2).map((s) => [s.name, c.category, s.reason]))
      .slice(0, 5);
    autoTable(doc, {
      startY: y,
      head: [['Sugestão', 'Categoria', 'Motivo']],
      body: rows,
      theme: 'striped',
      headStyles: { fillColor: PRIMARY, textColor: 255, fontSize: 8.5 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 6;
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text('Sem dados de afinidade.', 14, y + 5);
    y += 10;
  }

  // Tendências do setor
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  doc.text(`Tendência do setor${data.industryTrends.isMock ? ' (simulado)' : ' (90 dias)'}`, 14, y);
  y += 3;

  const trendRows = data.industryTrends.trends
    .slice(0, 5)
    .map((t) => [t.productName, t.category, String(t.unitsSold), formatCurrency(t.avgPrice)]);
  if (trendRows.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Produto', 'Categoria', 'Unidades', 'Preço médio']],
      body: trendRows,
      theme: 'striped',
      headStyles: { fillColor: PRIMARY, textColor: 255, fontSize: 8.5 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
      columnStyles: {
        2: { halign: 'center', cellWidth: 22 },
        3: { halign: 'right', cellWidth: 30 },
      },
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // Sugestão do especialista
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  doc.text(`Sugestão do especialista — ${data.empiricalRec.ramo}`, 14, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    head: [['Produto', 'Categoria', 'Faixa', 'Por quê']],
    body: data.empiricalRec.suggestedProducts
      .slice(0, 5)
      .map((p) => [
        p.name,
        p.category,
        `${formatCurrency(p.priceFrom)} – ${formatCurrency(p.priceTo)}`,
        p.reason,
      ]),
    theme: 'striped',
    headStyles: { fillColor: PRIMARY, textColor: 255, fontSize: 8.5 },
    bodyStyles: { fontSize: 8 },
    margin: { left: 14, right: 14 },
    columnStyles: {
      2: { cellWidth: 36 },
    },
  });

  // ============ PÁGINA 5 — Mapa de Categorias ============
  const cat = data.categorySection;
  if (cat?.hasData) {
    doc.addPage();
    y = 22;
    y = addSectionTitle(doc, 'Mapa de Categorias', y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(
      cat.isMock
        ? 'Comparativo cliente × setor por categoria (dados parciais — amostra simulada).'
        : 'Comparativo cliente × setor por categoria de produto (últimos 90 dias).',
      14,
      y,
    );
    y += 5;

    if (cat.rows.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Categoria', 'Cliente %', 'Setor %', 'Tendência (90d)']],
        body: cat.rows.map((r) => {
          const arrow =
            r.trend === 'up' ? '↑' : r.trend === 'down' ? '↓' : r.trend === 'stable' ? '→' : '—';
          const delta =
            r.deltaPct === null ? '—' : `${r.deltaPct > 0 ? '+' : ''}${Math.round(r.deltaPct)}%`;
          return [
            r.label,
            `${r.clientSharePct.toFixed(1)}%`,
            `${r.industrySharePct.toFixed(1)}%`,
            `${arrow} ${delta}`,
          ];
        }),
        theme: 'grid',
        headStyles: { fillColor: PRIMARY, textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        margin: { left: 14, right: 14 },
        columnStyles: {
          1: { halign: 'right', cellWidth: 28 },
          2: { halign: 'right', cellWidth: 28 },
          3: { halign: 'center', cellWidth: 38, fontStyle: 'bold' },
        },
      });
      y = doc.lastAutoTable.finalY + 8;
    }

    if (cat.gaps.length > 0) {
      const boxH = 14 + cat.gaps.length * 6;
      doc.setFillColor(254, 243, 226); // amber-50
      doc.roundedRect(14, y, W - 28, boxH, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(180, 83, 9); // amber-700
      doc.text(
        'OPORTUNIDADES GAP — categorias fortes no setor que o cliente não compra',
        18,
        y + 6,
      );
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...TEXT);
      cat.gaps.forEach((g, i) => {
        doc.text(`•  ${g.label} — ${g.reason}`, 18, y + 13 + i * 6);
      });
      y += boxH + 6;
    }

    // Insight final
    doc.setFillColor(245, 243, 255);
    doc.roundedRect(14, y, W - 28, 22, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...PRIMARY);
    doc.text('INSIGHT DE CATEGORIA', 18, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...TEXT);
    const wrapped = doc.splitTextToSize(cat.insight, W - 36);
    doc.text(wrapped, 18, y + 12);
  }

  // ============ PÁGINA 6 — Sazonalidade (opcional) ============
  const seas = data.seasonality;
  if (seas) {
    doc.addPage();
    y = 22;
    y = addSectionTitle(doc, 'Sazonalidade Cliente × Setor', y);

    // (seas é o mesmo data.seasonality usado acima)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(
      seas.isMock
        ? `Padrão simulado (histórico real insuficiente — ${seas.monthsCovered} mês${seas.monthsCovered === 1 ? '' : 'es'} cobertos).`
        : `Janela de ${seas.windowMonths} meses · ${seas.monthsCovered} mês${seas.monthsCovered === 1 ? '' : 'es'} com dados.`,
      14,
      y,
    );
    y += 5;

    autoTable(doc, {
      startY: y,
      head: [
        ['Mês', 'Cliente (pedidos)', 'Cliente (% ano)', 'Setor (méd/empresa)', 'Setor (% ano)'],
      ],
      body: seas.client.map((c, i) => {
        const ind = seas.industry[i];
        return [
          c.monthLabel,
          c.quotesCount > 0 ? String(c.quotesCount) : '—',
          c.sharePercent > 0 ? `${c.sharePercent.toFixed(1)}%` : '—',
          ind && ind.avgQuotesPerCompany > 0 ? ind.avgQuotesPerCompany.toFixed(1) : '—',
          ind && ind.sharePercent > 0 ? `${ind.sharePercent.toFixed(1)}%` : '—',
        ];
      }),
      theme: 'grid',
      headStyles: { fillColor: PRIMARY, textColor: 255, fontSize: 8.5 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'center' },
        4: { halign: 'right' },
      },
    });
    y = doc.lastAutoTable.finalY + 6;

    // Top 3 picos
    if (seas.topClientMonths.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...TEXT);
      doc.text('Top 3 meses do cliente:', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...MUTED);
      doc.text(
        seas.topClientMonths.map((c) => `${c.monthLabel} (${c.quotesCount})`).join('  ·  '),
        55,
        y,
      );
      y += 5;
    }
    if (seas.nextPeakMonth) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...TEXT);
      doc.text('Próximo pico:', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...MUTED);
      const monthFull = [
        'Janeiro',
        'Fevereiro',
        'Março',
        'Abril',
        'Maio',
        'Junho',
        'Julho',
        'Agosto',
        'Setembro',
        'Outubro',
        'Novembro',
        'Dezembro',
      ][seas.nextPeakMonth - 1];
      doc.text(
        `${monthFull}${seas.daysToNextPeak === 0 ? ' (estamos no mês de pico)' : ` em ${seas.daysToNextPeak} dia(s)`}`,
        40,
        y,
      );
      y += 6;
    }

    // Insight em destaque
    if (seas.insight) {
      doc.setFillColor(245, 243, 255);
      doc.roundedRect(14, y, W - 28, 22, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...PRIMARY);
      doc.text('INSIGHT DE TIMING', 18, y + 6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...TEXT);
      const wrapped = doc.splitTextToSize(seas.insight, W - 36);
      doc.text(wrapped, 18, y + 12);
    }
  } // end if (seas)

  addFooter(doc, generatedAt);

  return doc.output('blob');
}

export function buildDossierFileName(clientName: string): string {
  const slug = clientName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const date = new Date().toISOString().slice(0, 10);
  return `dossie-bi-${slug || 'cliente'}-${date}.pdf`;
}
