/**
 * useBIDossierExport — orquestra todos os hooks do BI e gera o PDF do dossiê.
 * Aguarda todos resolverem antes de exportar (nada de PDF parcial).
 */
import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCrmCompany } from '@/hooks/crm';
import { useClientBI } from '@/hooks/bi/useClientBI';
import { useClientVsIndustry } from '@/hooks/bi/useClientVsIndustry';
import { useClientAffinity } from '@/hooks/bi/useClientAffinity';
import { useIndustryTrends } from '@/hooks/bi/useIndustryTrends';
import { useClientCategoryAffinity } from '@/hooks/bi/useClientCategoryAffinity';
import { useIndustryCategoryTrends } from '@/hooks/bi/useIndustryCategoryTrends';
import { resolveIndustryRecommendation } from '@/lib/bi/industryRecommendations';
import { generateBIDossierPDF, buildDossierFileName } from '@/lib/bi/dossierPdfGenerator';
import { buildCategorySection } from '@/lib/bi/executive-summary';
import { getCompanyDisplayName } from '@/types/crm';

interface UseBIDossierExport {
  isReady: boolean;
  isExporting: boolean;
  exportPDF: () => Promise<void>;
}

export function useBIDossierExport(clientId: string | null): UseBIDossierExport {
  const { user, profile } = useAuth();
  const { data: company, isLoading: companyLoading } = useCrmCompany(clientId);
  const ramo = company?.ramo_atividade ?? null;

  const clientBI = useClientBI(clientId ?? undefined);
  const vsIndustry = useClientVsIndustry(clientId, ramo);
  const affinityQ = useClientAffinity(clientId ?? undefined);
  const trendsQ = useIndustryTrends(ramo);
  const catAffinity = useClientCategoryAffinity(clientId ?? undefined);
  const catIndustry = useIndustryCategoryTrends(ramo);

  const [isExporting, setIsExporting] = useState(false);

  const isReady = useMemo(() => {
    if (!clientId) return false;
    if (companyLoading) return false;
    if (clientBI.isLoading || vsIndustry.isLoading) return false;
    if (affinityQ.isLoading) return false;
    if (catAffinity.isLoading) return false;
    if (ramo && (trendsQ.isLoading || catIndustry.isLoading)) return false;
    return true;
  }, [
    clientId,
    companyLoading,
    clientBI.isLoading,
    vsIndustry.isLoading,
    affinityQ.isLoading,
    trendsQ.isLoading,
    catAffinity.isLoading,
    catIndustry.isLoading,
    ramo,
  ]);

  const exportPDF = useCallback(async () => {
    if (!clientId || !company || !isReady) return;
    setIsExporting(true);
    try {
      const blob = generateBIDossierPDF({
        client: {
          name: getCompanyDisplayName(company),
          cnpj: company.cnpj,
          ramo,
          cidade: company.cidade,
          estado: company.estado,
        },
        sellerName: profile?.full_name || user?.email || '—',
        clientBI,
        vsIndustry,
        affinity: affinityQ.data ?? {
          isMock: true,
          realProductsCount: 0,
          categories: [],
          topProducts: [],
        },
        industryTrends: trendsQ.data ?? {
          isMock: true,
          companiesInRamo: 0,
          trends: [],
        },
        empiricalRec: resolveIndustryRecommendation(ramo),
        categorySection: buildCategorySection(catAffinity, catIndustry),
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = buildDossierFileName(getCompanyDisplayName(company));
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }, [
    clientId,
    company,
    isReady,
    profile,
    user,
    clientBI,
    vsIndustry,
    affinityQ.data,
    trendsQ.data,
    catAffinity,
    catIndustry,
    ramo,
  ]);

  return { isReady, isExporting, exportPDF };
}
