/**
 * useMedallionHealth — observabilidade do pipeline Medallion (Bronze→Prata→Ouro)
 * lida diretamente das views Ouro de monitoramento do SSOT:
 *
 *   - vw_medallion_coverage: cobertura de enriquecimento por fornecedor/camada
 *     (NCM, materiais, tags, meta, IPI, descrição, categoria, display_name)
 *   - v_pipeline_progress:   progresso das fases do pipeline (etapas concluídas,
 *     em andamento, com erro, pendentes, % completo)
 *
 * Consumido pelo MedallionPipelineCard em /system/status.
 */
import { useQuery } from '@tanstack/react-query';
import {
  goldFrom,
  type MedallionCoverageRow,
  type PipelineProgressRow,
} from '@/integrations/supabase/gold';

export interface MedallionHealth {
  coverage: MedallionCoverageRow[];
  progress: PipelineProgressRow[];
}

async function fetchMedallionHealth(): Promise<MedallionHealth> {
  const [coverageRes, progressRes] = await Promise.all([
    goldFrom('vw_medallion_coverage').select('*').order('fornecedor', { ascending: true }),
    goldFrom('v_pipeline_progress').select('*').order('fase', { ascending: true }),
  ]);

  if (coverageRes.error) throw new Error(coverageRes.error.message);
  if (progressRes.error) throw new Error(progressRes.error.message);

  return {
    coverage: (coverageRes.data ?? []) as unknown as MedallionCoverageRow[],
    progress: (progressRes.data ?? []) as unknown as PipelineProgressRow[],
  };
}

export function useMedallionHealth() {
  return useQuery({
    queryKey: ['medallion-health'],
    queryFn: fetchMedallionHealth,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
