/**
 * MockupHistoryPanel — History grid with filters and pagination
 * Refatorado: Lightbox extraído para MockupLightbox.tsx
 */

import { useState, useMemo, useCallback, useDeferredValue, memo } from 'react';
import { cn } from '@/lib/utils';
import { LayoutPopover } from '@/components/products/LayoutPopover';
import { getDefaultColumns, type ColumnCount } from '@/components/products/ColumnSelector';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  History,
  Download,
  RotateCcw,
  Trash2,
  Clock,
  Search,
  RefreshCw,
  Wand2,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Columns2,
  X,
  Ruler,
  MapPin,
  Palette,
  FileImage,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MockupHistorySkeleton } from '@/components/loading/ModernSkeletons';
import { MockupCompareDialog } from './MockupCompareDialog';
import { MockupLightbox } from './MockupLightbox';
import type { GeneratedMockup } from '@/hooks/mockup/mockupGenerationService';
import { ShareMenu } from './ShareMenu';

// GeneratedMockup importado de @/hooks/mockup/mockupGenerationService (SSOT)

function safeFormatDistance(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return formatDistanceToNow(d, { addSuffix: true, locale: ptBR });
}

interface Client {
  id: string;
  name: string;
}

interface MockupHistoryPanelProps {
  mockupHistory: GeneratedMockup[];
  isLoading: boolean;
  clients: Client[];
  onLoadFromHistory: (mockup: GeneratedMockup) => void;
  onDownload: (url: string) => void;
  onDelete: (id: string) => void;
}

const ITEMS_PER_PAGE = 12;

