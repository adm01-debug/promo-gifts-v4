/**
 * MagicUp Configuration Panel — Left side with product, logo, scene selection
 */
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Upload,
  Loader2,
  MapPin,
  Paintbrush,
  Wand2,
  Eye,
  EyeOff,
  Building2,
  Search,
  X,
  Sparkles,
  Briefcase,
  Zap,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ProductSearchCombobox } from '@/components/mockup/ProductSearchCombobox';
import { PromptBank } from '@/components/magic-up/PromptBank';
import { PromptGenerator } from '@/components/magic-up/PromptGenerator';
import { cn } from '@/lib/utils';
import { getCompanyDisplayName } from '@/types/crm';
import type { useMagicUpState } from '@/hooks/intelligence';
import { MagicUpCampaignPanel } from '@/components/magic-up/MagicUpCampaignPanel';
import { MagicUpBrandKitPanel } from '@/components/magic-up/MagicUpBrandKitPanel';
import { MagicUpCreativeControls } from '@/components/magic-up/MagicUpCreativeControls';
import { MagicUpRefinementActions } from '@/components/magic-up/MagicUpRefinementActions';
import { MagicUpBatchGenerationPanel } from '@/components/magic-up/MagicUpBatchGenerationPanel';
import { BRIEF_OPTIONS, toHuman, type MagicUpBrief } from '@/pages/magic-up/magicUpStrategy';

type MagicUpStateReturn = ReturnType<typeof useMagicUpState>;

interface MagicUpConfigPanelProps {
  m: MagicUpStateReturn;
}

export function MagicUpConfigPanel({ m }: MagicUpConfigPanelProps) {
  return (
    <div className="space-y-4">
      <ClientCard m={m} />
      <BriefingCard m={m} />
      <ProductCard m={m} />
      <LogoCard m={m} />
      <BrandKitCard m={m} />
      <SceneCard m={m} />
      <MagicUpCreativeControls value={m.creativeControls} onChange={m.setCreativeControls} />
      <MagicUpRefinementActions
        activeRefinement={m.activeRefinement}
        onApply={m.handleApplyRefinement}
      />
      <MagicUpBatchGenerationPanel
        queue={m.batchQueue}
        running={m.batchRunning}
        canGenerate={m.canGenerate}
        onSetQueue={m.handleSetBatchQueue}
        onRunQueue={m.handleRunBatchQueue}
        onClearQueue={m.handleClearBatchQueue}
      />
      <PreviewCard m={m} />
      <GenerateButton m={m} />
    </div>
  );
}

function BriefingCard({ m }: { m: MagicUpStateReturn }) {
  const fields: Array<{
    field: keyof Pick<MagicUpBrief, 'objective' | 'channel' | 'audience' | 'tone'>;
    options: string[];
  }> = [
    { field: 'objective', options: BRIEF_OPTIONS.objective },
    { field: 'channel', options: BRIEF_OPTIONS.channel },
    { field: 'audience', options: BRIEF_OPTIONS.audience },
    { field: 'tone', options: BRIEF_OPTIONS.tone },
  ];

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Briefcase className="h-4 w-4 text-primary" /> Briefing da campanha
        </CardTitle>
        <CardDescription className="text-xs">
          Defina intenção comercial, canal, público e CTA antes de gerar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <MagicUpCampaignPanel
          brief={m.brief}
          campaign={m.activeCampaign}
          campaigns={m.campaigns}
          onBriefChange={m.setBrief}
          onCampaignChange={m.setActiveCampaign}
          onSave={m.handleSaveCampaign}
          onSelectCampaign={m.handleSelectCampaign}
          onDuplicateCampaign={m.handleDuplicateCampaign}
          fields={fields}
        />
      </CardContent>
    </Card>
  );
}

