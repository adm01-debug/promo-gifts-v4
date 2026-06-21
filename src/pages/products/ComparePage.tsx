/**
 * ComparePage — Comparador de produtos (10/10)
 * C1: score, radar, AI advisor, TCO, differences-only.
 * C2: CRM picker, share público, export, sync, CTA orçamento.
 * C3: Duel mode, mobile carousel, presentation, variant sync.
 * C4: similar rail, presentation launcher.
 * C5: shortcuts, ARIA-live, smart empty state, recent sidebar.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageSEO } from '@/components/seo/PageSEO';
import { useComparisonStore, type CompareVariantInfo } from '@/stores/useComparisonStore';
import type { Product, ProductColor } from '@/types/product-catalog';
import { formatCurrency } from '@/lib/format';
import { getCatalogStockStatusLabel } from '@/lib/catalog-stock-status';
import { useProductsContext } from '@/contexts/ProductsContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  X,
  ArrowLeft,
  Share2,
  Image as ImageIcon,
  List,
  Filter,
  FileText,
  Building2,
  Swords,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SyncedZoomGallery } from '@/components/compare/SyncedZoomGallery';
import { CompareTableView } from '@/components/compare/CompareTableView';
import { ComparisonScoreCard } from '@/components/compare/ComparisonScoreCard';
import { ComparisonRadarChart } from '@/components/compare/ComparisonRadarChart';
import { AIComparisonAdvisor } from '@/components/compare/AIComparisonAdvisor';
import { ShareComparisonDialog } from '@/components/compare/ShareComparisonDialog';
import { ExportComparisonButton } from '@/components/compare/ExportComparisonButton';
import { ComparisonDuelView } from '@/components/compare/ComparisonDuelView';
import { ComparisonMobileView } from '@/components/compare/ComparisonMobileView';
import { ComparisonPresentationLauncher } from '@/components/compare/ComparisonPresentationLauncher';
import { SimilarProductsRail } from '@/components/compare/SimilarProductsRail';
import { CompareEmptyStateSmart } from '@/components/compare/CompareEmptyStateSmart';
import { RecentComparisonsSidebar } from '@/components/compare/RecentComparisonsSidebar';
import { FavoritesClientPicker } from '@/components/favorites/FavoritesClientPicker';
import { useComparisonShortcuts, useComparisonSync } from '@/hooks/comparison';

const COMPARE_STATUS_COLORS: Record<string, string> = {
  'in-stock': 'text-success',
  'low-stock': 'text-warning',
  'out-of-stock': 'text-destructive',
} as const;

export default function ComparePage() {
  useComparisonSync();
  const navigate = useNavigate();
  const [differencesOnly, setDifferencesOnly] = useState(false);
  const [duelMode, setDuelMode] = useState(true);
  const [showRadar, setShowRadar] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [client, setClient] = useState<{ id: string; name: string } | null>(null);
  const [ariaMessage, setAriaMessage] = useState('');
  const compareItems = useComparisonStore((s) => s.compareItems);
  const removeByIndex = useComparisonStore((s) => s.removeByIndex);
  const clearCompare = useComparisonStore((s) => s.clearCompare);
  const compareCount = useComparisonStore((s) => s.compareCount);
  const { getProductsByIds, products: _cacheSignal } = useProductsContext();

  // Track previous count for ARIA-live announcements
  const [prevCount, setPrevCount] = useState(compareCount);
  useEffect(() => {
    if (compareCount > prevCount) {
      setAriaMessage(`Produto adicionado. ${compareCount} produtos em comparação.`);
    } else if (compareCount < prevCount) {
      if (compareCount === 0) setAriaMessage('Comparação limpa.');
      else setAriaMessage(`Produto removido. ${compareCount} produtos em comparação.`);
    }
    setPrevCount(compareCount);
  }, [compareCount, prevCount]);

  // Keyboard shortcuts
  useComparisonShortcuts({
    onToggleDifferences: () => setDifferencesOnly((v) => !v),
    onToggleRadar: () => setShowRadar((v) => !v),
  });

  const compareEntries = useMemo(() => {
    const uniqueIds = [...new Set(compareItems.map((i) => i.productId))];
    const productMap = new Map<string, Product>();
    getProductsByIds(uniqueIds).forEach((p) => productMap.set(p.id, p));
    return compareItems
      .map((item, index) => {
        const product = productMap.get(item.productId);
        if (!product) return null;
        const displayProduct = item.variant?.thumbnail
          ? { ...product, images: [item.variant.thumbnail, ...product.images] }
          : product;
        return { product: displayProduct, variant: item.variant, index };
      })
      .filter(Boolean) as { product: Product; variant?: CompareVariantInfo; index: number }[];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareItems, getProductsByIds, _cacheSignal]);

  const products: Product[] = compareEntries.map((e) => e.product);

  // Rótulo vem da fonte única (catalog-stock-status); cor Tailwind é presentational, fica local.
  const getStockStatusLabel = (status: string) => ({
    label: getCatalogStockStatusLabel(status),
    color: COMPARE_STATUS_COLORS[status] ?? 'text-success',
  });

  const handleCreateQuote = () => {
    const productParams = compareItems.map((i) => i.productId).join(',');
    const params = new URLSearchParams({ products: productParams });
    if (client?.id) params.set('client_id', client.id);
    if (client?.name) params.set('client_name', client.name);
    navigate(`/orcamentos/novo?${params.toString()}`);
  };

  // Empty state with smart suggestions
  if (compareCount < 2) {
    return (
      <>
        <PageSEO
          title="Comparar Produtos"
          description="Compare brindes lado a lado."
          path="/comparar"
          jsonLd={{
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'Comparar Produtos',
            url: 'https://www.promogifts.com.br/comparar',
          }}
        />
        <CompareEmptyStateSmart />
      </>
    );
  }

  return (
    <>
      {/* ARIA-live region for accessibility announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {ariaMessage}
      </div>

      <ShareComparisonDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        compareItems={compareItems}
        clientId={client?.id ?? null}
        clientName={client?.name ?? null}
      />
      <div
        id="compare-export-area"
        className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" aria-label="Voltar" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1
                data-testid="page-title-comparador"
                className="font-display text-2xl font-bold text-foreground lg:text-3xl"
              >
                Comparador de Produtos
              </h1>
              <p className="text-muted-foreground">
                Comparando {compareCount} produtos
                {client && (
                  <>
                    {' '}
                    · <span className="font-medium text-primary">{client.name}</span>
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={client ? 'default' : 'outline'} size="sm">
                  <Building2 className="mr-2 h-4 w-4" />
                  {client ? client.name.slice(0, 22) : 'Cliente CRM'}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-3">
                <FavoritesClientPicker
                  selectedClientId={client?.id ?? null}
                  selectedClientName={client?.name ?? null}
                  onSelect={setClient}
                />
              </PopoverContent>
            </Popover>
            <RecentComparisonsSidebar />
            <Button
              variant={differencesOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDifferencesOnly((v) => !v)}
              aria-pressed={differencesOnly}
              title="Atalho: D"
            >
              <Filter className="mr-2 h-4 w-4" />
              {differencesOnly ? 'Mostrando diferenças' : 'Só diferenças'}
            </Button>
            <Button variant="default" size="sm" onClick={handleCreateQuote}>
              <FileText className="mr-2 h-4 w-4" />
              Criar orçamento
            </Button>
            <ComparisonPresentationLauncher products={products} formatCurrency={formatCurrency} />
            <ExportComparisonButton products={products} formatCurrency={formatCurrency} />
            <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
              <Share2 className="mr-2 h-4 w-4" />
              Compartilhar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                clearCompare();
                navigate('/');
              }}
            >
              Limpar
            </Button>
          </div>
        </div>

        {/* Mobile carousel view (<768px) */}
        <ComparisonMobileView
          products={products}
          formatCurrency={formatCurrency}
          onRemove={removeByIndex}
          onProductClick={(id) => navigate(`/produto/${id}`)}
        />

        {/* Desktop view (>=768px) */}
        <div className="hidden space-y-4 md:block">
          {/* Score + Radar */}
          <div className={cn('grid grid-cols-1 gap-4', showRadar && 'lg:grid-cols-2')}>
            <ComparisonScoreCard products={products} />
            {showRadar && <ComparisonRadarChart products={products} />}
          </div>
          <AIComparisonAdvisor products={products} />

          {/* Duel mode toggle (only visible when 2 products) */}
          {compareCount === 2 && (
            <div className="flex items-center justify-center">
              <Button
                size="sm"
                variant={duelMode ? 'default' : 'outline'}
                onClick={() => setDuelMode((v) => !v)}
              >
                <Swords className="mr-2 h-4 w-4" />
                {duelMode ? 'Modo Duelo ativo' : 'Ativar Modo Duelo'}
              </Button>
            </div>
          )}

          {compareCount === 2 && duelMode ? (
            <ComparisonDuelView
              products={products}
              formatCurrency={formatCurrency}
              onRemove={removeByIndex}
              onProductClick={(id) => navigate(`/produto/${id}`)}
            />
          ) : (
            <Tabs defaultValue="gallery" className="w-full">
              <TabsList className="mx-auto mb-6 grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="gallery" className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Galeria Visual
                </TabsTrigger>
                <TabsTrigger value="table" className="flex items-center gap-2">
                  <List className="h-4 w-4" />
                  Tabela Detalhada
                </TabsTrigger>
              </TabsList>

              <TabsContent value="gallery" className="space-y-6">
                <SyncedZoomGallery
                  products={products}
                  onProductClick={(id) => navigate(`/produto/${id}`)}
                />
                <div
                  className={cn(
                    'grid gap-4',
                    products.length === 2 && 'grid-cols-2',
                    products.length === 3 && 'grid-cols-3',
                    products.length >= 4 && 'grid-cols-2 lg:grid-cols-4',
                  )}
                >
                  {compareEntries.map((entry) => {
                    const status = getStockStatusLabel(entry.product.stockStatus);
                    return (
                      <div
                        key={`card-${entry.index}`}
                        data-compare-product={entry.index}
                        tabIndex={-1}
                        className="card-lift space-y-3 rounded-xl border-[1.5px] border-primary/20 bg-card p-4 transition-all duration-300 hover:border-primary/50 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-primary">
                              {formatCurrency(entry.product.price)}
                            </span>
                            {entry.variant?.color_name && (
                              <Badge
                                variant="secondary"
                                className="gap-1 px-1.5 py-0.5 text-[10px]"
                              >
                                {entry.variant.color_hex && (
                                  <span
                                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-border/50"
                                    style={{ backgroundColor: entry.variant.color_hex }}
                                  />
                                )}
                                {entry.variant.color_name}
                              </Badge>
                            )}
                          </div>
                          <button
                            aria-label="Remover"
                            onClick={() => removeByIndex(entry.index)}
                            className="rounded-full p-1 transition-colors hover:bg-destructive/20"
                          >
                            <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          </button>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Mín:</span>
                            <span>{entry.product.minQuantity} un.</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Estoque:</span>
                            <span className={status.color}>{status.label}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Cores:</span>
                            <div className="flex gap-0.5">
                              {entry.product.colors.slice(0, 4).map((c: ProductColor) => (
                                <div
                                  key={c.hex}
                                  className="h-4 w-4 rounded-full border border-border"
                                  style={{ backgroundColor: c.hex }}
                                />
                              ))}
                              {entry.product.colors.length > 4 && (
                                <span className="ml-1 text-xs text-muted-foreground">
                                  +{entry.product.colors.length - 4}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => navigate(`/produto/${entry.product.id}`)}
                        >
                          Ver Detalhes
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="table">
                <CompareTableView
                  entries={compareEntries}
                  products={products}
                  formatCurrency={formatCurrency}
                  getStockStatusLabel={getStockStatusLabel}
                  onRemove={removeByIndex}
                  differencesOnly={differencesOnly}
                />
              </TabsContent>
            </Tabs>
          )}

          {/* Bottom rail — Compare também com... */}
          <SimilarProductsRail products={products} formatCurrency={formatCurrency} />
        </div>
      </div>
    </>
  );
}
