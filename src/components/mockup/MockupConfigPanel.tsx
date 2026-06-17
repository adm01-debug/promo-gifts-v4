/**
 * MockupConfigPanel — Configuration form for mockup generation
 *
 * Extracted from MockupGenerator.tsx to reduce god-component size.
 * Handles: Client, Product, Technique selection + Areas.
 */

import { Loader2, Paintbrush, RefreshCw, Info, ChevronDown, Wand2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { TechniqueTooltip } from './TechniqueTooltip';
import { MockupClientSelector } from './MockupClientSelector';
import { MockupProductSelector, type MockupProductSelection } from './MockupProductSelector';
import { MultiAreaManager, type PersonalizationArea } from './MultiAreaManager';
import { ArtFileUpload, type ArtFileAttachment } from './ArtFileUpload';
import { LogoColorAnalyzer } from './LogoColorAnalyzer';
import type { DetectedColor } from '@/hooks/simulation';

interface Technique {
  id: string;
  name: string;
  code: string | null;
  maxWidth?: number | null;
  maxHeight?: number | null;
  areaName?: string | null;
  locationName?: string | null;
  // Atributos novos (vindos de TechniqueWithLimits)
  maxColors?: number | null;
  chargesPerColor?: boolean;
  usesDimension?: boolean;
  isCurved?: boolean;
  setupCost?: number | null;
  variationLabel?: string | null;
  groupCode?: string | null;
  shape?: string | null;
}

export interface MockupClient {
  id: string;
  name: string;
  razao_social?: string;
  nome_fantasia?: string;
  ramo?: string;
  logo_url?: string;
  cnpj?: string;
}

interface MockupConfigPanelProps {
  techniques: Technique[];
  productSelection: MockupProductSelection | null;
  selectedTechnique: Technique | null;
  selectedClient: MockupClient | null;
  isLoadingData: boolean;
  personalizationAreas: PersonalizationArea[];
  onProductSelect: (selection: MockupProductSelection | null) => void;
  onTechniqueSelect: (technique: Technique | null) => void;
  onClientSelect: (client: MockupClient | null) => void;
  onReset: () => void;
  filteredTechniques: Technique[];
  // Multi-area props
  activeAreaId: string | null;
  onAreasChange: (areas: PersonalizationArea[]) => void;
  onActiveAreaChange: (id: string | null) => void;
  onLogoUpload: (areaId: string, file: File) => void;
  onLogoRemove?: (areaId: string) => void;
  /** Real product locations from DB — if provided, locks areas to these */
  productLocations: { code: string; name: string; order: number }[] | null;
  /** Logo color analysis */
  logoColorAnalysis?: {
    colors: DetectedColor[];
    isAnalyzing: boolean;
    error: string | null;
    updatePantone: (index: number, pantoneCode: string) => void;
  };
  /** Art file attachments */
  artAttachments: ArtFileAttachment[];
  onArtAttachmentsChange: (attachments: ArtFileAttachment[]) => void;
  userId?: string;
}

export function MockupConfigPanel({
  techniques,
  productSelection,
  selectedTechnique,
  selectedClient,
  isLoadingData,
  personalizationAreas,
  onProductSelect,
  onTechniqueSelect,
  onClientSelect,
  onReset,
  filteredTechniques,
  activeAreaId,
  onAreasChange,
  onActiveAreaChange,
  onLogoUpload,
  onLogoRemove,
  productLocations,
  logoColorAnalysis,
  artAttachments,
  onArtAttachmentsChange,
  userId,
}: MockupConfigPanelProps) {
  const hasLogo = personalizationAreas.some((a) => a.logoPreview);

  return (
    <Card className="border-border/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="h-5 w-5 text-primary" />
          Configuração
        </CardTitle>
        <CardDescription>
          Selecione o produto, técnica e faça upload do logo do cliente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoadingData && (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Carregando dados...</p>
            </div>
          </div>
        )}

        {!isLoadingData && (
          <>
            {/* Step 1: Client Selection — collapsible on mobile */}
            <MobileCollapsibleSection
              id="step-client"
              label="Empresa"
              isCompleted={!!selectedClient}
              summary={selectedClient?.name}
              required
            >
              <MockupClientSelector
                selectedClient={selectedClient}
                onClientSelect={onClientSelect}
              />
            </MobileCollapsibleSection>

            {/* Step 2: Product Selection */}
            <MobileCollapsibleSection
              id="step-product"
              label="Produto"
              isCompleted={!!productSelection}
              summary={productSelection?.product.name}
            >
              <MockupProductSelector selection={productSelection} onSelect={onProductSelect} />
            </MobileCollapsibleSection>

            {/* Step 3: Technique Selection */}
            <MobileCollapsibleSection
              id="step-technique"
              label="Técnica de Personalização"
              isCompleted={!!selectedTechnique}
              summary={selectedTechnique?.name}
              trailing={
                selectedTechnique && (
                  <TechniqueTooltip technique={selectedTechnique}>
                    <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground transition-colors hover:text-primary" />
                  </TechniqueTooltip>
                )
              }
            >
              <Select
                value={selectedTechnique?.id ?? ''}
                onValueChange={(value) => {
                  const technique = filteredTechniques.find((t) => t.id === value);
                  onTechniqueSelect(technique || null);
                }}
              >
                <SelectTrigger data-testid="mockup-technique-select-trigger">
                  <SelectValue placeholder="Selecione uma técnica..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredTechniques.length > 0 ? (
                    <>
                      {productSelection && filteredTechniques.length < techniques.length && (
                        <div className="bg-muted/50 px-2 py-1.5 text-[10px] text-muted-foreground">
                          Técnicas compatíveis com {productSelection.product.name}
                        </div>
                      )}
                      {filteredTechniques.map((technique) => (
                        <TechniqueTooltip key={technique.id} technique={technique}>
                          <SelectItem value={technique.id} className="cursor-pointer">
                            <div className="flex w-full flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                <Paintbrush className="h-3.5 w-3.5 text-primary" />
                                <span>{technique.name}</span>
                                {technique.maxWidth && technique.maxHeight ? (
                                  <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
                                    {technique.maxWidth}×{technique.maxHeight}cm
                                  </span>
                                ) : null}
                              </div>
                              {(technique.variationLabel ||
                                technique.maxColors ||
                                technique.isCurved ||
                                technique.usesDimension) && (
                                <div className="ml-5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                  {technique.variationLabel && (
                                    <span className="max-w-[140px] truncate">
                                      {technique.variationLabel}
                                    </span>
                                  )}
                                  {technique.maxColors ? (
                                    <span>
                                      · {technique.maxColors} cor
                                      {technique.maxColors > 1 ? 'es' : ''}
                                    </span>
                                  ) : null}
                                  {technique.isCurved ? <span>· curvo</span> : null}
                                  {technique.usesDimension ? <span>· por área</span> : null}
                                </div>
                              )}
                            </div>
                          </SelectItem>
                        </TechniqueTooltip>
                      ))}
                    </>
                  ) : (
                    <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                      {productSelection
                        ? 'Nenhuma técnica disponível para este produto'
                        : 'Selecione um produto primeiro'}
                    </div>
                  )}
                </SelectContent>
              </Select>
              {selectedTechnique &&
                (selectedTechnique.locationName ||
                  selectedTechnique.maxWidth ||
                  selectedTechnique.maxColors) && (
                  <p className="text-[11px] text-muted-foreground">
                    {selectedTechnique.locationName ? (
                      <>
                        Local:{' '}
                        <strong className="text-foreground/80">
                          {selectedTechnique.locationName}
                        </strong>
                      </>
                    ) : null}
                    {selectedTechnique.maxWidth && selectedTechnique.maxHeight ? (
                      <>
                        {' '}
                        · Máx {selectedTechnique.maxWidth}×{selectedTechnique.maxHeight}cm
                      </>
                    ) : null}
                    {selectedTechnique.maxColors ? (
                      <>
                        {' '}
                        · {selectedTechnique.maxColors} cor
                        {selectedTechnique.maxColors > 1 ? 'es' : ''}
                        {selectedTechnique.chargesPerColor ? ' (cobra por cor)' : ''}
                      </>
                    ) : null}
                    {selectedTechnique.setupCost ? (
                      <> · Setup R$ {selectedTechnique.setupCost.toFixed(2)}</>
                    ) : null}
                  </p>
                )}
              {productSelection &&
                filteredTechniques.length > 0 &&
                filteredTechniques.length < techniques.length && (
                  <p className="text-[10px] text-muted-foreground">
                    {filteredTechniques.length} de {techniques.length} técnicas compatíveis
                  </p>
                )}
            </MobileCollapsibleSection>

            {/* Step 4: Areas */}
            <MobileCollapsibleSection
              id="step-logo"
              label="Áreas de Personalização"
              isCompleted={hasLogo}
              summary={
                hasLogo
                  ? `${personalizationAreas.filter((a) => a.logoPreview).length} logo(s)`
                  : undefined
              }
            >
              <MultiAreaManager
                areas={personalizationAreas}
                activeAreaId={activeAreaId}
                onAreasChange={onAreasChange}
                onActiveAreaChange={onActiveAreaChange}
                onLogoUpload={onLogoUpload}
                onLogoRemove={onLogoRemove}
                productLocations={productLocations}
              />
            </MobileCollapsibleSection>

            {/* Step 5: Art Files */}
            <MobileCollapsibleSection
              id="step-art-files"
              label="Arquivos de Arte (Vetor)"
              isCompleted={artAttachments.length > 0}
              summary={
                artAttachments.length > 0 ? `${artAttachments.length} arquivo(s)` : undefined
              }
            >
              <ArtFileUpload
                userId={userId ?? ''}
                attachments={artAttachments}
                onAttachmentsChange={onArtAttachmentsChange}
              />
            </MobileCollapsibleSection>

            {/* Logo Color Analysis — auto-appears after logo upload */}
            {logoColorAnalysis &&
              (logoColorAnalysis.colors.length > 0 || logoColorAnalysis.isAnalyzing) && (
                <MobileCollapsibleSection
                  id="step-colors"
                  label="Cores da Logo"
                  isCompleted={
                    logoColorAnalysis.colors.length > 0 && !logoColorAnalysis.isAnalyzing
                  }
                  summary={
                    logoColorAnalysis.colors.length > 0
                      ? `${logoColorAnalysis.colors.length} Pantone`
                      : undefined
                  }
                >
                  <LogoColorAnalyzer
                    colors={logoColorAnalysis.colors}
                    isAnalyzing={logoColorAnalysis.isAnalyzing}
                    error={logoColorAnalysis.error}
                    onPantoneChange={logoColorAnalysis.updatePantone}
                  />
                </MobileCollapsibleSection>
              )}

            {/* Reset Button */}
            <div className="flex gap-2 pt-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" onClick={onReset} aria-label="Limpar formulário">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Limpar formulário</TooltipContent>
              </Tooltip>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Mobile Collapsible Section ──────────────────────────────────────

interface MobileCollapsibleSectionProps {
  id?: string;
  label: string;
  isCompleted: boolean;
  summary?: string;
  required?: boolean;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}

function MobileCollapsibleSection({
  id,
  label,
  isCompleted,
  summary,
  required,
  trailing,
  children,
}: MobileCollapsibleSectionProps) {
  // Desktop: always expanded. Mobile: collapsible, auto-collapse when completed.
  return (
    <div id={id} className="scroll-mt-20 space-y-2">
      {/* Desktop view — always visible */}
      <div className="hidden space-y-2 md:block">
        <Label className="flex items-center gap-2">
          {label} {required && <span className="text-destructive">*</span>}
          {trailing}
        </Label>
        {children}
      </div>

      {/* Mobile view — collapsible */}
      <div className="md:hidden">
        <Collapsible defaultOpen={!isCompleted}>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-muted/50">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{label}</span>
                {required && <span className="text-xs text-destructive">*</span>}
                {trailing}
              </div>
              <div className="flex items-center gap-2">
                {isCompleted && summary && (
                  <span className="max-w-[120px] truncate text-xs text-muted-foreground">
                    {summary}
                  </span>
                )}
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" />
              </div>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">{children}</CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
