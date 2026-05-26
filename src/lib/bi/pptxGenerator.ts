/**
 * pptxGenerator — gera apresentação PPTX (5 slides) com inteligência do BI.
 * Usado pelo ExecutiveSummaryButton no módulo Business Analytic.
 */
import PptxGenJS from 'pptxgenjs';
import type { ClientHealthScoreResult } from '@/hooks/bi/useClientHealthScore';
import type { ClientBI } from '@/hooks/bi/useClientBI';
import type { ClientAffinityResult } from '@/hooks/bi/useClientAffinity';
import type { IndustryTrendsResult } from '@/hooks/bi/useIndustryTrends';
import type { SeasonalityResult } from '@/hooks/bi/useClientSeasonality';
import type { ClientVsIndustryResult } from '@/hooks/bi/useClientVsIndustry';
import type { CategorySection } from '@/lib/bi/executive-summary';

interface Args {
  clientName: string;
  ramoAtividade: string | null;
  health: ClientHealthScoreResult;
  bi: ClientBI;
  affinity: ClientAffinityResult | null;
  trends: IndustryTrendsResult | null;
  seasonality: SeasonalityResult;
  vs: ClientVsIndustryResult;
  categorySection?: CategorySection | null;
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

// Paleta corporativa (violeta/fuchsia + neutros)
const C = {
  primary: '6D28D9', // violet-700
  accent: 'C026D3', // fuchsia-600
  bg: '0F172A', // slate-900
  bgLight: 'F8FAFC', // slate-50
  text: '1E293B', // slate-800
  muted: '64748B', // slate-500
  good: '10B981', // emerald-500
  warn: 'F59E0B', // amber-500
  bad: 'EF4444', // red-500
};

function tierColor(tier: string): string {
  if (tier === 'healthy') return C.good;
  if (tier === 'attention') return C.warn;
  if (tier === 'risk') return C.bad;
  return C.muted;
}
function tierLabel(tier: string): string {
  if (tier === 'healthy') return 'SAUDÁVEL';
  if (tier === 'attention') return 'ATENÇÃO';
  if (tier === 'risk') return 'RISCO';
  return '—';
}

export async function generateBIPptx({
  clientName,
  ramoAtividade,
  health,
  bi,
  affinity,
  trends,
  seasonality,
  vs,
  categorySection,
}: Args): Promise<void> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5
  pptx.title = `Briefing BI — ${clientName}`;
  pptx.company = 'Promo Gifts';

  // ====================== SLIDE 1 — CAPA / HERO ======================
  const s1 = pptx.addSlide();
  s1.background = { color: C.bg };

  // Faixa de cor à esquerda
  s1.addShape('rect', { x: 0, y: 0, w: 0.5, h: 7.5, fill: { color: C.primary } });

  s1.addText('BUSINESS ANALYTIC', {
    x: 0.8,
    y: 0.4,
    w: 8,
    h: 0.4,
    fontSize: 11,
    fontFace: 'Calibri',
    color: C.accent,
    bold: true,
    charSpacing: 3,
  });
  s1.addText(clientName, {
    x: 0.8,
    y: 0.85,
    w: 11,
    h: 1.1,
    fontSize: 40,
    fontFace: 'Calibri',
    color: 'FFFFFF',
    bold: true,
  });
  if (ramoAtividade) {
    s1.addText(ramoAtividade, {
      x: 0.8,
      y: 1.95,
      w: 8,
      h: 0.4,
      fontSize: 14,
      fontFace: 'Calibri',
      color: C.bgLight,
      italic: true,
    });
  }

  // Score circular grande
  s1.addShape('ellipse', {
    x: 0.8,
    y: 2.8,
    w: 3.2,
    h: 3.2,
    fill: { color: tierColor(health.tier) },
    line: { color: 'FFFFFF', width: 4 },
  });
  s1.addText(`${health.score}`, {
    x: 0.8,
    y: 3.3,
    w: 3.2,
    h: 1.4,
    fontSize: 90,
    fontFace: 'Calibri',
    color: 'FFFFFF',
    bold: true,
    align: 'center',
  });
  s1.addText('HEALTH SCORE', {
    x: 0.8,
    y: 4.7,
    w: 3.2,
    h: 0.3,
    fontSize: 11,
    fontFace: 'Calibri',
    color: 'FFFFFF',
    bold: true,
    align: 'center',
    charSpacing: 3,
  });
  s1.addText(tierLabel(health.tier), {
    x: 0.8,
    y: 6.1,
    w: 3.2,
    h: 0.4,
    fontSize: 16,
    fontFace: 'Calibri',
    color: tierColor(health.tier),
    bold: true,
    align: 'center',
  });

