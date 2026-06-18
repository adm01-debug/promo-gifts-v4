/**
 * useQuotesDashboard — Business logic hook for QuotesDashboardPage.
 * Manages metrics computation, client fetching, token stats, and PDF export.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { selectCrm } from '@/lib/crm-db';
import { useQuotes } from '@/hooks/quotes';
import { format, differenceInHours, startOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
// jsPDF + jspdf-autotable são carregados sob demanda (dynamic import) dentro de
// exportToPdf, mantendo ~bibliotecas pesadas fora do chunk da rota de orçamentos.
import { QUOTE_STATUS_CONFIG } from '@/lib/quote-status-config';

import { logger } from '@/lib/logger';
interface Client {
  id: string;
  name: string;
  nome_fantasia?: string;
}

const statusConfig = Object.fromEntries(
  Object.entries(QUOTE_STATUS_CONFIG).map(([k, v]) => [k, { label: v.label, color: v.color }]),
) as Record<string, { label: string; color: string }>;

export { statusConfig };

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatResponseTime(hours: number) {
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.floor(hours / 24);
  const rem = Math.round(hours % 24);
  return rem > 0 ? `${days}d ${rem}h` : `${days}d`;
}

export function useQuotesDashboard() {
  const { quotes, isLoading } = useQuotes();
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [selectedClientId, setSelectedClientId] = useState<string>('all');
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);

  useEffect(() => {
    (async () => {
      setLoadingClients(true);
      try {
        const data = await selectCrm<Client>('companies', {
          select: 'id,nome_fantasia',
          orderBy: 'nome_fantasia',
          limit: 500,
        });
        setClients(data.map((c: Client) => ({ id: c.id, name: c.nome_fantasia || c.id })));
      } catch (err) {
        logger.error('Error fetching clients:', err);
      }
      setLoadingClients(false);
    })();
  }, []);

  const quotesClients = useMemo(() => {
    const map = new Map<string, string>();
    quotes.forEach((q) => {
      if (q.client_id && q.client_name) map.set(q.client_id, q.client_name);
    });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [quotes]);

  const selectedClientName = useMemo(() => {
    if (selectedClientId === 'all') return null;
    return (
      clients.find((c) => c.id === selectedClientId)?.name ||
      quotesClients.find((c) => c.id === selectedClientId)?.name ||
      null
    );
  }, [selectedClientId, clients, quotesClients]);

  const metrics = useMemo(() => {
    if (!quotes.length)
      return {
        totalQuotes: 0,
        totalValue: 0,
        approvedValue: 0,
        approvalRate: 0,
        rejectionRate: 0,
        averageResponseTime: 0,
        averageValue: 0,
        pendingQuotes: 0,
        statusDistribution: [] as { name: string; value: number; color: string }[],
        monthlyData: [] as {
          month: string;
          total: number;
          approved: number;
          rejected: number;
          value: number;
        }[],
        conversionFunnel: [] as { stage: string; count: number; fill: string }[],
      };

    const now = new Date();
    let startDate: Date;
    switch (selectedPeriod) {
      case 'month':
        startDate = startOfMonth(now);
        break;
      case 'quarter':
        startDate = subMonths(startOfMonth(now), 2);
        break;
      case 'year':
        startDate = subMonths(startOfMonth(now), 11);
        break;
    }

    let filtered = quotes.filter((q) => new Date(q.created_at ?? 0) >= startDate);
    if (selectedClientId !== 'all')
      filtered = filtered.filter((q) => q.client_id === selectedClientId);

    const totalQuotes = filtered.length;
    const totalValue = filtered.reduce((s, q) => s + (q.total ?? 0), 0);
    const approved = filtered.filter((q) => q.status === 'approved');
    const rejected = filtered.filter((q) => q.status === 'rejected');
    const pending = filtered.filter((q) => ['pending', 'sent'].includes(q.status));
    const approvedValue = approved.reduce((s, q) => s + (q.total ?? 0), 0);
    const responded = [...approved, ...rejected];
    const approvalRate = responded.length > 0 ? (approved.length / responded.length) * 100 : 0;
    const rejectionRate = responded.length > 0 ? (rejected.length / responded.length) * 100 : 0;

    const withResponse = filtered.filter(
      (q) => q.client_response_at && (q.status === 'approved' || q.status === 'rejected'),
    );
    let averageResponseTime = 0;
    if (withResponse.length > 0) {
      averageResponseTime =
        withResponse.reduce((s, q) => {
          if (!q.client_response_at) return s;
          return s + differenceInHours(new Date(q.client_response_at), new Date(q.created_at ?? 0));
        }, 0) / withResponse.length;
    }

    const statusCounts = filtered.reduce(
      (a, q) => {
        a[q.status] = (a[q.status] || 0) + 1;
        return a;
      },
      {} as Record<string, number>,
    );
    const statusDistribution = Object.entries(statusCounts).map(([status, count]) => ({
      name: statusConfig[status]?.label || status,
      value: count,
      color: statusConfig[status]?.color || 'hsl(var(--muted))',
    }));

    const monthlyGroups = filtered.reduce(
      (a, q) => {
        const m = format(new Date(q.created_at ?? 0), 'MMM', { locale: ptBR });
        if (!a[m]) a[m] = { month: m, total: 0, approved: 0, rejected: 0, value: 0 };
        a[m].total++;
        if (q.status === 'approved') {
          a[m].approved++;
          a[m].value += q.total ?? 0;
        }
        if (q.status === 'rejected') a[m].rejected++;
        return a;
      },
      {} as Record<
        string,
        { month: string; total: number; approved: number; rejected: number; value: number }
      >,
    );

    const conversionFunnel = [
      { stage: 'Criados', count: totalQuotes, fill: 'hsl(var(--primary))' },
      {
        stage: 'Enviados',
        count: filtered.filter((q) => ['sent', 'approved', 'rejected'].includes(q.status)).length,
        fill: 'hsl(var(--info))',
      },
      { stage: 'Respondidos', count: responded.length, fill: 'hsl(var(--warning))' },
      { stage: 'Aprovados', count: approved.length, fill: 'hsl(var(--success))' },
    ];

    return {
      totalQuotes,
      totalValue,
      approvedValue,
      approvalRate,
      rejectionRate,
      averageResponseTime,
      averageValue: totalQuotes > 0 ? totalValue / totalQuotes : 0,
      pendingQuotes: pending.length,
      statusDistribution,
      monthlyData: Object.values(monthlyGroups),
      conversionFunnel,
    };
  }, [quotes, selectedPeriod, selectedClientId]);

  const exportToPdf = useCallback(async () => {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const doc = new jsPDF();
    const periodLabel =
      selectedPeriod === 'month' ? 'Mês Atual' : selectedPeriod === 'quarter' ? 'Trimestre' : 'Ano';
    const now = new Date();

    doc.setFontSize(18);
    doc.text('Dashboard de Conversão de Orçamentos', 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(
      `Período: ${periodLabel} • Gerado em ${format(now, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
      14,
      28,
    );
    if (selectedClientName) doc.text(`Cliente: ${selectedClientName}`, 14, 34);

    doc.setTextColor(0);
    autoTable(doc, {
      startY: selectedClientName ? 40 : 34,
      head: [['Métrica', 'Valor']],
      body: [
        ['Total de Orçamentos', metrics.totalQuotes.toString()],
        ['Pendentes', metrics.pendingQuotes.toString()],
        ['Taxa de Aprovação', `${metrics.approvalRate.toFixed(1)}%`],
        ['Taxa de Rejeição', `${metrics.rejectionRate.toFixed(1)}%`],
        ['Tempo Médio de Resposta', formatResponseTime(metrics.averageResponseTime)],
        ['Valor Total Orçado', formatCurrency(metrics.totalValue)],
        ['Valor Total Aprovado', formatCurrency(metrics.approvedValue)],
        ['Ticket Médio', formatCurrency(metrics.averageValue)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [245, 158, 11] },
      styles: { fontSize: 10 },
    });

    if (metrics.statusDistribution.length > 0) {
      const y = doc.lastAutoTable?.finalY || 80;
      doc.setFontSize(13);
      doc.text('Distribuição por Status', 14, y + 12);
      autoTable(doc, {
        startY: y + 16,
        head: [['Status', 'Quantidade']],
        body: metrics.statusDistribution.map((s) => [s.name, s.value.toString()]),
        theme: 'grid',
        headStyles: { fillColor: [245, 158, 11] },
        styles: { fontSize: 10 },
      });
    }

    if (metrics.conversionFunnel.length > 0) {
      const y = doc.lastAutoTable?.finalY || 120;
      doc.setFontSize(13);
      doc.text('Funil de Conversão', 14, y + 12);
      autoTable(doc, {
        startY: y + 16,
        head: [['Etapa', 'Quantidade']],
        body: metrics.conversionFunnel.map((f) => [f.stage, f.count.toString()]),
        theme: 'grid',
        headStyles: { fillColor: [245, 158, 11] },
        styles: { fontSize: 10 },
      });
    }

    const recentResponses = quotes
      .filter((q) => q.client_response_at)
      .sort((a, b) => {
        const bResponseAt = b.client_response_at ?? '';
        const aResponseAt = a.client_response_at ?? '';
        return new Date(bResponseAt).getTime() - new Date(aResponseAt).getTime();
      })
      .slice(0, 10);

    if (recentResponses.length > 0) {
      const y = doc.lastAutoTable?.finalY || 200;
      if (y > 240) doc.addPage();
      const startY = y > 240 ? 20 : y + 12;
      doc.setFontSize(13);
      doc.text('Últimas Respostas de Clientes', 14, startY);
      autoTable(doc, {
        startY: startY + 4,
        head: [['Orçamento', 'Status', 'Data', 'Valor']],
        body: recentResponses.map((q) => [
          q.quote_number || (q.id ?? ''),
          statusConfig[q.status]?.label || q.status,
          q.client_response_at ? format(new Date(q.client_response_at), 'dd/MM/yyyy HH:mm') : '-',
          formatCurrency(q.total ?? 0),
        ]),
        theme: 'grid',
        headStyles: { fillColor: [245, 158, 11] },
        styles: { fontSize: 9 },
      });
    }

    doc.save(`dashboard-orcamentos-${format(now, 'yyyy-MM-dd')}.pdf`);
  }, [metrics, quotes, selectedPeriod, selectedClientName]);

  return {
    quotes,
    isLoading,
    selectedPeriod,
    setSelectedPeriod,
    selectedClientId,
    setSelectedClientId,
    clients,
    quotesClients,
    loadingClients,
    selectedClientName,
    metrics,
    exportToPdf,
  };
}
