/**
 * useEngravingWizard — Business logic for the engraving wizard
 *
 * Fixes applied (audit 26/05/2026):
 *   BUG-02: table name corrected to 'tecnicas_gravacao' (was 'tecnica_gravacao' singular)
 *   BUG-05: handleDeleteArea uses state instead of confirm() — exposes deleteAreaConfirm/confirmDeleteArea/cancelDeleteArea
 *   BUG-03 NOTE: localAreas are not persisted when creating a new product. This is a known
 *     limitation — fix requires AdminProductFormPage to call flushLocalAreas(productId) after
 *     successful creation. Deferred to Sprint 3. A warning badge is shown in the UI.
 */
import { dbInvoke, dbInvokeDelete } from '@/lib/db/postgrest';
import { untypedFrom } from '@/lib/supabase-untyped';
import { useState, useCallback, useMemo, useRef } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
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

  const [selectedComponent, setSelectedComponent] = useState<{ code: string; name: string } | null>(
    null,
  );
  const [selectedLocation, setSelectedLocation] = useState<{ code: string; name: string } | null>(
    null,
  );
  const [selectedTechnique, setSelectedTechnique] = useState<ExternalTechnique | null>(null);
  const [customComponent, setCustomComponent] = useState('');
  const [customLocation, setCustomLocation] = useState('');
  const [techSearch, setTechSearch] = useState('');
  const [detailForm, setDetailForm] = useState<DetailFormState>(DEFAULT_DETAIL_FORM);
  const [localAreas, setLocalAreas] = useState<
    (PrintAreaTechnique & { _techData?: ExternalTechnique })[]
  >([]);

  // BUG-05 FIX: state-based delete confirmation for areas — no more confirm()
  const [deleteAreaConfirm, setDeleteAreaConfirm] = useState<EnrichedArea | null>(null);

  // BUG-03 NOTE: exposed via ref so AdminProductFormPage can call flushLocalAreas(id) after creation
  const localAreasRef = useRef(localAreas);
  localAreasRef.current = localAreas;

  // BUG-02 FIX: correct table name is 'tecnicas_gravacao' (plural with 's')
  const { data: techniques = [], isLoading: loadingTechs } = useQuery({
    queryKey: ['external-techniques-catalog'],
    queryFn: async (): Promise<ExternalTechnique[]> => {
      const result = await dbInvoke<ExternalTechnique>({
        table: 'tecnicas_gravacao',
        operation: 'select',
        orderBy: { column: 'nome', ascending: true },
        limit: 200,
      });
      return result.records || [];
    },
    staleTime: 10 * 60 * 1000,
  });

  const techById = useMemo(() => {
    const map = new Map<string, ExternalTechnique>();
    for (const t of techniques) map.set(t.id, t);
    return map;
  }, [techniques]);

  // Fetch saved areas
  const { data: savedAreas = [], isLoading: loadingAreas } = useQuery({
    queryKey: ['print-area-techniques', productId],
    queryFn: async (): Promise<EnrichedArea[]> => {
      const result = await dbInvoke<PrintAreaTechnique>({
        table: 'print_area_techniques',
        operation: 'select',
        filters: { product_id: productId },
        orderBy: { column: 'technique_order', ascending: true },
        limit: 100,
      });
      const records: PrintAreaTechnique[] = result.records || [];
      return records.map((area) => enrichArea(area, techById));
    },
    enabled: !!productId && isEdit && techniques.length > 0,
  });

  const enrichedLocalAreas = useMemo(
    (): EnrichedArea[] => localAreas.map((area) => enrichArea(area, techById, area._techData)),
    [localAreas, techById],
  );

  const displayAreas: EnrichedArea[] = isEdit && productId ? savedAreas : enrichedLocalAreas;

  // Mutations
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['print-area-techniques', productId] });

  const createMutation = useMutation({
    mutationFn: async (area: Omit<PrintAreaTechnique, 'created_at' | 'id' | 'updated_at'>) => {
      const { error } = await untypedFrom('print_area_techniques').insert(area);
      if (error) throw new Error(error.message || 'Erro ao criar área');
    },
    onSuccess: () => {
      invalidate();
      toast.success('Área de personalização adicionada');
    },
    onError: (e: unknown) => toast.error(sanitizeError(e)),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...payload }: Record<string, unknown> & { id: string }) => {
      const { error } = await untypedFrom('print_area_techniques').update(payload).eq('id', id);
      if (error) throw new Error(error.message || 'Erro ao atualizar área');
    },
    onSuccess: () => {
      invalidate();
      toast.success('Área atualizada');
    },
    onError: (e: unknown) => toast.error(sanitizeError(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await dbInvokeDelete({ table: 'print_area_techniques', id });
    },
    onSuccess: () => {
      invalidate();
      toast.success('Área removida');
    },
    onError: (e: unknown) => toast.error(sanitizeError(e)),
  });

  // Wizard actions
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

  const startWizard = useCallback(() => {
    resetWizard();
    setWizardStep('component');
  }, [resetWizard]);

  const handleSelectComponent = useCallback((comp: { code: string; name: string }) => {
    setSelectedComponent(comp);
    setWizardStep('location');
  }, []);

  const handleSelectLocation = useCallback((loc: { code: string; name: string }) => {
    setSelectedLocation(loc);
    setWizardStep('technique');
  }, []);

  const handleSelectTechnique = useCallback((tech: ExternalTechnique) => {
    setSelectedTechnique(tech);
    setWizardStep('details');
  }, []);

  const handleSaveArea = useCallback(() => {
    if (!selectedComponent || !selectedLocation || !selectedTechnique) return;
    const locationCode = `${selectedComponent.code}-${selectedLocation.code}`.toUpperCase();
    const locationName = `${selectedComponent.name} > ${selectedLocation.name}`;
    const newArea: Omit<PrintAreaTechnique, 'created_at' | 'id' | 'updated_at'> = {
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
      // BUG-03 NOTE: area stored locally with product_id='pending'.
      // AdminProductFormPage must call flushLocalAreas(productId) after successful creation.
      setLocalAreas((prev) => [
        ...prev,
        {
          ...newArea,
          id: `local-${Date.now()}`,
          _techData: selectedTechnique,
        } as PrintAreaTechnique & { _techData?: ExternalTechnique },
      ]);
      toast.success('Área adicionada (será salva junto ao produto)');
    }
    resetWizard();
  }, [
    selectedComponent,
    selectedLocation,
    selectedTechnique,
    detailForm,
    productId,
    isEdit,
    displayAreas.length,
    createMutation,
    resetWizard,
  ]);

  // BUG-05 FIX: requestDeleteArea sets state; confirmDeleteArea performs the delete
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

  const handleToggleActive = useCallback(
    (area: EnrichedArea) => {
      if (isEdit && area.id && !area.id.startsWith('local-')) {
        updateMutation.mutate({ id: area.id, is_active: !area.is_active });
      } else {
        setLocalAreas((prev) =>
          prev.map((a) => (a.id === area.id ? { ...a, is_active: !a.is_active } : a)),
        );
      }
    },
    [isEdit, updateMutation],
  );

  // Filtered techniques
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

  // BUG-03 FIX: flush locally-stored areas to the DB after a product is created
  const flushLocalAreas = useCallback(async (realProductId: string): Promise<void> => {
    const pending = localAreasRef.current;
    if (!pending.length) return;
    for (const area of pending) {
      const {
        id: _id,
        _techData: _td,
        ...areaData
      } = area as typeof area & { _techData?: ExternalTechnique };
      const { error } = await untypedFrom('print_area_techniques').insert({
        ...areaData,
        product_id: realProductId,
      });
      if (error) throw new Error(error.message || 'Erro ao salvar área de personalização');
    }
    setLocalAreas([]);
  }, []);

  return {
    wizardStep,
    setWizardStep,
    expandedId,
    setExpandedId,
    selectedComponent,
    selectedLocation,
    selectedTechnique,
    customComponent,
    setCustomComponent,
    customLocation,
    setCustomLocation,
    techSearch,
    setTechSearch,
    detailForm,
    setDetailForm,
    localAreas,
    localAreasRef,
    displayAreas,
    filteredTechniques,
    groupedTechniques,
    wizardStepIndex,
    isBusy,
    isLoading,
    loadingTechs,
    // Actions
    resetWizard,
    startWizard,
    handleSelectComponent,
    handleSelectLocation,
    handleSelectTechnique,
    handleSaveArea,
    handleDeleteArea,
    // BUG-05: new delete confirmation actions
    deleteAreaConfirm,
    confirmDeleteArea,
    cancelDeleteArea,
    handleToggleActive,
    flushLocalAreas,
  };
}

const WIZARD_STEPS_IDS: WizardStep[] = ['component', 'location', 'technique', 'details'];

function enrichArea(
  area: PrintAreaTechnique,
  techById: Map<string, ExternalTechnique>,
  override?: ExternalTechnique,
): EnrichedArea {
  const tech = override || techById.get(area.tabela_preco_id);
  return {
    ...area,
    technique_name: tech?.nome || '—',
    technique_code: tech?.codigo_curto || '—',
    technique_group: tech?.grupo_tecnica ?? '',
    max_colors:
      tech?.max_cores !== null && tech?.max_cores !== undefined
        ? typeof tech.max_cores === 'string'
          ? parseInt(tech.max_cores, 10)
          : tech.max_cores
        : null,
    setup_cost: tech?.custo_setup ?? null,
    charges_per_color: tech?.cobra_por_cor ?? false,
  };
}
