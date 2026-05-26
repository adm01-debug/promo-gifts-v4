/**
 * useEngravingWizard — Business logic for the engraving wizard
 *
 * Sprint 2 fixes (audit 26/05/2026):
 *   BUG-02: table name corrected to 'tecnicas_gravacao' (plural)
 *   BUG-05: handleDeleteArea uses state — exposes deleteAreaConfirm/confirmDeleteArea/cancelDeleteArea
 *
 * Sprint 3 fixes (26/05/2026):
 *   BUG-03: flushLocalAreas(newProductId) — persists localAreas to DB after product creation.
 *            AdminProductFormPage calls this before navigating to edit mode.
 *   BUG-28: console.warn when technique not found in cache (likely deleted from DB)
 */
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { sanitizeError } from '@/lib/security/sanitize-error';
import {
  DEFAULT_DETAIL_FORM,
  type ExternalTechnique,
  type PrintAreaTechnique,
  type EnrichedArea,
  type WizardStep,
  type DetailFormState,
} from './types';

export function useEngravingWizard(productId: string | undefined, isEdit: boolean) {
  const queryClient = useQueryClient();
  const [wizardStep, setWizardStep] = useState<WizardStep>('list');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [selectedComponent, setSelectedComponent] = useState<{ code: string; name: string } | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{ code: string; name: string } | null>(null);
  const [selectedTechnique, setSelectedTechnique] = useState<ExternalTechnique | null>(null);
  const [customComponent, setCustomComponent] = useState('');
  const [customLocation, setCustomLocation] = useState('');
  const [techSearch, setTechSearch] = useState('');
  const [detailForm, setDetailForm] = useState<DetailFormState>(DEFAULT_DETAIL_FORM);
  const [localAreas, setLocalAreas] = useState<
    (PrintAreaTechnique & { _techData?: ExternalTechnique })[]
  >([]);

  // BUG-05: state-based delete confirmation — no more confirm()
  const [deleteAreaConfirm, setDeleteAreaConfirm] = useState<EnrichedArea | null>(null);

  // BUG-03: ref always holds the latest localAreas so flushLocalAreas (stable useCallback) can read it
  const localAreasRef = useRef(localAreas);
  useEffect(() => {
    localAreasRef.current = localAreas;
  }, [localAreas]);

  // BUG-02 FIX: correct table name 'tecnicas_gravacao' (plural)
  const { data: techniques = [], isLoading: loadingTechs } = useQuery({
    queryKey: ['external-techniques-catalog'],
    queryFn: async (): Promise<ExternalTechnique[]> => {
      const { data, error } = await supabase.functions.invoke('external-db-bridge', {
        body: {
          table: 'tecnicas_gravacao',
          operation: 'select',
          orderBy: { column: 'nome', ascending: true },
          limit: 200,
        },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Erro ao buscar técnicas');
      return data.data?.records || [];
    },
    staleTime: 10 * 60 * 1000,
  });

  const techById = useMemo(() => {
    const map = new Map<string, ExternalTechnique>();
    for (const t of techniques) map.set(t.id, t);
    return map;
  }, [techniques]);

  const { data: savedAreas = [], isLoading: loadingAreas } = useQuery({
    queryKey: ['print-area-techniques', productId],
    queryFn: async (): Promise<EnrichedArea[]> => {
      const { data, error } = await supabase.functions.invoke('external-db-bridge', {
        body: {
          table: 'print_area_techniques',
          operation: 'select',
          filters: { product_id: productId },
          orderBy: { column: 'technique_order', ascending: true },
          limit: 100,
        },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Erro ao buscar áreas');
      const records: PrintAreaTechnique[] = data.data?.records || [];
      return records.map((area) => enrichArea(area, techById));
    },
    enabled: !!productId && isEdit && techniques.length > 0,
  });

  const enrichedLocalAreas = useMemo(
    (): EnrichedArea[] => localAreas.map((area) => enrichArea(area, techById, area._techData)),
    [localAreas, techById],
  );

  const displayAreas: EnrichedArea[] = isEdit && productId ? savedAreas : enrichedLocalAreas;

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['print-area-techniques', productId] });

  const createMutation = useMutation({
    mutationFn: async (area: Omit<PrintAreaTechnique, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase.functions.invoke('external-db-bridge', {
        body: { table: 'print_area_techniques', operation: 'insert', data: area },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Erro ao criar área');
    },
    onSuccess: () => { invalidate(); toast.success('Área de personalização adicionada'); },
    onError: (e: unknown) => toast.error(sanitizeError(e)),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke('external-db-bridge', {
        body: { table: 'print_area_techniques', operation: 'update', id, data: payload },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Erro ao atualizar área');
    },
    onSuccess: () => { invalidate(); toast.success('Área atualizada'); },
    onError: (e: unknown) => toast.error(sanitizeError(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke('external-db-bridge', {
        body: { table: 'print_area_techniques', operation: 'delete', id },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Erro ao excluir área');
    },
    onSuccess: () => { invalidate(); toast.success('Área removida'); },
    onError: (e: unknown) => toast.error(sanitizeError(e)),
  });

  const resetWizard = useCallback(() => {
    setWizardStep('list');
    setSelectedComponent(null);
    setSelectedLocation(null);
    setSelectedTechnique(null);
    setCustomComponent('');
    setCustomLocation('');
    setTechSearch('');
    setDetailForm(DEFAULT_DETAIL_FORM);
  }, []);

  const startWizard = useCallback(() => { resetWizard(); setWizardStep('component'); }, [resetWizard]);
  const handleSelectComponent = useCallback((comp: { code: string; name: string }) => {
    setSelectedComponent(comp); setWizardStep('location');
  }, []);
  const handleSelectLocation = useCallback((loc: { code: string; name: string }) => {
    setSelectedLocation(loc); setWizardStep('technique');
  }, []);
  const handleSelectTechnique = useCallback((tech: ExternalTechnique) => {
    setSelectedTechnique(tech); setWizardStep('details');
  }, []);

  const handleSaveArea = useCallback(() => {
    if (!selectedComponent || !selectedLocation || !selectedTechnique) return;
    const locationCode = `${selectedComponent.code}-${selectedLocation.code}`.toUpperCase();
    const locationName = `${selectedComponent.name} > ${selectedLocation.name}`;
    const newArea: Omit<PrintAreaTechnique, 'id' | 'created_at' | 'updated_at'> = {
      product_id: productId || 'pending',
      tabela_preco_id: selectedTechnique.id,
      location_code: locationCode,
      location_name: locationName,
      location_order: displayAreas.length,
      max_width: detailForm.max_width,
      max_height: detailForm.max_height,
      is_curved: detailForm.is_curved,
      shape: detailForm.shape,
      technique_order: displayAreas.length + 1,
      is_active: detailForm.is_active,
      notes: detailForm.notes || null,
      unit_cost: detailForm.unit_cost,
    };
    if (isEdit && productId) {
      createMutation.mutate(newArea);
    } else {
      // BUG-03: stored locally with product_id='pending'.
      // AdminProductFormPage calls flushLocalAreas(newId) before navigating to edit mode.
      setLocalAreas((prev) => [
        ...prev,
        { ...newArea, id: `local-${Date.now()}`, _techData: selectedTechnique } as PrintAreaTechnique & { _techData?: ExternalTechnique },
      ]);
      toast.success('Área adicionada (será salva junto ao produto)');
    }
    resetWizard();
  }, [selectedComponent, selectedLocation, selectedTechnique, detailForm, productId, isEdit, displayAreas.length, createMutation, resetWizard]);

  // BUG-03 FIX: flush all pending localAreas to DB using the newly created product's ID.
  // Called by AdminProductFormPage BEFORE navigate() so areas are available in edit mode.
  // Uses localAreasRef (always current) so useCallback can have empty deps (stable ref).
  const flushLocalAreas = useCallback(async (newProductId: string): Promise<void> => {
    const areas = localAreasRef.current.filter((a) => a.id.startsWith('local-'));
    if (areas.length === 0) return;
    const results = await Promise.allSettled(
      areas.map(async (area) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _id, _techData: _td, ...areaData } = area as PrintAreaTechnique & { _techData?: ExternalTechnique };
        const { data, error } = await supabase.functions.invoke('external-db-bridge', {
          body: {
            table: 'print_area_techniques',
            operation: 'insert',
            data: { ...areaData, product_id: newProductId },
          },
        });
        if (error) throw new Error(error.message);
        if (!data?.success) throw new Error(data?.error || 'Erro ao salvar área de gravação');
      }),
    );
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0) {
      toast.warning(`${areas.length - failed}/${areas.length} áreas de gravação salvas — ${failed} falha(s).`);
    } else {
      toast.success(`${areas.length} área(s) de gravação salvas com o produto`);
    }
    setLocalAreas([]); // clear after flush
  }, []); // stable — reads localAreasRef.current which is always up-to-date

  // BUG-05: state-based delete confirmation
  const handleDeleteArea = useCallback((area: EnrichedArea) => {
    setDeleteAreaConfirm(area);
  }, []);

  const confirmDeleteArea = useCallback(() => {
    if (!deleteAreaConfirm) return;
    const area = deleteAreaConfirm;
    setDeleteAreaConfirm(null);
    if (isEdit && area.id && !area.id.startsWith('local-')) {
      deleteMutation.mutate(area.id);
    } else {
      setLocalAreas((prev) => prev.filter((a) => a.id !== area.id));
      toast.success('Área removida');
    }
  }, [deleteAreaConfirm, isEdit, deleteMutation]);

  const cancelDeleteArea = useCallback(() => setDeleteAreaConfirm(null), []);

  const handleToggleActive = useCallback((area: EnrichedArea) => {
    if (isEdit && area.id && !area.id.startsWith('local-')) {
      updateMutation.mutate({ id: area.id, is_active: !area.is_active });
    } else {
      setLocalAreas((prev) => prev.map((a) => (a.id === area.id ? { ...a, is_active: !a.is_active } : a)));
    }
  }, [isEdit, updateMutation]);

  const filteredTechniques = useMemo(() => {
    if (!techSearch) return techniques.filter((t) => t.ativo !== false);
    const s = techSearch.toLowerCase();
    return techniques.filter(
      (t) =>
        t.ativo !== false &&
        (t.nome.toLowerCase().includes(s) ||
          (t.codigo_curto || '').toLowerCase().includes(s) ||
          t.nome_grupo?.toLowerCase().includes(s) ||
          t.grupo_tecnica?.toLowerCase().includes(s)),
    );
  }, [techniques, techSearch]);

  const groupedTechniques = useMemo(() => {
    const groups: Record<string, ExternalTechnique[]> = {};
    for (const t of filteredTechniques) {
      const group = t.nome_grupo || t.grupo_tecnica || 'Outras';
      if (!groups[group]) groups[group] = [];
      groups[group].push(t);
    }
    return groups;
  }, [filteredTechniques]);

  const wizardStepIndex = WIZARD_STEPS_IDS.indexOf(wizardStep);
  const isBusy = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  const isLoading = loadingTechs || (isEdit && loadingAreas);

  return {
    wizardStep, setWizardStep,
    expandedId, setExpandedId,
    selectedComponent, selectedLocation, selectedTechnique,
    customComponent, setCustomComponent,
    customLocation, setCustomLocation,
    techSearch, setTechSearch,
    detailForm, setDetailForm,
    localAreas, localAreasRef,
    displayAreas,
    filteredTechniques, groupedTechniques,
    wizardStepIndex, isBusy, isLoading, loadingTechs,
    resetWizard, startWizard,
    handleSelectComponent, handleSelectLocation, handleSelectTechnique,
    handleSaveArea,
    handleDeleteArea,
    // BUG-03: flush pending local areas to DB after product creation
    flushLocalAreas,
    // BUG-05: state-based delete confirmation
    deleteAreaConfirm, confirmDeleteArea, cancelDeleteArea,
    handleToggleActive,
  };
}

const WIZARD_STEPS_IDS: WizardStep[] = ['component', 'location', 'technique', 'details'];

function enrichArea(
  area: PrintAreaTechnique,
  techById: Map<string, ExternalTechnique>,
  override?: ExternalTechnique,
): EnrichedArea {
  const tech = override || techById.get(area.tabela_preco_id);
  // BUG-28 FIX: warn when technique not found — likely deleted from DB; area shows '—'
  if (!tech && !override && area.id && !area.id.startsWith('local-')) {
    console.warn(
      `[EngravingWizard] Technique id="${area.tabela_preco_id}" not found in cache — ` +
      'it may have been deleted from the DB. Area will display "—" as technique name.',
    );
  }
  return {
    ...area,
    technique_name: tech?.nome || '—',
    technique_code: tech?.codigo_curto || '—',
    technique_group: tech?.grupo_tecnica || '',
    max_colors:
      tech !== null && tech !== undefined && tech.max_cores !== null && tech.max_cores !== undefined
        ? typeof tech.max_cores === 'string' ? parseInt(tech.max_cores, 10) : tech.max_cores
        : null,
    setup_cost: tech?.custo_setup ?? null,
    charges_per_color: tech?.cobra_por_cor ?? false,
  };
}