export function MockupHistoryPanel({
  mockupHistory,
  isLoading,
  clients,
  onLoadFromHistory,
  onDownload,
  onDelete,
}: MockupHistoryPanelProps) {
  const [filterClient, setFilterClient] = useState('all');
  const [filterProduct, setFilterProduct] = useState('');
  const deferredFilterProduct = useDeferredValue(filterProduct);
  const [filterTechnique, setFilterTechnique] = useState('all');
  const [filterDateRange, setFilterDateRange] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedForCompare, setSelectedForCompare] = useState<Set<string>>(new Set());
  const [showCompare, setShowCompare] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [gridColumns, setGridColumns] = useState<ColumnCount>(() => getDefaultColumns());
  const [lightboxMockup, setLightboxMockup] = useState<GeneratedMockup | null>(null);

  const handleSetViewMode = useCallback((mode: 'grid' | 'list' | 'table') => {
    setViewMode(mode === 'table' ? 'list' : mode);
    setCurrentPage(1);
  }, []);
  const toggleCompareSelection = useCallback((id: string) => {
    setSelectedForCompare((prev) => {
      if (prev.has(id)) {
        const next = new Set(prev);
        next.delete(id);
        return next;
      }
      if (prev.size >= 4) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const compareMode = selectedForCompare.size > 0;
  const compareMockups = mockupHistory.filter((m) => selectedForCompare.has(m.id));

  const historyTechniques = useMemo(() => {
    const seen = new Set<string>();
    const result: { id: string; name: string }[] = [];
    for (const m of mockupHistory) {
      if (m.technique_name && !seen.has(m.technique_name)) {
        seen.add(m.technique_name);
        result.push({ id: m.technique_name, name: m.technique_name });
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [mockupHistory]);

  const filteredMockups = useMemo(() => {
    return mockupHistory.filter((mockup) => {
      const hasClient = mockup.client_id || mockup.client_name;
      if (filterClient === 'none' && hasClient) return false;
      if (filterClient !== 'all' && filterClient !== 'none') {
        if (mockup.client_id !== filterClient && mockup.client_name !== filterClient) return false;
      }
      if (deferredFilterProduct) {
        const q = deferredFilterProduct.toLowerCase();
        if (
          !mockup.product_name.toLowerCase().includes(q) &&
          !mockup.product_sku?.toLowerCase().includes(q)
        )
          return false;
      }
      if (filterTechnique !== 'all' && mockup.technique_name !== filterTechnique) return false;
      if (filterDateRange !== 'all') {
        const diffDays =
          (Date.now() - new Date(mockup.created_at).getTime()) / (1000 * 60 * 60 * 24);
        if (filterDateRange === '7d' && diffDays > 7) return false;
        if (filterDateRange === '30d' && diffDays > 30) return false;
        if (filterDateRange === '90d' && diffDays > 90) return false;
      }
      return true;
    });
  }, [mockupHistory, filterClient, deferredFilterProduct, filterTechnique, filterDateRange]);

  const totalPages = Math.ceil(filteredMockups.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedMockups = filteredMockups.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  const hasFilters =
    filterClient !== 'all' ||
    filterProduct ||
    filterTechnique !== 'all' ||
    filterDateRange !== 'all';

  const clearFilters = () => {
    setFilterClient('all');
    setFilterProduct('');
    setFilterTechnique('all');
    setFilterDateRange('all');
    setCurrentPage(1);
  };

  return (
    <Card className="border-border/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Histórico de Mockups
            </CardTitle>
            <CardDescription>Mockups gerados anteriormente</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {compareMode && (
              <>
                <Badge variant="secondary">{selectedForCompare.size} selecionados</Badge>
                <Button
                  size="sm"
                  onClick={() => setShowCompare(true)}
                  disabled={selectedForCompare.size < 2}
                >
                  <Columns2 className="mr-1 h-4 w-4" /> Comparar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedForCompare(new Set())}>
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}
            <LayoutPopover
              viewMode={viewMode}
              setViewMode={handleSetViewMode}
              gridColumns={gridColumns}
              setGridColumns={setGridColumns}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 gap-4 rounded-lg bg-muted/30 p-4 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Cliente</Label>
            <Select
              value={filterClient}
              onValueChange={(v) => {
                setFilterClient(v);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                <SelectItem value="none">Sem cliente</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Produto</Label>
            <Input
              placeholder="Buscar por nome ou SKU..."
              value={filterProduct}
              onChange={(e) => {
                setFilterProduct(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Técnica</Label>
            <Select
              value={filterTechnique}
              onValueChange={(v) => {
                setFilterTechnique(v);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as técnicas</SelectItem>
                {historyTechniques.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" /> Período
            </Label>
            <Select
              value={filterDateRange}
              onValueChange={(v) => {
                setFilterDateRange(v);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todo período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo período</SelectItem>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="90d">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {hasFilters && (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <RefreshCw className="mr-1 h-4 w-4" /> Limpar filtros
            </Button>
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <MockupHistorySkeleton count={8} />
        ) : mockupHistory.length === 0 ? (
          <div className="animate-fade-in py-16 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5">
              <Wand2 className="h-10 w-10 text-primary/60" />
            </div>
            <h3 className="mb-2 font-display text-lg font-semibold text-foreground">
              Nenhum mockup gerado ainda
            </h3>
            <p className="mx-auto max-w-md text-muted-foreground">
              Comece criando seu primeiro mockup!
            </p>
          </div>
        ) : filteredMockups.length === 0 ? (
          <div className="animate-fade-in py-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Search className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="mb-2 font-display text-lg font-semibold">Nenhum resultado</h3>
            <p className="mb-4 text-muted-foreground">Ajuste os filtros de busca.</p>
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <RefreshCw className="mr-2 h-4 w-4" /> Limpar filtros
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, filteredMockups.length)} de{' '}
                {filteredMockups.length}
              </span>
              {totalPages > 1 && (
                <span>
                  Página {currentPage} de {totalPages}
                </span>
              )}
            </div>

            {viewMode === 'grid' ? (
              <div
                className="grid gap-4"
                style={{ gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` }}
              >
                {paginatedMockups.map((mockup) => (
                  <MockupGridCard
                    key={mockup.id}
                    mockup={mockup}
                    isCompareSelected={selectedForCompare.has(mockup.id)}
                    onToggleCompare={toggleCompareSelection}
                    onOpenLightbox={setLightboxMockup}
                    onLoadFromHistory={onLoadFromHistory}
                    onDownload={onDownload}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {paginatedMockups.map((mockup) => (
                  <MockupListRow
                    key={mockup.id}
                    mockup={mockup}
                    isCompareSelected={selectedForCompare.has(mockup.id)}
                    onToggleCompare={toggleCompareSelection}
                    onLoadFromHistory={onLoadFromHistory}
                    onDownload={onDownload}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                >
                  Primeira
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Voltar"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) pageNum = i + 1;
                    else if (currentPage <= 3) pageNum = i + 1;
                    else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = currentPage - 2 + i;
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? 'default' : 'outline'}
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Avançar"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  Última
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>

      <MockupCompareDialog
        open={showCompare}
        onOpenChange={setShowCompare}
        mockups={compareMockups}
        onDownload={onDownload}
      />
      <MockupLightbox
        mockup={lightboxMockup}
        onClose={() => setLightboxMockup(null)}
        onLoadFromHistory={onLoadFromHistory}
        onDownload={onDownload}
      />
    </Card>
  );
}

// ============================================
// Sub-components (inlined — small enough)
// ============================================

const MockupGridCard = memo(
  ({
    mockup,
    isCompareSelected,
    onToggleCompare,
    onOpenLightbox,
    onLoadFromHistory,
    onDownload,
    onDelete,
  }: {
    mockup: GeneratedMockup;
    isCompareSelected: boolean;
    onToggleCompare: (id: string) => void;
    onOpenLightbox: (m: GeneratedMockup) => void;
    onLoadFromHistory: (m: GeneratedMockup) => void;
    onDownload: (url: string) => void;
    onDelete: (id: string) => void;
  }) => {
    return (
      <div
        className={cn(
          'group relative overflow-hidden rounded-xl border border-border/30 bg-card transition-all duration-300 hover:shadow-lg hover:ring-2 hover:ring-primary/30',
          isCompareSelected && 'shadow-lg ring-2 ring-primary',
        )}
      >
        <div className="absolute left-2 top-2 z-10">
          <div
            className={cn(
              'flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border-2 bg-background/80 backdrop-blur-sm transition-all',
              isCompareSelected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-muted-foreground/30 opacity-0 group-hover:opacity-100',
            )}
            onClick={(e) => {
              e.stopPropagation();
              onToggleCompare(mockup.id);
            }}
          >
            {isCompareSelected && <span className="text-xs font-bold">✓</span>}
          </div>
        </div>
        <div
          className="aspect-[3/4] cursor-pointer overflow-hidden bg-muted/30"
          role="button"
          tabIndex={0}
          onClick={() => onOpenLightbox(mockup)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpenLightbox(mockup);
            }
          }}
          aria-label={`Abrir mockup de ${mockup.product_name}`}
        >
          <img
            src={mockup.layout_url || mockup.mockup_url}
            alt={`Mockup de ${mockup.product_name}`}
            className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
          {mockup.layout_url && (
            <div className="absolute bottom-1 left-1">
              <Badge
                variant="secondary"
                className="bg-background/80 px-1 py-0 text-[9px] backdrop-blur-sm"
              >
                <FileImage className="mr-0.5 h-2.5 w-2.5" />
                Layout
              </Badge>
            </div>
          )}
        </div>
        <div className="space-y-1.5 border-t bg-gradient-to-t from-muted/50 to-transparent p-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="block cursor-default truncate text-sm font-medium">
                {mockup.product_name}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{mockup.product_name}</p>
              {mockup.product_sku && (
                <p className="text-xs text-muted-foreground">SKU: {mockup.product_sku}</p>
              )}
            </TooltipContent>
          </Tooltip>
          {mockup.product_sku && (
            <span className="font-mono text-[10px] text-muted-foreground">
              {mockup.product_sku}
            </span>
          )}
          <div className="flex flex-wrap items-center gap-1">
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
              {mockup.technique_name}
            </Badge>
            {mockup.location_name && (
              <Badge variant="outline" className="gap-0.5 px-1.5 py-0 text-[10px]">
                <MapPin className="h-2.5 w-2.5" />
                {mockup.location_name}
              </Badge>
            )}
          </div>
          {(mockup.logo_width_cm || mockup.logo_height_cm) && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Ruler className="h-2.5 w-2.5" />
              {mockup.logo_width_cm?.toFixed(1)}×{mockup.logo_height_cm?.toFixed(1)} cm
              {mockup.colors_count && (
                <span className="ml-1 flex items-center gap-0.5">
                  <Palette className="h-2.5 w-2.5" />
                  {mockup.colors_count} cor{mockup.colors_count > 1 ? 'es' : ''}
                </span>
              )}
            </div>
          )}
          {mockup.client_name && (
            <p className="truncate text-xs font-medium text-primary">👤 {mockup.client_name}</p>
          )}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {safeFormatDistance(mockup.created_at)}
          </div>
        </div>
        <div className="absolute right-2 top-2 flex translate-y-1 gap-1.5 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                aria-label="Regenerar"
                variant="secondary"
                className="h-8 w-8 shadow-md"
                onClick={() => onLoadFromHistory(mockup)}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Regenerar</TooltipContent>
          </Tooltip>
          <ShareMenu
            mockupUrl={mockup.mockup_url}
            productName={mockup.product_name}
            techniqueName={mockup.technique_name}
            className="h-8 w-8 p-0 shadow-md [&>svg]:h-4 [&>svg]:w-4"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                aria-label="Download"
                variant="secondary"
                className="h-8 w-8 shadow-md"
                onClick={() => onDownload(mockup.layout_url || mockup.mockup_url)}
              >
                <Download className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Baixar</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                aria-label="Excluir"
                data-testid="delete-mockup-button"
                variant="destructive"
                className="h-8 w-8 shadow-md"
                onClick={() => onDelete(mockup.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Excluir</TooltipContent>
          </Tooltip>
        </div>
      </div>
    );
  },
);

MockupGridCard.displayName = 'MockupGridCard';

const MockupListRow = memo(
  ({
    mockup,
    isCompareSelected,
    onToggleCompare,
    onLoadFromHistory,
    onDownload,
    onDelete,
  }: {
    mockup: GeneratedMockup;
    isCompareSelected: boolean;
    onToggleCompare: (id: string) => void;
    onLoadFromHistory: (m: GeneratedMockup) => void;
    onDownload: (url: string) => void;
    onDelete: (id: string) => void;
  }) => {
    return (
      <div
        className={cn(
          'group flex items-center gap-4 rounded-lg border border-border/30 bg-card p-3 transition-all duration-200 hover:shadow-md hover:ring-2 hover:ring-primary/30',
          isCompareSelected && 'shadow-lg ring-2 ring-primary',
        )}
      >
        <div
          className={cn(
            'flex h-5 w-5 flex-shrink-0 cursor-pointer items-center justify-center rounded border-2 transition-all',
            isCompareSelected
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-muted-foreground/30',
          )}
          onClick={(e) => {
            e.stopPropagation();
            onToggleCompare(mockup.id);
          }}
        >
          {isCompareSelected && <span className="text-[10px] font-bold">✓</span>}
        </div>
        <div className="h-20 w-16 flex-shrink-0 overflow-hidden rounded-md border bg-muted/30">
          <img
            src={mockup.layout_url || mockup.mockup_url}
            alt={mockup.product_name}
            className="h-full w-full object-contain"
            loading="lazy"
          />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          {mockup.client_name && (
            <p className="truncate text-sm font-semibold text-primary">👤 {mockup.client_name}</p>
          )}
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{mockup.product_name}</span>
            {mockup.product_sku && (
              <Badge variant="outline" className="shrink-0 px-1.5 py-0 font-mono text-[10px]">
                {mockup.product_sku}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
              {mockup.technique_name}
            </Badge>
            {mockup.location_name && (
              <Badge variant="outline" className="gap-0.5 px-1.5 py-0 text-[10px]">
                <MapPin className="h-2.5 w-2.5" />
                {mockup.location_name}
              </Badge>
            )}
            {(mockup.logo_width_cm || mockup.logo_height_cm) && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Ruler className="h-2.5 w-2.5" />
                {mockup.logo_width_cm?.toFixed(1)}×{mockup.logo_height_cm?.toFixed(1)} cm
              </span>
            )}
            {mockup.colors_count && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Palette className="h-2.5 w-2.5" />
                {mockup.colors_count} cor{mockup.colors_count > 1 ? 'es' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {safeFormatDistance(mockup.created_at)}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                aria-label="Regenerar"
                variant="secondary"
                className="h-8 w-8"
                onClick={() => onLoadFromHistory(mockup)}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Regenerar</TooltipContent>
          </Tooltip>
          <ShareMenu
            mockupUrl={mockup.mockup_url}
            productName={mockup.product_name}
            techniqueName={mockup.technique_name}
            className="h-8 w-8 p-0 [&>svg]:h-4 [&>svg]:w-4"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                aria-label="Download"
                variant="secondary"
                className="h-8 w-8"
                onClick={() => onDownload(mockup.layout_url || mockup.mockup_url)}
              >
                <Download className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Baixar</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                aria-label="Excluir"
                data-testid="delete-mockup-button"
                variant="destructive"
                className="h-8 w-8"
                onClick={() => onDelete(mockup.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Excluir</TooltipContent>
          </Tooltip>
        </div>
      </div>
    );
  },
);
MockupListRow.displayName = 'MockupListRow';