  // Insight cross-zona à direita
  s1.addText('DIAGNÓSTICO 360°', {
    x: 4.5,
    y: 2.9,
    w: 8,
    h: 0.4,
    fontSize: 11,
    fontFace: 'Calibri',
    color: C.accent,
    bold: true,
    charSpacing: 3,
  });
  s1.addText(health.crossZoneInsight, {
    x: 4.5,
    y: 3.3,
    w: 8.3,
    h: 2.5,
    fontSize: 18,
    fontFace: 'Calibri',
    color: 'FFFFFF',
    valign: 'top',
  });

  s1.addText(`Próxima ação: ${health.nextActionLabel}  |  Janela: ${health.windowLabel}`, {
    x: 4.5,
    y: 6.1,
    w: 8.3,
    h: 0.5,
    fontSize: 12,
    fontFace: 'Calibri',
    color: C.bgLight,
    italic: true,
  });

  // ====================== SLIDE 2 — KPIs ======================
  const s2 = pptx.addSlide();
  s2.background = { color: C.bgLight };
  s2.addText('Visão 360° do cliente', {
    x: 0.5,
    y: 0.4,
    w: 12,
    h: 0.6,
    fontSize: 28,
    fontFace: 'Calibri',
    color: C.text,
    bold: true,
  });
  s2.addText('KPIs principais e share-of-wallet estimado', {
    x: 0.5,
    y: 1.0,
    w: 12,
    h: 0.4,
    fontSize: 13,
    fontFace: 'Calibri',
    color: C.muted,
  });

  const kpis = [
    {
      label: 'LTV TOTAL',
      value: fmtBRL(bi.ltv),
      sub: `${bi.ordersCount} pedidos`,
      color: C.primary,
    },
    { label: 'TICKET MÉDIO', value: fmtBRL(bi.avgTicket), sub: 'por pedido', color: C.accent },
    {
      label: 'ÚLT. COMPRA',
      value: bi.daysSinceLastOrder !== null ? `${bi.daysSinceLastOrder}d` : '—',
      sub: 'atrás',
      color: C.warn,
    },
    {
      label: 'SHARE-OF-WALLET',
      value: `${health.shareOfWalletPct}%`,
      sub: `Potencial: ${fmtBRL(health.potentialUntappedBRL)}`,
      color: C.good,
    },
  ];
  kpis.forEach((k, i) => {
    const x = 0.5 + i * 3.15;
    s2.addShape('rect', {
      x,
      y: 1.8,
      w: 2.95,
      h: 2.5,
      fill: { color: 'FFFFFF' },
      line: { color: 'E2E8F0', width: 1 },
    });
    s2.addShape('rect', {
      x,
      y: 1.8,
      w: 2.95,
      h: 0.15,
      fill: { color: k.color },
      line: { color: k.color },
    });
    s2.addText(k.label, {
      x: x + 0.15,
      y: 2.05,
      w: 2.6,
      h: 0.3,
      fontSize: 10,
      fontFace: 'Calibri',
      color: C.muted,
      bold: true,
      charSpacing: 2,
    });
    s2.addText(k.value, {
      x: x + 0.15,
      y: 2.45,
      w: 2.6,
      h: 1.0,
      fontSize: 32,
      fontFace: 'Calibri',
      color: C.text,
      bold: true,
    });
    s2.addText(k.sub, {
      x: x + 0.15,
      y: 3.55,
      w: 2.6,
      h: 0.4,
      fontSize: 11,
      fontFace: 'Calibri',
      color: C.muted,
    });
  });

