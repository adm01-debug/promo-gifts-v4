import { useState, useMemo } from 'react';
import { PageSEO } from '@/components/seo/PageSEO';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Search, Camera, Image as ImageIcon, Zap, ArrowRight, Loader2, RefreshCcw, Filter, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ExternalCategoryFilter } from '@/components/filters/ExternalCategoryFilter';
import { ColorSwatchBar, type ColorFilterSelection } from '@/components/filters/ColorGroupFilter';
import { useExternalCategoriesQuery, useColorSystem } from '@/hooks/products';

interface VisualSearchResult {
  analysis: {
    productType: string;
    material: string;
    colors: string[];
    category: string;
    keywords: string[];
    description: string;
  };
  products: Array<{
    id: string;
    name: string;
    sku: string;
    category_name: string;
    price: number;
    images: string[];
    relevance: number;
  }>;
  searchTerms: string;
}

export default function VisualSearchPage() {
  const navigate = useNavigate();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [results, setResults] = useState<VisualSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [colorSelection, setColorSelection] = useState<ColorFilterSelection>({
    groups: [],
    variations: [],
    nuances: [],
  });

  const { data: categories = [] } = useExternalCategoriesQuery();
  const { data: colorData } = useColorSystem();

  // Resolve nomes selecionados para passar à IA
  const selectedCategoryNames = useMemo(() => {
    if (!selectedCategoryIds.length) return [];
    const map = new Map(categories.map((c) => [c.id, c.name]));
    return selectedCategoryIds.map((id) => map.get(id)).filter(Boolean) as string[];
  }, [selectedCategoryIds, categories]);

  const selectedColorNames = useMemo(() => {
    if (!colorData) return [];
    const names: string[] = [];
    colorData.groups.forEach((g) => {
      if (colorSelection.groups.includes(g.slug)) names.push(g.name);
      g.variations.forEach((v) => {
        if (colorSelection.variations.includes(v.slug)) names.push(v.name);
      });
    });
    return names;
  }, [colorSelection, colorData]);

  const hasRefinements = selectedCategoryIds.length > 0 || selectedColorNames.length > 0;

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem válida.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      setPreviewUrl(base64);
      processImage(base64);
    };
    reader.readAsDataURL(file);
  };

  const processImage = async (base64: string) => {
    setIsSearching(true);
    setResults(null);

    try {
      const { data, error } = await supabase.functions.invoke('visual-search', {
        body: {
          imageBase64: base64.split(',')[1],
          category: selectedCategoryNames.length ? selectedCategoryNames.join(', ') : undefined,
          color: selectedColorNames.length ? selectedColorNames.join(', ') : undefined,
        }
      });

      if (error) throw error;
      setResults(data);
      toast.success('Análise concluída com sucesso!');
    } catch (err: any) {
      console.error('Visual search error:', err);
      toast.error('Erro ao analisar imagem', {
        description: err.message || 'Tente novamente com outra imagem.'
      });
    } finally {
      setIsSearching(false);
    }
  };

  const reset = () => {
    setPreviewUrl(null);
    setResults(null);
    setIsSearching(false);
    setSelectedCategoryIds([]);
    setColorSelection({ groups: [], variations: [], nuances: [] });
  };

  return (
    <>
      <PageSEO 
        title="Raio X — Busca Visual por IA" 
        description="Identifique produtos instantaneamente através de fotos usando inteligência artificial."
        path="/raio-x"
      />
      
      <div className="mx-auto w-full max-w-[1920px] space-y-6 px-3 py-4 sm:px-4 lg:px-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60 shadow-lg shadow-primary/20">
              <Zap className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight">Raio X</h1>
              <p className="text-sm text-muted-foreground">Identificação instantânea de produtos por imagem</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Upload Area */}
          <div className="lg:col-span-4 space-y-4">
            <Card className="overflow-hidden border-2 border-dashed border-muted-foreground/20 bg-muted/5 transition-colors hover:bg-muted/10">
              <CardContent className="p-0">
                {previewUrl ? (
                  <div className="relative group">
                    <img src={previewUrl} alt="Preview" className="aspect-square w-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button variant="secondary" size="sm" onClick={reset} className="gap-2">
                        <RefreshCcw className="h-4 w-4" /> Trocar Imagem
                      </Button>
                    </div>
                  </div>
                ) : (
                  <label 
                    className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-4 p-6 text-center"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleFileUpload({ target: { files: [file] } } as any);
                    }}
                  >
                    <div className="rounded-full bg-primary/10 p-4">
                      <Camera className="h-10 w-10 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-base font-semibold">Anexar foto do produto</p>
                      <p className="text-xs text-muted-foreground">Clique para selecionar ou arraste a imagem</p>
                    </div>
                    <input id="visual-search-input" type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                  </label>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  <Filter className="h-4 w-4" /> Refinar Busca
                </CardTitle>
                <CardDescription className="text-xs">
                  Selecione categorias e cores reais do catálogo para ajudar a IA
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Categoria (banco externo, hierárquica) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">
                      Categoria Estimada
                      {selectedCategoryIds.length > 0 && (
                        <Badge variant="secondary" className="ml-2 text-[10px]">
                          {selectedCategoryIds.length}
                        </Badge>
                      )}
                    </Label>
                    {selectedCategoryIds.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive"
                        onClick={() => setSelectedCategoryIds([])}
                      >
                        <X className="h-3 w-3 mr-1" /> Limpar
                      </Button>
                    )}
                  </div>
                  <div className="rounded-md border border-border/60 bg-background/50 p-1">
                    <ExternalCategoryFilter
                      selectedCategories={selectedCategoryIds}
                      onCategoriesChange={setSelectedCategoryIds}
                      compact
                    />
                  </div>
                </div>

                {/* Cor (color_groups do banco externo) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">
                      Cor do Produto
                      {selectedColorNames.length > 0 && (
                        <Badge variant="secondary" className="ml-2 text-[10px]">
                          {selectedColorNames.length}
                        </Badge>
                      )}
                    </Label>
                    {selectedColorNames.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive"
                        onClick={() => setColorSelection({ groups: [], variations: [], nuances: [] })}
                      >
                        <X className="h-3 w-3 mr-1" /> Limpar
                      </Button>
                    )}
                  </div>
                  <ColorSwatchBar selection={colorSelection} onChange={setColorSelection} />
                  {selectedColorNames.length > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      {selectedColorNames.join(', ')}
                    </p>
                  )}
                </div>

                {previewUrl && !isSearching && (
                  <Button
                    className="w-full gap-2"
                    onClick={() => processImage(previewUrl)}
                  >
                    <Search className="h-4 w-4" />
                    {results ? 'Refinar análise' : 'Analisar Imagem'}
                  </Button>
                )}
              </CardContent>
            </Card>

            {results && (
              <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Análise da IA</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Tipo Identificado</p>
                    <p className="text-sm font-semibold text-foreground">{results.analysis.productType}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Material</p>
                    <p className="text-sm font-semibold text-foreground">{results.analysis.material}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {results.analysis.keywords.map((kw, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] uppercase">{kw}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Results Area */}
          <div className="lg:col-span-8 space-y-4">
            {!previewUrl && !isSearching && (
              <Card className="border-dashed py-20">
                <CardContent className="flex flex-col items-center justify-center text-center">
                  <div className="mb-4 rounded-full bg-muted p-6">
                    <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
                  </div>
                  <h3 className="font-display text-xl font-bold">Aguardando imagem...</h3>
                  <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                    Envie uma foto de qualquer brinde para localizarmos modelos idênticos ou similares em nosso catálogo.
                  </p>
                </CardContent>
              </Card>
            )}

            {isSearching && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 animate-pulse">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <p className="text-sm font-medium text-primary">A Inteligência Artificial está analisando as características do produto...</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {[1, 2, 3, 4].map((i) => (
                    <Card key={i} className="overflow-hidden">
                      <Skeleton className="aspect-video w-full" />
                      <div className="p-4 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {results && (
              <div className="space-y-4 animate-in fade-in duration-700">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg font-bold">Produtos Encontrados ({results.products.length})</h2>
                  <Badge variant="outline" className="gap-1.5">
                    <Search className="h-3 w-3" /> Termos: {results.searchTerms}
                  </Badge>
                </div>

                {results.products.length === 0 ? (
                  <Card className="py-12">
                    <CardContent className="flex flex-col items-center justify-center text-center">
                      <Search className="mb-4 h-12 w-12 text-muted-foreground/30" />
                      <p className="text-sm font-medium">Nenhum produto correspondente no catálogo.</p>
                      <p className="text-xs text-muted-foreground">Tente uma foto com melhor iluminação ou fundo neutro.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {results.products.map((product) => (
                      <Card 
                        key={product.id} 
                        className="group cursor-pointer overflow-hidden transition-all hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5"
                        onClick={() => navigate(`/produto/${product.id}`)}
                      >
                        <div className="relative aspect-square overflow-hidden bg-muted">
                          <img 
                            src={product.images?.[0] || '/placeholder.svg'} 
                            alt={product.name}
                            className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-110"
                          />
                          <div className="absolute top-2 right-2">
                            <Badge className="bg-background/90 text-foreground backdrop-blur-sm">
                              {Math.round(product.relevance * 100)}% Match
                            </Badge>
                          </div>
                        </div>
                        <CardContent className="p-4">
                          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            {product.sku}
                          </div>
                          <h3 className="mb-2 line-clamp-2 text-sm font-bold leading-tight group-hover:text-primary">
                            {product.name}
                          </h3>
                          <div className="flex items-center justify-between border-t border-border/50 pt-3">
                            <span className="text-base font-black text-foreground">
                              {formatCurrency(product.price)}
                            </span>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full opacity-0 transition-opacity group-hover:opacity-100">
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