function ClientCard({ m }: { m: MagicUpStateReturn }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          Empresa
          <Badge variant="outline" className="ml-1 text-[9px]">
            Opcional
          </Badge>
        </CardTitle>
        <CardDescription className="text-xs">
          Busque na base de 51k+ empresas do CRM
        </CardDescription>
      </CardHeader>
      <CardContent>
        {m.selectedClient ? (
          <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-2">
            {m.selectedClient.logo_url && (
              <img
                src={m.selectedClient.logo_url}
                alt=""
                className="h-8 w-8 rounded border bg-background object-contain"
                loading="lazy"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{m.selectedClient.name}</p>
              {m.selectedClient.ramo_atividade && (
                <p className="text-[10px] text-muted-foreground">
                  {m.selectedClient.ramo_atividade}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={m.handleClearClient}
              aria-label="Fechar"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar empresa por nome..."
              value={m.clientSearch}
              onChange={(e) => {
                m.setClientSearch(e.target.value);
                m.setShowClientResults(true);
              }}
              onFocus={() => m.setShowClientResults(true)}
              className="h-9 pl-9"
            />
            {m.showClientResults && m.clientSearch.length >= 3 && (
              <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border bg-popover shadow-lg">
                {m.loadingClients ? (
                  <div className="p-3 text-center text-sm text-muted-foreground">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Buscando...
                  </div>
                ) : m.clientResults.length === 0 ? (
                  <div className="p-3 text-center text-sm text-muted-foreground">
                    Nenhuma empresa encontrada
                  </div>
                ) : (
                  m.clientResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent/50"
                      onClick={() => m.handleSelectClient(c)}
                    >
                      {c.logo_url && (
                        <img
                          src={c.logo_url}
                          alt=""
                          className="h-6 w-6 rounded border bg-background object-contain"
                          loading="lazy"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium">{getCompanyDisplayName(c)}</p>
                        {c.ramo_atividade && (
                          <p className="text-[10px] text-muted-foreground">{c.ramo_atividade}</p>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProductCard({ m }: { m: MagicUpStateReturn }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            1
          </span>
          Produto
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ProductSearchCombobox
          products={m.products}
          selectedProduct={m.selectedProduct}
          onSelect={(p) =>
            m.handleSelectProduct(p ? (m.products.find((x) => x.id === p.id) ?? null) : null)
          }
          placeholder="Buscar produto por nome ou SKU..."
        />

        {m.selectedProduct && (
          <div className="flex gap-4">
            {m.currentImage && (
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border bg-background">
                <img
                  src={m.currentImage}
                  alt={m.selectedProduct.name}
                  className="h-full w-full object-contain"
                  loading="lazy"
                />
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <p className="truncate text-sm font-medium">{m.selectedProduct.name}</p>
              <p className="text-xs text-muted-foreground">SKU: {m.selectedProduct.sku}</p>
              {!m.loadingColors && m.colors.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {m.colors.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() =>
                        m.setSelectedColor(m.selectedColor?.name === c.name ? null : c)
                      }
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-all',
                        m.selectedColor?.name === c.name
                          ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary/30'
                          : 'border-border/50 bg-muted/30 text-muted-foreground hover:border-primary/50',
                      )}
                      title={c.name}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full border border-border/30"
                        style={{ backgroundColor: c.hex }}
                      />
                      {c.name.length > 12 ? `${c.name.slice(0, 12)}…` : c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {m.selectedProduct &&
          m.sceneTab !== 'ai' &&
          !m.loadingPrintAreas &&
          m.printAreas.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" /> Local de Personalização
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {m.printAreas.map((area) => {
                  const label =
                    [area.component_name, area.location_name].filter(Boolean).join(' — ') ||
                    area.area_code;
                  const isSelected = m.selectedLocationId === area.area_id;
                  return (
                    <button
                      key={area.area_id}
                      type="button"
                      onClick={() => m.setSelectedLocationId(isSelected ? null : area.area_id)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all',
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30'
                          : 'border-border/50 bg-muted/30 text-muted-foreground hover:border-primary/50',
                      )}
                    >
                      <MapPin className="h-3 w-3" />
                      {label}
                      {area.max_width > 0 && (
                        <span className="text-[9px] opacity-60">
                          {area.max_width}×{area.max_height}
                          {area.unit}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        {m.selectedProduct && m.sceneTab !== 'ai' && m.availableTechniques.length > 0 && (
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Paintbrush className="h-3 w-3" /> Técnica
            </Label>
            <Select
              value={m.selectedTechnique?.id ?? ''}
              onValueChange={(v) =>
                m.setSelectedTechnique(m.availableTechniques.find((t) => t.id === v) || null)
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {m.availableTechniques.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LogoCard({ m }: { m: MagicUpStateReturn }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            2
          </span>
          Logo do Cliente
        </CardTitle>
        {m.selectedClient?.logo_url && m.logoPreview === m.selectedClient.logo_url && (
          <CardDescription className="text-xs">
            ✓ Logo carregado automaticamente da empresa
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            'rounded-lg border-2 border-dashed p-6 text-center transition-colors',
            m.logoPreview
              ? 'border-primary/30 bg-primary/5'
              : 'border-border hover:border-primary/50',
          )}
        >
          <input
            type="file"
            accept="image/*"
            onChange={m.handleLogoUpload}
            disabled={m.logoUploading}
            className="hidden"
            id="magic-logo-upload"
          />
          <label
            htmlFor="magic-logo-upload"
            className="flex cursor-pointer flex-col items-center gap-2"
          >
            {m.logoUploading ? (
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            ) : m.logoPreview ? (
              <>
                <div className="h-20 w-20 overflow-hidden rounded-lg border bg-background">
                  <img
                    src={m.logoPreview}
                    alt="Logo"
                    className="h-full w-full object-contain"
                    loading="lazy"
                  />
                </div>
                <Button variant="outline" size="sm" type="button">
                  Trocar logo
                </Button>
              </>
            ) : (
              <>
                <Upload className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-medium">Clique para enviar o logo</p>
                <p className="text-xs text-muted-foreground">PNG, JPG, SVG · Máx. 10MB</p>
              </>
            )}
          </label>
        </div>
      </CardContent>
    </Card>
  );
}

function BrandKitCard({ m }: { m: MagicUpStateReturn }) {
  return (
    <MagicUpBrandKitPanel
      kit={m.brandKit}
      loading={m.loadingBrandKit}
      selectedClientName={m.selectedClient?.name}
      logoPreview={m.logoPreview}
      onUpdate={m.handleUpdateBrandKit}
      onUseLogo={m.handleUseBrandLogo}
      onAddCurrentLogo={m.handleAddCurrentLogoToBrandKit}
      onSave={m.handleSaveBrandKit}
    />
  );
}

function SceneCard({ m }: { m: MagicUpStateReturn }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            3
          </span>
          Cenário Publicitário
        </CardTitle>
        <CardDescription className="text-xs">
          Use a IA para gerar cenários personalizados ou escolha do banco de prompts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-1 rounded-lg bg-muted/50 p-0.5">
          <button
            type="button"
            onClick={() => m.setSceneTab('ai')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium transition-all',
              m.sceneTab === 'ai'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Wand2 className="h-3.5 w-3.5" />
            Gerar com IA
          </button>
          <button
            type="button"
            onClick={() => m.setSceneTab('bank')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium transition-all',
              m.sceneTab === 'bank'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Banco de Prompts
          </button>
        </div>

        {m.sceneTab === 'ai' ? (
          <PromptGenerator
            productName={m.selectedProduct?.name}
            productColor={m.selectedColor?.name}
            clientName={m.selectedClient?.name}
            clientSegment={m.selectedClient?.ramo_atividade}
            brandColorName={m.selectedClient?.cor_primaria_nome}
            printAreas={m.printAreas || []}
            onSelectPrompt={(p) => m.setSelectedScene(p)}
            selectedPrompt={m.selectedScene}
            initialLocationId={m.selectedLocationId}
            initialTechniqueId={m.selectedTechnique?.id || null}
            onCustomizationChange={(info) => {
              m.setSelectedLocationId(info.locationId);
              if (info.techniqueId && info.techniqueName) {
                const tech = m.availableTechniques.find((t) => t.id === info.techniqueId);
                m.setSelectedTechnique({
                  id: info.techniqueId,
                  name: info.techniqueName,
                  code: tech?.code ?? '',
                });
              } else {
                m.setSelectedTechnique(null);
              }
            }}
          />
        ) : (
          <PromptBank
            selectedPrompt={m.selectedScene}
            onSelect={(p) => m.setSelectedScene(p)}
            productName={m.selectedProduct?.name}
            clientSegment={m.selectedClient?.ramo_atividade}
          />
        )}

        <div className="relative">
          <Label className="mb-1 block text-xs text-muted-foreground">
            Detalhes adicionais (complementa o cenário acima):
          </Label>
          <Textarea
            value={m.additionalDetails}
            onChange={(e) => m.setAdditionalDetails(e.target.value)}
            placeholder="Ex: A pessoa deve estar sorrindo, ambiente com tons quentes, foco no produto..."
            rows={3}
            className="resize-none text-sm"
          />
          {!m.selectedScene && m.additionalDetails.trim() && (
            <p className="mt-1 text-[10px] text-warning">
              💡 Dica: selecione também um cenário acima para melhores resultados
            </p>
          )}
        </div>

        {(m.selectedScene || m.additionalDetails.trim()) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">
                {m.selectedScene && m.additionalDetails.trim()
                  ? `${m.selectedScene.title} + detalhes extras`
                  : m.selectedScene
                    ? m.selectedScene.title
                    : 'Cenário personalizado'}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-[10px]"
                onClick={() => m.setShowPromptPreview(!m.showPromptPreview)}
              >
                {m.showPromptPreview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {m.showPromptPreview ? 'Ocultar' : 'Ver prompt completo'}
              </Button>
            </div>
            {m.showPromptPreview && m.fullPromptPreview && (
              <pre className="whitespace-pre-wrap rounded border bg-muted/50 p-2.5 font-mono text-[10px] text-muted-foreground">
                {m.fullPromptPreview}
              </pre>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PreviewCard({ m }: { m: MagicUpStateReturn }) {
  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">Prévia comercial</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Badge variant="outline" className="justify-center">
            Canal: {toHuman(m.brief.channel)}
          </Badge>
          <Badge variant="outline" className="justify-center">
            Formato: {m.creativeControls.aspectRatio}
          </Badge>
          <Badge variant="outline" className="justify-center">
            Score: {m.qualityScore.total}/100
          </Badge>
          <Badge variant="outline" className="justify-center">
            Tom: {toHuman(m.brief.tone)}
          </Badge>
        </div>
        <div className="space-y-1 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
          {m.qualityScore.checks.map((check) => (
            <p key={check.label}>
              {check.passed ? '✓' : '•'} {check.label}
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function GenerateButton({ m }: { m: MagicUpStateReturn }) {
  return (
    <div className="space-y-2">
      {/* Toggle Modo Rápido (Nano Banana / Gemini 2.5 Flash Image)
          Desativado: usa Gemini 3 Pro (qualidade máxima, mais lento e caro).
          Ativado: usa Gemini 2.5 Flash Image ("nano-banana"), ideal para
          iterações e refinamentos baratos antes de gerar a versão final. */}
      <label
        className={cn(
          'flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-colors',
          m.fastMode
            ? 'border-amber-400/60 bg-amber-50/60 dark:border-amber-700/60 dark:bg-amber-950/30'
            : 'border-border bg-muted/30 hover:bg-muted/50',
        )}
      >
        <div className="flex items-center gap-2 text-sm">
          <Zap
            className={cn(
              'h-4 w-4',
              m.fastMode ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
            )}
          />
          <div className="flex flex-col">
            <span className="font-medium">
              Modo Rápido{' '}
              {m.fastMode && (
                <span className="text-xs font-normal text-amber-700 dark:text-amber-400">
                  (Nano Banana)
                </span>
              )}
            </span>
            <span className="text-[11px] leading-tight text-muted-foreground">
              {m.fastMode
                ? 'Gemini 2.5 Flash Image — barato e rápido para iterações'
                : 'Gemini 3 Pro Image — qualidade máxima (default)'}
            </span>
          </div>
        </div>
        <Switch
          checked={m.fastMode}
          onCheckedChange={m.setFastMode}
          aria-label="Alternar modo rápido (Nano Banana)"
        />
      </label>

      <Button
        onClick={() => m.handleGenerate()}
        disabled={!m.canGenerate || m.generating}
        className="h-12 w-full gap-2 text-base"
        size="lg"
      >
        {m.generating ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            {m.fastMode ? 'Gerando com Nano Banana...' : 'Gerando com modelo Pro...'}
          </>
        ) : (
          <>
            {m.fastMode ? <Zap className="h-5 w-5" /> : <Wand2 className="h-5 w-5" />}
            {m.variations.length > 0 ? 'Gerar Nova Variação' : 'Gerar Imagem Publicitária'}
            {!m.canGenerate && (
              <Badge variant="secondary" className="ml-2 text-[10px]">
                {!m.selectedProduct
                  ? 'Selecione um produto'
                  : !m.logoPreview
                    ? 'Envie o logo'
                    : !m.effectivePrompt
                      ? 'Escolha um cenário'
                      : ''}
              </Badge>
            )}
          </>
        )}
      </Button>
    </div>
  );
}