  // Bloco Cliente x Setor
  s2.addText('Comparação com o setor', {
    x: 0.5,
    y: 4.6,
    w: 12,
    h: 0.4,
    fontSize: 16,
    fontFace: 'Calibri',
    color: C.text,
    bold: true,
  });
  if (vs.metrics.length > 0) {
    vs.metrics.slice(0, 4).forEach((m, i) => {
      const x = 0.5 + i * 3.15;
      const tone =
        m.classification === 'above' ? C.good : m.classification === 'below' ? C.bad : C.warn;
      const arrow = m.deltaPercent > 0 ? '▲' : m.deltaPercent < 0 ? '▼' : '—';
      s2.addShape('rect', {
        x,
        y: 5.1,
        w: 2.95,
        h: 1.7,
        fill: { color: 'FFFFFF' },
        line: { color: 'E2E8F0', width: 1 },
      });
      s2.addText(m.label, {
        x: x + 0.15,
        y: 5.2,
        w: 2.6,
        h: 0.3,
        fontSize: 10,
        fontFace: 'Calibri',
        color: C.muted,
        bold: true,
      });
      s2.addText(`${arrow} ${Math.abs(Math.round(m.deltaPercent))}%`, {
        x: x + 0.15,
        y: 5.55,
        w: 2.6,
        h: 0.6,
        fontSize: 22,
        fontFace: 'Calibri',
        color: tone,
        bold: true,
      });
      s2.addText(`vs média do setor`, {
        x: x + 0.15,
        y: 6.2,
        w: 2.6,
        h: 0.4,
        fontSize: 9,
        fontFace: 'Calibri',
        color: C.muted,
      });
    });
  } else {
    s2.addText('Amostra do setor insuficiente para benchmark.', {
      x: 0.5,
      y: 5.2,
      w: 12,
      h: 0.5,
      fontSize: 12,
      color: C.muted,
      italic: true,
    });
  }

  // ====================== SLIDE 3 — AFINIDADE & TENDÊNCIAS ======================
  const s3 = pptx.addSlide();
  s3.background = { color: C.bgLight };
  s3.addText('O que vender agora', {
    x: 0.5,
    y: 0.4,
    w: 12,
    h: 0.6,
    fontSize: 28,
    fontFace: 'Calibri',
    color: C.text,
    bold: true,
  });
  s3.addText('Top categorias preferidas + tendências do setor', {
    x: 0.5,
    y: 1.0,
    w: 12,
    h: 0.4,
    fontSize: 13,
    fontFace: 'Calibri',
    color: C.muted,
  });

  // Coluna 1: afinidade
  s3.addText('AFINIDADE DO CLIENTE', {
    x: 0.5,
    y: 1.7,
    w: 6,
    h: 0.3,
    fontSize: 11,
    color: C.primary,
    bold: true,
    charSpacing: 2,
  });
  const topAff = (affinity?.categories ?? []).slice(0, 4);
  topAff.forEach((c, i) => {
    s3.addShape('rect', {
      x: 0.5,
      y: 2.1 + i * 1.1,
      w: 6,
      h: 0.95,
      fill: { color: 'FFFFFF' },
      line: { color: 'E2E8F0', width: 1 },
    });
    s3.addText(c.category, {
      x: 0.7,
      y: 2.2 + i * 1.1,
      w: 4,
      h: 0.4,
      fontSize: 14,
      color: C.text,
      bold: true,
    });
    s3.addText(`${c.count} compras · ${fmtBRL(c.revenue)}`, {
      x: 0.7,
      y: 2.65 + i * 1.1,
      w: 4,
      h: 0.3,
      fontSize: 10,
      color: C.muted,
    });
    if (c.suggestions[0]) {
      s3.addText(c.suggestions[0].name, {
        x: 4.7,
        y: 2.4 + i * 1.1,
        w: 1.7,
        h: 0.5,
        fontSize: 9,
        color: C.accent,
        italic: true,
        align: 'right',
      });
    }
  });
  if (topAff.length === 0) {
    s3.addText('Sem histórico de afinidade ainda.', {
      x: 0.5,
      y: 2.2,
      w: 6,
      h: 0.5,
      fontSize: 12,
      color: C.muted,
      italic: true,
    });
  }

