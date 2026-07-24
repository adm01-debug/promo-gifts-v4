/**
 * ExecutiveSummaryButton — gera resumo executivo (3 parágrafos) e copia/exporta.
 * Inclui também export PPTX (5 slides) ao lado do PDF dossiê.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Copy, Loader2, Sparkles, Presentation } from 'lucide-react';
import { toast } from 'sonner';
import { useClientHealthScore } from '@/hooks/bi/useClientHealthScore';
import { useClientBI } from '@/hooks/bi/useClientBI';
import { useClientAffinity } from '@/hooks/bi/useClientAffinity';
import { useIndustryTrends } from '@/hooks/bi/useIndustryTrends';
import { useClientSeasonality } from '@/hooks/bi/useClientSeasonality';
import { useClientVsIndustry } from '@/hooks/bi/useClientVsIndustry';
import { useClientCategoryAffinity } from '@/hooks/bi/useClientCategoryAffinity';
import { useIndustryCategoryTrends } from '@/hooks/bi/useIndustryCategoryTrends';
// Lazy: pptxgenjs carrega só ao exportar (evita +369KB no bundle inicial)
// import { generateBIPptx } from '@/lib/bi/pptxGenerator';
import { buildCategorySection } from '@/lib/bi/executive-summary';

import { logger } from '@/lib/logger';
interface Props {
  clientId: string;
  clientName: string;
  ramoAtividade: string | null;
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export function ExecutiveSummaryButton({ clientId, clientName, ramoAtividade }: Props) {
  const [busy, setBusy] = useState<'copy' | 'pptx' | null>(null);
  const health = useClientHealthScore(clientId, ramoAtividade);
  const bi = useClientBI(clientId);
  const affinity = useClientAffinity(clientId);
  const trends = useIndustryTrends(ramoAtividade);
  const seas = useClientSeasonality(clientId, ramoAtividade);
  const vs = useClientVsIndustry(clientId, ramoAtividade);
  const catAffinity = useClientCategoryAffinity(clientId);
  const catIndustry = useIndustryCategoryTrends(ramoAtividade);

  const handleCopy = async () => {
    setBusy('copy');
    try {
      const tier =
        health.tier === 'healthy'
          ? 'saudável'
          : health.tier === 'attention'
            ? 'em atenção'
            : 'em risco';
      const topCategoria = affinity.data?.categories?.[0]?.category ?? '—';
      const topTrend = trends.data?.trends?.[0]?.productName ?? '—';

      const summary = [
        `📊 Resumo executivo — ${clientName}${ramoAtividade ? ` (${ramoAtividade})` : ''}`,
        ``,
        `▸ Saúde: cliente ${tier} (Health Score ${health.score}/100). ${health.crossZoneInsight}`,
        ``,
        `▸ Histórico: LTV ${fmtBRL(bi.ltv)} em ${bi.ordersCount} pedidos · ticket médio ${fmtBRL(bi.avgTicket)}${bi.daysSinceLastOrder !== null ? ` · última compra há ${bi.daysSinceLastOrder} dias` : ''}. Categoria forte: ${topCategoria}.`,
        ``,
        `▸ Oportunidade: share-of-wallet estimado em ${health.shareOfWalletPct}% (potencial não capturado: ${fmtBRL(health.potentialUntappedBRL)}). ${health.windowLabel}. Próxima ação: ${health.nextActionLabel} — ${health.nextActionDetail}`,
        ``,
        `▸ Setor: top tendência atual é "${topTrend}". ${seas.insight ?? ''}`,
        ``,
        `📞 Script: "${health.scriptHint}"`,
      ].join('\n');

      await navigator.clipboard.writeText(summary);
      toast.success('Resumo executivo copiado!', {
        description: 'Cole no WhatsApp, e-mail ou CRM.',
      });
    } catch {
      toast.error('Erro ao copiar', {
        description: 'Não foi possível copiar o resumo. Tente novamente.',
      });
    } finally {
      setBusy(null);
    }
  };

  const handlePptx = async () => {
    setBusy('pptx');
    try {
      const { generateBIPptx } = await import('@/lib/bi/pptxGenerator');
      await generateBIPptx({
        clientName,
        ramoAtividade,
        health,
        bi,
        affinity: affinity.data ?? null,
        trends: trends.data ?? null,
        seasonality: seas,
        vs,
        categorySection: buildCategorySection(catAffinity, catIndustry),
      });
      toast.success('PPTX gerado!', { description: 'Arquivo baixado.' });
    } catch (e) {
      logger.error('Executive summary PPTX generation failed', e);
      toast.error('Falha ao gerar PPTX', {
        description: 'Não foi possível gerar o arquivo. Tente novamente.',
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5" disabled={busy !== null}>
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 text-violet-500" />
          )}
          Resumo
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs">Resumo executivo</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleCopy} disabled={busy !== null} className="gap-2">
          <Copy className="h-4 w-4" />
          <div className="flex flex-col">
            <span className="text-sm">Copiar para WhatsApp</span>
            <span className="text-[10px] text-muted-foreground">3 parágrafos prontos</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePptx} disabled={busy !== null} className="gap-2">
          <Presentation className="h-4 w-4" />
          <div className="flex flex-col">
            <span className="text-sm">Exportar PPTX (5 slides)</span>
            <span className="text-[10px] text-muted-foreground">Para reunião comercial</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
