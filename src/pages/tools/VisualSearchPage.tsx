import { useState, useMemo, useRef, useEffect } from 'react';
import { PageSEO } from '@/components/seo/PageSEO';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { 
  Search, 
  Camera, 
  Image as ImageIcon, 
  Zap, 
  ArrowRight, 
  Loader2, 
  RefreshCcw, 
  Filter, 
  X,
  Target,
  Info,
  CheckCircle2,
  AlertCircle,
  History,
  Trash2,
  Maximize2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ExternalCategoryFilter } from '@/components/filters/ExternalCategoryFilter';
import { ColorSwatchBar, type ColorFilterSelection } from '@/components/filters/ColorGroupFilter';
import { useExternalCategoriesQuery, useColorSystem } from '@/hooks/products';
import { motion, AnimatePresence } from 'framer-motion';

interface VisualSearchResult {
  analysis: {
    productType: string;
    material: string;
    colors: string[];
    category: string;
    keywords: string[];
    description: string;
    confidence: number;
    rationale: string;
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

interface SearchHistoryItem {
  id: string;
  timestamp: number;
  imageUrl: string;
  productType: string;
}

export default function VisualSearchPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [results, setResults] = useState<VisualSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [colorSelection, setColorSelection] = useState<ColorFilterSelection>({
    groups: [],
    variations: [],
    nuances: [],
  });

  const { data: categories = [] } = useExternalCategoriesQuery();
  const { data: colorData } = useColorSystem();

  // Load history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('visual-search-history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Failed to parse search history');
      }
    }
  }, []);

  const saveToHistory = (imageUrl: string, productType: string) => {
    const newItem: SearchHistoryItem = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      imageUrl,
      productType
    };
    const updatedHistory = [newItem, ...history.slice(0, 9)];
    setHistory(updatedHistory);
    localStorage.setItem('visual-search-history', JSON.stringify(updatedHistory));
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('visual-search-history');
    toast.success('Histórico limpo');
  };

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

  const processImage = async (base64: string, manualKeywords?: string) => {
    setIsSearching(true);
    setResults(null);

    try {
      const { data, error } = await supabase.functions.invoke('visual-search', {
        body: {
          imageBase64: base64.split(',')[1],
          category: selectedCategoryNames.length ? selectedCategoryNames.join(', ') : undefined,
          color: selectedColorNames.length ? selectedColorNames.join(', ') : undefined,
          manualKeywords // Opcional para refinamento via clique nas tags
        }
      });

      if (error) throw error;
      setResults(data);
      saveToHistory(base64, data.analysis.productType);
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

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return { label: 'Alta Precisão', color: 'text-emerald-500', bg: 'bg-emerald-500/10' };
    if (confidence >= 0.5) return { label: 'Precisão Média', color: 'text-amber-500', bg: 'bg-amber-500/10' };
    return { label: 'Baixa Precisão', color: 'text-rose-500', bg: 'bg-rose-500/10' };
  };

  return (
    <>
      <PageSEO 
        title="Raio X — Busca Visual por IA" 
        description="Identifique produtos instantaneamente através de fotos usando inteligência artificial."
        path="/raio-x"
      />
      
      <div className="mx-auto w-full max-w-[1920px] space-y-6 px-3 py-4 sm:px-4 lg:px-6">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="group relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60 shadow-lg shadow-primary/20"
            >
              <Zap className="h-6 w-6 text-primary-foreground transition-transform group-hover:rotate-12" />
              <div className="absolute inset-0 animate-ping rounded-xl bg-primary/20" />
            </motion.div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight">Raio X</h1>
              <p className="text-sm text-muted-foreground">O "Shazam" do catálogo: tire uma foto e encontre o produto</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Sidebar Area */}
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-20 lg:h-fit">
            {/* Upload & Preview */}
            <Card className={cn(
              "relative overflow-hidden border-2 border-dashed transition-all duration-300",
              isDragging ? "border-primary bg-primary/5 scale-[1.02]" : "border-muted-foreground/20 bg-muted/5 hover:border-primary/30"
            )}>
              <CardContent className="p-0">
                <AnimatePresence mode="wait">
                  {previewUrl ? (
                    <motion.div 
                      key="preview"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="relative overflow-hidden group"
                    >
                      <img src={previewUrl} alt="Preview" className="aspect-square w-full object-cover" />
                      
                      {/* Scanning Line Animation */}
                      {isSearching && (
                        <motion.div 
                          className="absolute left-0 top-0 z-10 h-1 w-full bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_20px_rgba(var(--primary),1)]"
                          animate={{ 
                            top: ['0%', '100%', '0%'] 
                          }}
                          transition={{ 
                            duration: 2, 
                            repeat: Infinity, 
                            ease: "linear" 
                          }}
                        />
                      )}
                      
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                        <div className="flex flex-col gap-2">
                          <Button variant="secondary" size="sm" onClick={reset} className="gap-2">
                            <RefreshCcw className="h-4 w-4" /> Trocar Foto
                          </Button>
                          <Button variant="outline" size="sm" className="gap-2 bg-white/10 text-white border-white/20">
                            <Maximize2 className="h-4 w-4" /> Ver Original
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.label 
                      key="upload"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-4 p-6 text-center"
                      onDragEnter={() => setIsDragging(true)}
                      onDragLeave={() => setIsDragging(false)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) handleFileUpload({ target: { files: [file] } } as any);
                      }}
                    >
                      <div className="relative">
                        <div className="absolute inset-0 animate-pulse bg-primary/20 blur-xl rounded-full" />
                        <div className="relative rounded-full bg-primary/10 p-5 transition-transform hover:scale-110">
                          <Camera className="h-10 w-10 text-primary" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-base font-bold">Solte a foto do produto aqui</p>
                        <p className="text-xs text-muted-foreground">Ou clique para tirar uma foto agora</p>
                      </div>
                      <input 
                        ref={fileInputRef}
                        id="visual-search-input" 
                        type="file" 
                        className="hidden" 
                        accept="image/*" 
                        capture="environment" // Habilita câmera nativa no mobile
                        onChange={handleFileUpload} 
                      />
                    </motion.label>
                  )}
                </AnimatePresence>
                
                {/* Drag Overlay */}
                {isDragging && (
                  <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary/20 backdrop-blur-[2px]">
                    <div className="flex flex-col items-center gap-2 rounded-2xl bg-background/90 p-8 shadow-2xl border border-primary/50">
                      <ImageIcon className="h-12 w-12 text-primary animate-bounce" />
                      <p className="font-bold text-primary">Solte para analisar!</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Refinement Filters */}
            <Card className="border-border/50 bg-background/50 backdrop-blur-sm overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <CardHeader className="pb-3 relative">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <Filter className="h-3 w-3" /> Refinar Busca
                  </CardTitle>
                </div>
                <CardDescription className="text-[11px]">
                  Pistas extras aumentam em até 40% a precisão
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 relative">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] font-bold uppercase text-muted-foreground">Categoria</Label>
                    {selectedCategoryIds.length > 0 && (
                      <button onClick={() => setSelectedCategoryIds([])} className="text-[10px] text-primary hover:underline">Limpar</button>
                    )}
                  </div>
                  <div className="rounded-md border border-border/40 bg-background/80 focus-within:border-primary/50 transition-colors">
                    <ExternalCategoryFilter
                      selectedCategories={selectedCategoryIds}
                      onCategoriesChange={setSelectedCategoryIds}
                      compact
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] font-bold uppercase text-muted-foreground">Cor Predominante</Label>
                    {selectedColorNames.length > 0 && (
                      <button onClick={() => setColorSelection({ groups: [], variations: [], nuances: [] })} className="text-[10px] text-primary hover:underline">Limpar</button>
                    )}
                  </div>
                  <ColorSwatchBar selection={colorSelection} onChange={setColorSelection} />
                </div>

                {previewUrl && !isSearching && (
                  <Button
                    className="w-full gap-2 shadow-lg shadow-primary/20 transition-all active:scale-95"
                    onClick={() => processImage(previewUrl)}
                  >
                    <Target className="h-4 w-4" />
                    {results ? 'Refazer Análise' : 'Iniciar Raio X'}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* AI Analysis Details */}
            {results && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="overflow-hidden border-primary/20 bg-primary/5 shadow-inner">
                  <CardHeader className="pb-2 border-b border-primary/10 bg-primary/10">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
                        <Info className="h-3 w-3" /> Relatório da IA
                      </CardTitle>
                      {results.analysis.confidence && (
                        <div className={cn(
                          "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm",
                          getConfidenceLabel(results.analysis.confidence).bg,
                          getConfidenceLabel(results.analysis.confidence).color
                        )}>
                          {Math.round(results.analysis.confidence * 100)}% Confiança
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Produto</p>
                        <p className="text-xs font-semibold leading-tight group cursor-pointer hover:text-primary transition-colors" onClick={() => processImage(previewUrl!, results.analysis.productType)}>
                          {results.analysis.productType}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Material</p>
                        <p className="text-xs font-semibold leading-tight group cursor-pointer hover:text-primary transition-colors" onClick={() => processImage(previewUrl!, results.analysis.material)}>
                          {results.analysis.material}
                        </p>
                      </div>
                    </div>
                    
                    {results.analysis.rationale && (
                      <div className="rounded-lg bg-background/50 border border-primary/5 p-2 text-[11px] text-muted-foreground italic leading-relaxed">
                        <div className="flex items-start gap-1.5">
                          <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
                          <p>"{results.analysis.rationale}"</p>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1.5">
                      {results.analysis.keywords.map((kw, i) => (
                        <Badge 
                          key={i} 
                          variant="secondary" 
                          className="h-5 cursor-pointer border-transparent bg-background/80 px-2 text-[9px] font-medium uppercase text-primary hover:bg-primary hover:text-white transition-all"
                          onClick={() => processImage(previewUrl!, kw)}
                        >
                          {kw}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* History Section */}
            {history.length > 0 && !previewUrl && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between px-1">
                  <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <History className="h-3 w-3" /> Últimas Buscas
                  </h3>
                  <Button variant="ghost" size="sm" onClick={clearHistory} className="h-6 px-2 text-[10px] text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3 w-3 mr-1" /> Limpar
                  </Button>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {history.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setPreviewUrl(item.imageUrl);
                        processImage(item.imageUrl);
                      }}
                      className="group relative aspect-square overflow-hidden rounded-md border border-border/40 hover:border-primary transition-all active:scale-90"
                    >
                      <img src={item.imageUrl} alt={item.productType} className="h-full w-full object-cover transition-transform group-hover:scale-110" />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <RefreshCcw className="h-3 w-3 text-white" />
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* Results Area */}
          <div className="lg:col-span-8 space-y-4">
            {!previewUrl && !isSearching && (
              <div className="flex h-full min-h-[500px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/5 p-12 text-center group">
                <div className="relative mb-6">
                  <div className="absolute inset-0 scale-150 animate-pulse bg-primary/10 blur-2xl rounded-full" />
                  <motion.div 
                    whileHover={{ rotate: 5, scale: 1.05 }}
                    className="relative rounded-full bg-background p-10 shadow-2xl border border-border/50"
                  >
                    <ImageIcon className="h-20 w-20 text-muted-foreground/20" />
                    <div className="absolute -right-2 -top-2 rounded-full bg-primary p-2 shadow-lg">
                      <Zap className="h-5 w-5 text-primary-foreground" />
                    </div>
                  </motion.div>
                </div>
                <h3 className="mb-2 font-display text-3xl font-bold tracking-tight">O futuro da busca de brindes</h3>
                <p className="mx-auto max-w-sm text-sm text-muted-foreground leading-relaxed">
                  Poupe horas de catálogo. Nossa IA exclusiva digitaliza fotos enviadas por clientes e localiza correspondências exatas em segundos.
                </p>
                <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                  <Button 
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-2 px-10 h-12 text-base shadow-xl shadow-primary/20"
                  >
                    <Camera className="h-5 w-5" /> Iniciar Scanner
                  </Button>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest block w-full">ou arraste um arquivo aqui</p>
                </div>
              </div>
            )}

            {isSearching && (
              <div className="space-y-6">
                <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 p-8">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(var(--primary),0.1),transparent)]" />
                  <div className="relative flex flex-col items-center gap-6 text-center">
                    <div className="relative">
                      <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
                      <Target className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-primary animate-pulse" />
                    </div>
                    <div className="space-y-2 max-w-md">
                      <p className="text-xl font-bold text-primary">Análise Biométrica do Produto</p>
                      <Progress value={65} className="h-1.5 w-full bg-primary/10" />
                      <p className="text-xs text-muted-foreground italic animate-pulse">
                        "Extraindo silhueta, identificando porosidade do material e mapeando cores secundárias..."
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Card key={i} className="overflow-hidden border-border/40 shadow-sm">
                      <Skeleton className="aspect-square w-full" />
                      <div className="p-5 space-y-4">
                        <div className="flex justify-between items-center">
                          <Skeleton className="h-3 w-1/4" />
                          <Skeleton className="h-3 w-1/4" />
                        </div>
                        <Skeleton className="h-5 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                        <div className="flex items-center justify-between pt-4 border-t border-border/50">
                          <Skeleton className="h-7 w-1/3" />
                          <Skeleton className="h-9 w-9 rounded-full" />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {results && (
              <div className="space-y-5">
                <div className="flex items-end justify-between px-1">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">Top Matches</h2>
                      <Badge variant="outline" className="border-primary/20 text-primary bg-primary/5">Premium AI Search</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Target className="h-3 w-3" /> Resultados ordenados por similaridade visual e técnica
                    </p>
                  </div>
                  <Badge variant="secondary" className="gap-1.5 px-4 py-1.5 text-xs font-black tracking-widest bg-foreground text-background">
                    {results.products.length} RESULTADOS
                  </Badge>
                </div>

                {results.products.length === 0 ? (
                  <Card className="py-24 border-dashed bg-muted/5 relative overflow-hidden">
                    <div className="absolute inset-0 bg-grid-black/[0.02]" />
                    <CardContent className="flex flex-col items-center justify-center text-center relative">
                      <div className="mb-6 rounded-full bg-background p-6 shadow-xl border border-border/50">
                        <AlertCircle className="h-12 w-12 text-amber-500/40" />
                      </div>
                      <h4 className="text-xl font-bold">Nenhuma correspondência perfeita</h4>
                      <p className="mt-2 text-sm text-muted-foreground max-w-sm leading-relaxed">
                        Não encontramos este modelo específico no catálogo atual. <br />
                        <span className="font-bold text-primary">Dica:</span> Tente remover o filtro de "Cor" ou clique nas tags de "Keywords" no relatório lateral para uma busca por similaridade funcional.
                      </p>
                      <Button variant="outline" className="mt-8 gap-2" onClick={reset}>
                        <RefreshCcw className="h-4 w-4" /> Resetar e tentar novamente
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {results.products.map((product, idx) => (
                      <motion.div
                        key={product.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.04, duration: 0.4 }}
                      >
                        <Card 
                          className={cn(
                            "group h-full cursor-pointer overflow-hidden border-border/40 transition-all duration-500 hover:border-primary/40 active:scale-[0.98] relative",
                            product.relevance >= 0.9 ? "hover:shadow-[0_0_30px_rgba(var(--primary),0.15)] ring-1 ring-transparent hover:ring-primary/20" : "hover:shadow-2xl"
                          )}
                          onClick={() => navigate(`/produto/${product.id}`)}
                        >
                          <div className="relative aspect-square overflow-hidden bg-white/50 p-6 flex items-center justify-center">
                            <img 
                              src={product.images?.[0] || '/placeholder.svg'} 
                              alt={product.name}
                              className="h-full w-full object-contain transition-transform duration-700 group-hover:scale-110 drop-shadow-md"
                            />
                            
                            {/* Match Overlay */}
                            <div className="absolute top-4 right-4">
                              <div className={cn(
                                "flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black shadow-lg backdrop-blur-md transition-all group-hover:scale-110",
                                product.relevance >= 0.9 ? "bg-emerald-500 text-white" : "bg-white/95 text-foreground border border-border"
                              )}>
                                {product.relevance >= 0.9 && <CheckCircle2 className="h-3 w-3" />}
                                {Math.round(product.relevance * 100)}% Match
                              </div>
                            </div>

                            {/* Ranking Badge for Top 3 */}
                            {idx < 3 && (
                              <div className="absolute top-4 left-4">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-[10px] font-black text-primary backdrop-blur-sm">
                                  #{idx + 1}
                                </div>
                              </div>
                            )}

                            {/* Hover Quick Actions */}
                            <div className="absolute inset-x-0 bottom-0 flex translate-y-full items-center justify-center bg-gradient-to-t from-black/80 to-transparent p-5 transition-transform duration-500 group-hover:translate-y-0">
                              <div className="flex items-center gap-2 text-[10px] font-bold text-white uppercase tracking-widest">
                                <Search className="h-3 w-3" /> Ficha Técnica Completa
                              </div>
                            </div>
                          </div>
                          
                          <CardContent className="p-5 flex flex-col justify-between">
                            <div className="space-y-1 mb-4">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{product.sku}</span>
                                <span className="text-[10px] font-bold text-primary/70 truncate max-w-[120px] bg-primary/5 px-1.5 rounded">{product.category_name}</span>
                              </div>
                              <h3 className="line-clamp-2 min-h-[2.8rem] text-[15px] font-bold leading-snug tracking-tight transition-colors group-hover:text-primary">
                                {product.name}
                              </h3>
                            </div>
                            
                            <div className="flex items-center justify-between border-t border-border/50 pt-4">
                              <div className="flex flex-col">
                                <span className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest">Preço Sugerido</span>
                                <span className="text-xl font-black tracking-tighter text-foreground">
                                  {formatCurrency(product.price)}
                                </span>
                              </div>
                              <motion.div 
                                whileHover={{ x: 3 }}
                                className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/5 text-primary transition-all group-hover:bg-primary group-hover:text-primary-foreground shadow-sm"
                              >
                                <ArrowRight className="h-5 w-5" />
                              </motion.div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                )}
                
                {/* Visual Search Disclaimer */}
                <p className="text-[10px] text-center text-muted-foreground/60 italic py-8">
                  * A precisão da análise depende da qualidade da iluminação e nitidez da imagem original.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}