  // Coluna 2: tendências do setor
  s3.addText('TENDÊNCIAS DO SETOR', {
    x: 7.0,
    y: 1.7,
    w: 5.8,
    h: 0.3,
    fontSize: 11,
    color: C.accent,
    bold: true,
    charSpacing: 2,
  });
  const topTrends = (trends?.trends ?? []).slice(0, 5);
  topTrends.forEach((t, i) => {
    s3.addShape('rect', {
      x: 7.0,
      y: 2.1 + i * 0.85,
      w: 5.8,
      h: 0.75,
      fill: { color: 'FFFFFF' },
      line: { color: 'E2E8F0', width: 1 },
    });
    s3.addText(`${i + 1}.`, {
      x: 7.15,
      y: 2.25 + i * 0.85,
      w: 0.4,
      h: 0.4,
      fontSize: 14,
      color: C.muted,
      bold: true,
    });
    s3.addText(t.productName, {
      x: 7.6,
      y: 2.2 + i * 0.85,
      w: 3.2,
      h: 0.3,
      fontSize: 12,
      color: C.text,
      bold: true,
    });
    s3.addText(`${t.category} · ${t.unitsSold.toLocaleString('pt-BR')}u`, {
      x: 7.6,
      y: 2.5 + i * 0.85,
      w: 3.2,
      h: 0.3,
      fontSize: 9,
      color: C.muted,
    });
    s3.addText(fmtBRL(t.avgPrice), {
      x: 11.0,
      y: 2.3 + i * 0.85,
      w: 1.6,
      h: 0.4,
      fontSize: 12,
      color: C.primary,
      bold: true,
      align: 'right',
    });
  });
  if (topTrends.length === 0) {
    s3.addText('Sem tendências do setor disponíveis.', {
      x: 7.0,
      y: 2.2,
      w: 5.8,
      h: 0.5,
      fontSize: 12,
      color: C.muted,
      italic: true,
    });
  }

  // ====================== SLIDE 4 — SAZONALIDADE ======================
  const s4 = pptx.addSlide();
  s4.background = { color: C.bgLight };
  s4.addText('Quando abordar', {
    x: 0.5,
    y: 0.4,
    w: 12,
    h: 0.6,
    fontSize: 28,
    fontFace: 'Calibri',
    color: C.text,
    bold: true,
  });
  s4.addText('Padrão sazonal do cliente · janela ideal de oferta', {
    x: 0.5,
    y: 1.0,
    w: 12,
    h: 0.4,
    fontSize: 13,
    fontFace: 'Calibri',
    color: C.muted,
  });

  // Heatmap simples (12 colunas)
  const monthLabels = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
  ];
  const cellW = 0.95;
  const startX = 1.5;
  s4.addText('Cliente', {
    x: 0.5,
    y: 2.1,
    w: 0.9,
    h: 0.5,
    fontSize: 11,
    color: C.text,
    bold: true,
    valign: 'middle',
  });
  seasonality.client.forEach((c, i) => {
    const intensity = c.intensity;
    const r = Math.round(109 + (76 - 109) * intensity); // gradient violet
    const g = Math.round(40 + (29 - 40) * intensity);
    const b = Math.round(217 + (149 - 217) * intensity);
    const fill =
      intensity > 0.05
        ? `${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase()
        : 'E2E8F0';
    s4.addShape('rect', {
      x: startX + i * cellW,
      y: 2.1,
      w: cellW - 0.05,
      h: 0.7,
      fill: { color: fill },
      line: { color: 'FFFFFF', width: 1 },
    });
    s4.addText(c.quotesCount > 0 ? `${c.quotesCount}` : '—', {
      x: startX + i * cellW,
      y: 2.1,
      w: cellW - 0.05,
      h: 0.7,
      fontSize: 12,
      color: intensity > 0.5 ? 'FFFFFF' : C.text,
      bold: true,
      align: 'center',
      valign: 'middle',
    });
    s4.addText(monthLabels[i], {
      x: startX + i * cellW,
      y: 2.85,
      w: cellW - 0.05,
      h: 0.3,
      fontSize: 9,
      color: C.muted,
      align: 'center',
    });
  });

  // Setor
  s4.addText('Setor', {
    x: 0.5,
    y: 3.4,
    w: 0.9,
    h: 0.5,
    fontSize: 11,
    color: C.muted,
    bold: true,
    valign: 'middle',
  });
  seasonality.industry.forEach((c, i) => {
    const intensity = c.intensity;
    const r = Math.round(109 + (76 - 109) * intensity);
    const g = Math.round(40 + (29 - 40) * intensity);
    const b = Math.round(217 + (149 - 217) * intensity);
    const fill =
      intensity > 0.05
        ? `${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase()
        : 'E2E8F0';
    s4.addShape('rect', {
      x: startX + i * cellW,
      y: 3.4,
      w: cellW - 0.05,
      h: 0.7,
      fill: { color: fill },
      line: { color: 'FFFFFF', width: 1 },
    });
    s4.addText(c.avgQuotesPerCompany > 0 ? c.avgQuotesPerCompany.toFixed(1) : '—', {
      x: startX + i * cellW,
      y: 3.4,
      w: cellW - 0.05,
      h: 0.7,
      fontSize: 11,
      color: intensity > 0.5 ? 'FFFFFF' : C.text,
      bold: true,
      align: 'center',
      valign: 'middle',
    });
  });

  // Insight
  s4.addShape('rect', {
    x: 0.5,
    y: 4.5,
    w: 12.3,
    h: 2.5,
    fill: { color: 'FFFFFF' },
    line: { color: 'E2E8F0', width: 1 },
  });
  s4.addText('INSIGHT SAZONAL', {
    x: 0.7,
    y: 4.65,
    w: 11,
    h: 0.3,
    fontSize: 11,
    color: C.primary,
    bold: true,
    charSpacing: 2,
  });
  s4.addText(seasonality.insight ?? 'Histórico insuficiente para insight sazonal.', {
    x: 0.7,
    y: 5.0,
    w: 11.9,
    h: 1.8,
    fontSize: 14,
    color: C.text,
    valign: 'top',
  });

  // ====================== SLIDE 5 — PRÓXIMA AÇÃO ======================
  const s5 = pptx.addSlide();
  s5.background = { color: C.bg };
  s5.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.5, fill: { color: C.accent } });

  s5.addText('PRÓXIMA AÇÃO', {
    x: 0.8,
    y: 0.9,
    w: 12,
    h: 0.4,
    fontSize: 12,
    color: C.accent,
    bold: true,
    charSpacing: 3,
  });
  s5.addText(health.nextActionLabel, {
    x: 0.8,
    y: 1.4,
    w: 12,
    h: 1.0,
    fontSize: 36,
    color: 'FFFFFF',
    bold: true,
  });
  s5.addText(health.nextActionDetail, {
    x: 0.8,
    y: 2.5,
    w: 12,
    h: 1.2,
    fontSize: 16,
    color: C.bgLight,
    valign: 'top',
  });

  // Card script
  s5.addShape('rect', {
    x: 0.8,
    y: 4.0,
    w: 12,
    h: 2.0,
    fill: { color: '1E293B' },
    line: { color: C.primary, width: 2 },
  });
  s5.addText('📞 SCRIPT DE ABERTURA', {
    x: 1.0,
    y: 4.15,
    w: 11,
    h: 0.4,
    fontSize: 11,
    color: C.accent,
    bold: true,
    charSpacing: 2,
  });
  s5.addText(`"${health.scriptHint}"`, {
    x: 1.0,
    y: 4.55,
    w: 11.6,
    h: 1.4,
    fontSize: 18,
    color: 'FFFFFF',
    italic: true,
    valign: 'top',
  });

  s5.addText(
    `Janela ideal: ${health.windowLabel}  |  Share-of-wallet: ${health.shareOfWalletPct}%  |  Potencial: ${fmtBRL(health.potentialUntappedBRL)}`,
    {
      x: 0.8,
      y: 6.4,
      w: 12,
      h: 0.5,
      fontSize: 12,
      color: C.bgLight,
      italic: true,
      align: 'center',
    },
  );

  s5.addText('Promo Gifts · Business Analytic', {
    x: 0.8,
    y: 7.05,
    w: 12,
    h: 0.3,
    fontSize: 9,
    color: C.muted,
    align: 'center',
    charSpacing: 2,
  });

  // ====================== SLIDE 6 — MAPA DE CATEGORIAS ======================
  if (categorySection?.hasData) {
    const s6 = pptx.addSlide();
    s6.background = { color: C.bgLight };
    s6.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.5, fill: { color: C.primary } });

    s6.addText('MAPA DE CATEGORIAS', {
      x: 0.8,
      y: 0.7,
      w: 12,
      h: 0.4,
      fontSize: 11,
      color: C.primary,
      bold: true,
      charSpacing: 3,
    });
    s6.addText('Cliente × Setor — onde concentrar esforço comercial', {
      x: 0.8,
      y: 1.05,
      w: 12,
      h: 0.5,
      fontSize: 18,
      color: C.text,
      bold: true,
    });
    if (categorySection.isMock) {
      s6.addText('Dados parcialmente simulados', {
        x: 10.5,
        y: 0.7,
        w: 2.5,
        h: 0.3,
        fontSize: 9,
        color: C.warn,
        italic: true,
        align: 'right',
      });
    }

    // Tabela: Categoria | Cliente % | Setor % | Tendência
    const headerRow = [
      {
        text: 'Categoria',
        options: { bold: true, color: 'FFFFFF', fill: { color: C.primary }, fontSize: 11 },
      },
      {
        text: 'Cliente',
        options: {
          bold: true,
          color: 'FFFFFF',
          fill: { color: C.primary },
          fontSize: 11,
          align: 'center' as const,
        },
      },
      {
        text: 'Setor',
        options: {
          bold: true,
          color: 'FFFFFF',
          fill: { color: C.primary },
          fontSize: 11,
          align: 'center' as const,
        },
      },
      {
        text: 'Tendência',
        options: {
          bold: true,
          color: 'FFFFFF',
          fill: { color: C.primary },
          fontSize: 11,
          align: 'center' as const,
        },
      },
    ];
    const trendSymbol = (t: string) =>
      t === 'up' ? '▲' : t === 'down' ? '▼' : t === 'stable' ? '■' : '—';
    const trendColor = (t: string) => (t === 'up' ? C.good : t === 'down' ? C.bad : C.muted);
    const dataRows = categorySection.rows.slice(0, 6).map((r) => [
      { text: r.label, options: { fontSize: 11, color: C.text } },
      {
        text: `${r.clientSharePct.toFixed(0)}%`,
        options: { fontSize: 11, color: C.text, align: 'center' as const, bold: true },
      },
      {
        text: `${r.industrySharePct.toFixed(0)}%`,
        options: { fontSize: 11, color: C.muted, align: 'center' as const },
      },
      {
        text: `${trendSymbol(r.trend)} ${r.deltaPct !== null ? `${r.deltaPct > 0 ? '+' : ''}${Math.round(r.deltaPct)}%` : '—'}`,
        options: { fontSize: 11, color: trendColor(r.trend), align: 'center' as const, bold: true },
      },
    ]);

    s6.addTable([headerRow, ...dataRows], {
      x: 0.8,
      y: 1.7,
      w: 7.5,
      colW: [3.0, 1.5, 1.5, 1.5],
      border: { type: 'solid', color: 'E2E8F0', pt: 1 },
      rowH: 0.4,
    });

    // Box "Oportunidades GAP" (lado direito)
    s6.addShape('rect', {
      x: 8.6,
      y: 1.7,
      w: 4.0,
      h: 3.6,
      fill: { color: 'FAF5FF' },
      line: { color: C.primary, width: 1.5 },
    });
    s6.addText('⚡ OPORTUNIDADES GAP', {
      x: 8.8,
      y: 1.85,
      w: 3.6,
      h: 0.35,
      fontSize: 11,
      color: C.primary,
      bold: true,
      charSpacing: 2,
    });
    if (categorySection.gaps.length === 0) {
      s6.addText('Sem GAPs relevantes — cliente alinhado ao mix do setor.', {
        x: 8.8,
        y: 2.3,
        w: 3.6,
        h: 1.5,
        fontSize: 12,
        color: C.muted,
        italic: true,
        valign: 'top',
      });
    } else {
      const gapBullets = categorySection.gaps.slice(0, 4).map((g) => ({
        text: `${g.label} — ${g.industrySharePct.toFixed(0)}% do setor`,
        options: { bullet: { code: '25CF' }, fontSize: 12, color: C.text, paraSpaceAfter: 6 },
      }));
      s6.addText(gapBullets, {
        x: 8.8,
        y: 2.3,
        w: 3.6,
        h: 2.9,
        valign: 'top',
      });
    }

    // Insight no rodapé
    s6.addShape('rect', {
      x: 0.8,
      y: 5.6,
      w: 11.7,
      h: 1.3,
      fill: { color: C.bg },
      line: { color: C.accent, width: 1.5 },
    });
    s6.addText('💡 INSIGHT', {
      x: 1.0,
      y: 5.75,
      w: 11.3,
      h: 0.3,
      fontSize: 10,
      color: C.accent,
      bold: true,
      charSpacing: 2,
    });
    s6.addText(categorySection.insight, {
      x: 1.0,
      y: 6.05,
      w: 11.3,
      h: 0.85,
      fontSize: 13,
      color: 'FFFFFF',
      italic: true,
      valign: 'top',
    });

    s6.addText('Promo Gifts · Business Analytic — Mapa de Categorias', {
      x: 0.8,
      y: 7.05,
      w: 12,
      h: 0.3,
      fontSize: 9,
      color: C.muted,
      align: 'center',
      charSpacing: 2,
    });
  }

  // ====================== EXPORT ======================
  const safeName = clientName
    .replace(/[^\w\sÀ-ú-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60);
  const date = new Date().toISOString().slice(0, 10);
  await pptx.writeFile({ fileName: `BI-${safeName}-${date}.pptx` });
}
