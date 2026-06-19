import { useState, useMemo, useRef, useEffect } from 'react';
import { logger } from '@/lib/logger';
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
  TrendingUp,
  Mic,
  MicOff,
  Eye
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ExternalCategoryFilter } from '@/components/filters/ExternalCategoryFilter';
import { ColorSwatchBar, type ColorFilterSelection } from '@/components/filters/ColorGroupFilter';
import { useExternalCategoriesQuery, useColorSystem } from '@/hooks/products';
import { m as motion, AnimatePresence } from 'framer-motion';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { getCdnUrl } from '@/utils/image-utils';

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
    visualEvidence?: {
      material: string;
      silhouette: string;
      finish: string;
    };
    visualHighlights?: Array<{
      label: string;
      x: number;
      y: number;
      description: string;
    }>;
  };
  products: Array<{
    id: string;
    name: string;
    sku: string;
    category_name: string;
    price: number;
    images: string[];
    relevance: number;
    matchRationale?: string;
    stock?: number;
    totalFound?: number;
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
  const [showHotspots, setShowHotspots] = useState(true);
  const [hotspotOpacity, setHotspotOpacity] = useState(1);

  const [isListening, setIsListening] = useState(false);
  const [hoveredProduct, setHoveredProduct] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<{ message: string; tip: string } | null>(null);

  const { data: categories = [] } = useExternalCategoriesQuery();
  const { data: colorData } = useColorSystem();

  const startVoiceCommand = () => {
    if (!('webkitSpeechRecognition' in window)) {
      toast.error("Seu navegador não suporta comandos de voz.");
      return;
    }

    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
      toast.info("Ouvindo comandos...");
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const command = event.results[0][0].transcript.toLowerCase();
      handleVoiceCommand(command);
    };

    recognition.onerror = () => {
      setIsListening(false);
      toast.error("Erro ao processar comando de voz.");
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const handleVoiceCommand = (command: string) => {
    if (command.includes('alumínio') || command.includes('metal')) {
      // Find category or add to search terms
      toast.success("Filtrando por Alumínio...");
      if (previewUrl) processImage(previewUrl, "alumínio");
    } else if (command.includes('90') || command.includes('noventa')) {
      toast.success("Mostrando apenas alta confiança...");
      setResults(prev => prev ? {
        ...prev,
        products: prev.products.filter(p => p.relevance >= 0.9)
      } : null);
    } else if (command.includes('reset') || command.includes('limpar')) {
      reset();
    } else {
      toast.info(`Comando não reconhecido: "${command}"`);
    }
  };

  // Load history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('visual-search-history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch {
        logger.error('Failed to parse search history');
      }
    }
  }, []);

  // Automatic re-analysis when filters change
  useEffect(() => {
    if (previewUrl && !isSearching && results) {
      // Automatic re-analysis when filters change
      processImage(previewUrl);
    }
    // Intencionalmente dispara APENAS quando filtros mudam; incluir
    // results/processImage causaria loop de re-análise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategoryIds, colorSelection]);

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

  const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Formato inválido. Selecione uma imagem (JPG, PNG, WEBP, GIF).');
      return;
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      toast.error(
        `Imagem muito grande (${(file.size / 1024 / 1024).toFixed(1)} MB). O limite é 5 MB.`,
        { description: 'Redimensione ou comprima a imagem e tente novamente.' }
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setPreviewUrl(base64);
      processImage(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleFile(file);
  };

  const processImage = async (base64: string, manualKeywords?: string) => {
    setIsSearching(true);
    setAnalysisError(null);
    // When re-analyzing, we don't clear results immediately to show the "Reanalyzing" state
    if (!results) setResults(null);

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
    } catch (rawErr: unknown) {
      logger.error('Visual search error:', rawErr);
      const err = rawErr as {
        message?: string;
        name?: string;
        status?: number;
        context?: { json?: () => Promise<{ error?: string; step?: string; requestId?: string }> };
      };
      
      let friendlyMessage = 'Ocorreu um problema na análise da imagem.';
      let tip = 'Tente novamente com outra foto ou verifique sua conexão.';
      let debugInfo = '';

      // Tenta extrair informações detalhadas do erro retornado pelo Edge Function
      if (err.context && typeof err.context.json === 'function') {
        try {
          const errorData = await err.context.json();
          if (errorData.error) friendlyMessage = errorData.error;
          if (errorData.step) debugInfo = ` [Passo: ${errorData.step}]`;
          if (errorData.requestId) debugInfo += ` [ID: ${errorData.requestId}]`;
        } catch (e) {
          logger.warn('Could not parse error context json', e);
        }
      } else if (err.message) {
        // Fallback para mensagens diretas
        if (err.message.includes('Configuração ausente')) {
          friendlyMessage = 'Erro de Configuração: O backend não possui as chaves de API necessárias.';
          tip = 'Verifique as variáveis de ambiente LOVABLE_API_KEY ou HF_ACCESS_TOKEN no dashboard do Supabase.';
        } else {
          friendlyMessage = err.message;
        }
      }
      
      if (err.message?.includes('400') || err.message?.includes('payload too large')) {
        friendlyMessage = 'A imagem é muito grande ou pesada para processar.';
        tip = 'Dica: Tente usar uma foto com resolução menor ou em formato JPG/PNG.';
      } else if (err.message?.includes('500') || err.status === 500) {
        // Se já não tivermos uma mensagem mais específica do backend
        if (friendlyMessage === 'Ocorreu um problema na análise da imagem.') {
          friendlyMessage = 'Nossos servidores de IA estão temporariamente ocupados.';
          tip = 'Dica: Aguarde alguns segundos e clique em "Tentar Novamente". Verifique se o produto está bem centralizado.';
        }
      } else if (err.message?.includes('network') || err.name === 'TypeError') {
        friendlyMessage = 'Houve uma falha de conexão.';
        tip = 'Dica: Verifique seu sinal de internet e tente reenviar a foto.';
      }

      setAnalysisError({ message: `${friendlyMessage}${debugInfo}`, tip });
      
      toast.error('Erro ao analisar imagem', {
        description: friendlyMessage
      });
    } finally {
      setIsSearching(false);
    }
  };

  const reset = () => {
    setPreviewUrl(null);
    setResults(null);
    setIsSearching(false);
    setAnalysisError(null);
    // Preserving filters can be useful for re-analysis, but let's clear on hard reset
    setSelectedCategoryIds([]);
    setColorSelection({ groups: [], variations: [], nuances: [] });
  };

  const handleFeedback = async (isCorrect: boolean, productId?: string, relevance?: number, notes?: string) => {
    if (!results || !previewUrl) return;

    try {
      const { error } = await supabase
        .from('visual_search_feedback')
        .insert({
          image_url: previewUrl,
          original_analysis: results.analysis,
          is_correct: isCorrect,
          feedback_notes: notes,
          search_terms: results.searchTerms,
          product_id: productId,
          match_relevance: relevance
        });

      if (error) throw error;
      toast.success(isCorrect ? 'Obrigado pelo feedback!' : 'Feedback registrado. Isso ajudará a melhorar a IA.');
    } catch (err) {
      logger.error('Feedback error:', err);
    }
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
            <div className="flex-1">
              <h1 data-testid="raio-x-title" className="font-display text-2xl font-bold tracking-tight">Raio X</h1>
              <p className="text-sm text-muted-foreground">O "Shazam" do catálogo: tire uma foto e encontre o produto</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={isListening ? "default" : "outline"}
                size="sm"
                className={cn("h-9 gap-2", isListening && "animate-pulse bg-red-500 hover:bg-red-600")}
                onClick={startVoiceCommand}
              >
                {isListening ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                <span className="hidden sm:inline">{isListening ? "Ouvindo..." : "Comandos de Voz"}</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Hidden file input — único ponto de upload, acionado pelo CTA principal "Iniciar Scanner" e por drag-and-drop */}
        <input 
          ref={fileInputRef}
          data-testid="visual-search-input"
          id="visual-search-input" 
          type="file" 
          className="hidden" 
          accept="image/*" 
          capture="environment"
          onChange={handleFileUpload} 
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 relative">
          {/* Sidebar Area */}
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-20 lg:h-[calc(100vh-120px)] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-primary/10 hover:scrollbar-thumb-primary/20">
            {/* Preview da foto enviada — só aparece após upload */}
            <AnimatePresence mode="wait">
              {previewUrl ? (
                <motion.div 
                  key="sidebar-preview"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="relative overflow-hidden border-2 border-dashed border-muted-foreground/20 bg-muted/5 transition-all duration-300">
                    <CardContent className="p-0">
                      <div className="relative overflow-hidden group">
                        <OptimizedImage data-testid="sidebar-preview-image" src={previewUrl} alt="Preview" className="aspect-square object-cover" containerClassName="w-full" />
                        
                        {/* Visual Highlights Overlay */}
                        {results?.analysis.visualHighlights && !isSearching && showHotspots && (
                          <div className="absolute inset-0 pointer-events-none" style={{ opacity: hotspotOpacity }}>
                            {results.analysis.visualHighlights.map((hl, idx) => (
                              <motion.div
                                key={`${hl.label}-${idx}`}
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.5 + idx * 0.1 }}
                                className="absolute group/hl pointer-events-auto"
                                style={{ left: `${hl.x}%`, top: `${hl.y}%` }}
                              >
                                <div className="relative flex items-center justify-center">
                                  <div className="absolute h-6 w-6 animate-ping rounded-full bg-primary/40" />
                                  <div className="relative h-3 w-3 rounded-full bg-primary border-2 border-white shadow-lg" />
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover/hl:opacity-100 transition-opacity whitespace-nowrap bg-background/95 border border-border px-2 py-1 rounded text-[10px] font-medium shadow-xl z-50">
                                    {hl.label}: {hl.description}
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        )}
                        
                        {/* Scanning Line Animation */}
                        {isSearching && (
                          <div className="absolute inset-0 z-10 overflow-hidden pointer-events-none">
                            <motion.div 
                              className="absolute left-0 top-0 h-[20%] w-full bg-gradient-to-b from-primary/0 via-primary/40 to-primary/0"
                              animate={{ top: ['-20%', '100%'] }}
                              transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                            />
                            <motion.div 
                              className="absolute left-0 top-0 h-1 w-full bg-primary shadow-[0_0_30px_rgba(var(--primary),1)]"
                              animate={{ top: ['0%', '100%'] }}
                              transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                            />
                            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] mix-blend-overlay" />
                          </div>
                        )}
                        
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                          <div className="flex flex-col gap-2">
                            <Button data-testid="reset-search-button" variant="secondary" size="sm" onClick={reset} className="gap-2">
                              <RefreshCcw className="h-4 w-4" /> Trocar Foto
                            </Button>
                            <div className="flex flex-col gap-2 bg-background/90 p-2 rounded-lg border border-border shadow-sm">
                              <div className="flex items-center justify-between gap-4">
                                <Label className="text-[10px] font-bold uppercase text-muted-foreground whitespace-nowrap">Exibir Pontos</Label>
                                <Button 
                                  variant={showHotspots ? "default" : "outline"} 
                                  size="icon" 
                                  className="h-6 w-10" 
                                  onClick={() => setShowHotspots(!showHotspots)}
                                >
                                  {showHotspots ? "ON" : "OFF"}
                                </Button>
                              </div>
                              {showHotspots && (
                                <div className="space-y-1">
                                  <div className="flex justify-between text-[9px] font-bold uppercase text-muted-foreground">
                                    <span>Intensidade</span>
                                    <span>{Math.round(hotspotOpacity * 100)}%</span>
                                  </div>
                                  <input 
                                    type="range" 
                                    min="0" 
                                    max="1" 
                                    step="0.1" 
                                    value={hotspotOpacity} 
                                    onChange={(e) => setHotspotOpacity(parseFloat(e.target.value))}
                                    className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ) : (
                <motion.div
                  key="sidebar-upload"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card 
                    className={cn(
                      "relative overflow-hidden border-2 border-dashed transition-all duration-300 group cursor-pointer",
                      isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/20 bg-muted/5 hover:border-primary/40"
                    )}
                    onDragEnter={() => setIsDragging(true)}
                    onDragLeave={() => setIsDragging(false)}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleFile(file);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <CardContent className="flex flex-col items-center justify-center p-6 text-center">
                      <div className="relative mb-3">
                        <div className="absolute inset-0 scale-150 animate-pulse bg-primary/5 blur-xl rounded-full" />
                        <div className="relative rounded-full bg-background p-4 shadow-sm border border-border/50 group-hover:border-primary/50 transition-colors">
                          <Camera className="h-6 w-6 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                        </div>
                      </div>
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground group-hover:text-primary transition-colors">Anexar Imagem</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">Clique ou arraste para buscar</p>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>


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
                      <button type="button" onClick={() => setSelectedCategoryIds([])} className="text-[10px] text-primary hover:underline">Limpar</button>
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
                      <button type="button" onClick={() => setColorSelection({ groups: [], variations: [], nuances: [] })} className="text-[10px] text-primary hover:underline">Limpar</button>
                    )}
                  </div>
                  <ColorSwatchBar selection={colorSelection} onChange={setColorSelection} />
                </div>

                {previewUrl && !isSearching && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 gap-2"
                      onClick={() => processImage(previewUrl)}
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Reanalisar
                    </Button>
                    {!results && (
                      <Button
                        className="flex-1 gap-2 shadow-lg shadow-primary/20 transition-all active:scale-95"
                        onClick={() => processImage(previewUrl)}
                      >
                        <Target className="h-4 w-4" />
                        Iniciar Raio X
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Analysis Details */}
            {results && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
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
                    <div className="space-y-2 border-b border-primary/10 pb-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Entendendo o Score</Label>
                        <Info className="h-3 w-3 text-primary/40" />
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        O score de confiança combina a análise visual da IA (80%) com a precisão dos filtros manuais (20%). 
                        Ajustar categoria ou cor recalibra a ordenação priorizando o catálogo disponível.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Produto</p>
                        <p className="text-xs font-semibold leading-tight group cursor-pointer hover:text-primary transition-colors" onClick={() => previewUrl && processImage(previewUrl, results.analysis.productType)}>
                          {results.analysis.productType}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Material</p>
                        <p className="text-xs font-semibold leading-tight group cursor-pointer hover:text-primary transition-colors" onClick={() => previewUrl && processImage(previewUrl, results.analysis.material)}>
                          {results.analysis.material}
                        </p>
                      </div>
                    </div>
                    
                    {results.analysis.visualEvidence && (
                      <div className="grid grid-cols-3 gap-2 py-2">
                        <div className="space-y-1">
                          <p className="text-[9px] font-bold uppercase text-muted-foreground/70">Material</p>
                          <p className="text-[10px] leading-tight text-foreground/80">{results.analysis.visualEvidence.material}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[9px] font-bold uppercase text-muted-foreground/70">Silhueta</p>
                          <p className="text-[10px] leading-tight text-foreground/80">{results.analysis.visualEvidence.silhouette}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[9px] font-bold uppercase text-muted-foreground/70">Acabamento</p>
                          <p className="text-[10px] leading-tight text-foreground/80">{results.analysis.visualEvidence.finish}</p>
                        </div>
                      </div>
                    )}

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
                        <motion.div
                          key={`${kw}-${i}`}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.2 + i * 0.05 }}
                        >
                          <Badge 
                            variant="secondary" 
                            className="h-5 cursor-pointer border-transparent bg-background/80 px-2 text-[9px] font-medium uppercase text-primary hover:bg-primary hover:text-white transition-all"
                            onClick={() => previewUrl && processImage(previewUrl, kw)}
                          >
                            {kw}
                          </Badge>
                        </motion.div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-primary/10">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">A IA acertou?</p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="h-7 px-2 text-[10px] gap-1 hover:bg-emerald-50 hover:text-emerald-600 border-emerald-100" onClick={() => handleFeedback(true)}>
                          <CheckCircle2 className="h-3 w-3" /> Sim
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 px-2 text-[10px] gap-1 hover:bg-rose-50 hover:text-rose-600 border-rose-100" onClick={() => handleFeedback(false)}>
                          <AlertCircle className="h-3 w-3" /> Não
                        </Button>
                      </div>
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
                      <OptimizedImage src={item.imageUrl} alt={item.productType} className="object-cover transition-transform group-hover:scale-110" containerClassName="h-full w-full" />
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
            {!previewUrl && !isSearching && !analysisError && (
              <div 
                onDragEnter={() => setIsDragging(true)}
                onDragLeave={() => setIsDragging(false)}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleFile(file);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "relative flex h-full min-h-[500px] flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 text-center group cursor-pointer transition-all duration-300",
                  isDragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-border bg-muted/5 hover:border-primary/40"
                )}
              >
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
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                    className="gap-2 px-10 h-12 text-base shadow-xl shadow-primary/20"
                  >
                    <Camera className="h-5 w-5" /> Iniciar Scanner
                  </Button>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest block w-full">ou arraste um arquivo aqui</p>
                </div>

                {isDragging && (
                  <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary/20 backdrop-blur-[2px] rounded-2xl pointer-events-none">
                    <div className="flex flex-col items-center gap-2 rounded-2xl bg-background/90 p-8 shadow-2xl border border-primary/50">
                      <ImageIcon className="h-12 w-12 text-primary animate-bounce" />
                      <p className="font-bold text-primary">Solte para analisar!</p>
                    </div>
                  </div>
                )}
              </div>
            )}


            {analysisError && !isSearching && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex h-full min-h-[500px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-rose-500/30 bg-rose-500/5 p-12 text-center"
              >
                <div className="relative mb-6">
                  <div className="absolute inset-0 scale-150 bg-rose-500/10 blur-2xl rounded-full" />
                  <div className="relative rounded-full bg-rose-500/10 p-10 shadow-xl border border-rose-500/20">
                    <AlertCircle className="h-20 w-20 text-rose-500" />
                  </div>
                </div>
                <h3 className="mb-2 font-display text-2xl font-bold tracking-tight text-rose-600">{analysisError.message}</h3>
                <p className="mx-auto max-w-sm text-sm text-muted-foreground leading-relaxed font-medium">
                  {analysisError.tip}
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row items-center">
                  <Button 
                    onClick={() => previewUrl && processImage(previewUrl)}
                    className="gap-2 px-8 bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-200"
                  >
                    <RefreshCcw className="h-4 w-4" /> Tentar Novamente
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={reset}
                    className="gap-2 px-8"
                  >
                    <X className="h-4 w-4" /> Cancelar
                  </Button>
                </div>
              </motion.div>
            )}

            {isSearching && (
              <div className="space-y-6">
                {results && (
                  <div className="flex items-center gap-2 rounded-lg bg-primary/10 p-3 border border-primary/20 animate-pulse mb-4">
                    <Loader2 className="h-4 w-4 text-primary animate-spin" />
                    <span className="text-xs font-bold text-primary uppercase tracking-wider">Recalculando matches com novos filtros...</span>
                  </div>
                )}
                <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-background via-background to-muted/30 p-10 min-h-[360px] flex items-center justify-center">
                  {/* Soft ambient glow */}
                  <motion.div
                    aria-hidden
                    className="absolute -top-24 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
                    animate={{ opacity: [0.4, 0.7, 0.4] }}
                    transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                  />

                  <div className="relative z-10 flex flex-col items-center gap-7 text-center max-w-md w-full">
                    {/* Refined spinner with concentric rings */}
                    <div className="relative h-20 w-20">
                      <motion.div
                        className="absolute inset-0 rounded-full border border-primary/20"
                        animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0, 0.6] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                      />
                      <motion.div
                        className="absolute inset-2 rounded-full border border-primary/30"
                        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay: 0.4 }}
                      />
                      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-[spin_1.2s_linear_infinite]" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Eye className="h-7 w-7 text-primary" strokeWidth={1.5} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h3 className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
                        Analisando sua imagem
                      </h3>
                      <p className="text-sm text-muted-foreground max-w-sm">
                        Identificando formato, cores e materiais para encontrar os melhores produtos.
                      </p>
                    </div>

                    <div className="w-full space-y-2">
                      <Progress value={65} className="h-1.5 w-full" />
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Processando…</span>
                        <span className="tabular-nums font-medium text-foreground/70">65%</span>
                      </div>
                    </div>

                    {/* Subtle step indicators */}
                    <div className="flex items-center gap-2 flex-wrap justify-center">
                      {['Silhueta', 'Cores', 'Material', 'Categoria'].map((step, i) => (
                        <motion.span
                          key={step}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.15 }}
                          className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-1 text-[10px] font-medium text-muted-foreground border border-border/40"
                        >
                          <motion.span
                            className="h-1.5 w-1.5 rounded-full bg-primary"
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
                          />
                          {step}
                        </motion.span>
                      ))}
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

            {results && !analysisError && (
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
                  <div data-testid="search-results-list" className="columns-1 sm:columns-2 xl:columns-3 gap-5 space-y-5">
                    {results.products.map((product, idx) => (
                      <motion.div
                        key={product.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.04, duration: 0.4 }}
                      >
                        <Card 
                          className={cn(
                            "group break-inside-avoid cursor-pointer overflow-hidden border-border/40 transition-all duration-500 hover:border-primary/40 active:scale-[0.98] relative",
                            idx === 0 ? "shadow-[0_0_40px_rgba(var(--primary),0.15)] ring-2 ring-primary/20 scale-[1.02] mb-6" : "hover:shadow-2xl",
                            product.relevance >= 0.9 && idx !== 0 ? "hover:shadow-[0_0_30px_rgba(var(--primary),0.15)] ring-1 ring-transparent hover:ring-primary/20" : "",
                            hoveredProduct === product.id && "z-50"
                          )}
                          onMouseEnter={() => setHoveredProduct(product.id)}
                          onMouseLeave={() => setHoveredProduct(null)}
                          onClick={() => navigate(`/produto/${product.id}`)}
                        >
                          <div className="relative aspect-square overflow-hidden bg-white/50 p-6 flex items-center justify-center">
                            <OptimizedImage
                              src={product.images?.[0]}
                              alt={product.name}
                              className={cn(
                                "object-contain transition-transform duration-700 drop-shadow-md",
                                hoveredProduct === product.id ? "scale-[1.6] origin-center z-10" : "group-hover:scale-110"
                              )}
                              containerClassName="h-full w-full"
                            />
                            
                            {/* Material Magnifier Overlay (Hover) - Side-by-Side Comparison */}
                            <AnimatePresence>
                              {hoveredProduct === product.id && (
                                <motion.div 
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  className="absolute inset-0 pointer-events-none z-20 flex flex-col items-center justify-center gap-4 bg-black/40 backdrop-blur-[2px]"
                                >
                                  <div className="flex items-center gap-4 w-full px-4">
                                    {/* Original Texture Snippet */}
                                    <div className="flex-1 flex flex-col items-center gap-2">
                                      <div className="h-24 w-24 rounded-full border-2 border-white/50 overflow-hidden shadow-2xl bg-black">
                                        <OptimizedImage src={previewUrl || '/placeholder.svg'} alt="Original Texture" className="object-cover scale-[2.5]" containerClassName="h-full w-full" />
                                      </div>
                                      <span className="text-[8px] font-black text-white uppercase tracking-widest bg-black/40 px-2 py-0.5 rounded">Sua Foto</span>
                                    </div>

                                    <div className="h-10 w-[1px] bg-white/20" />

                                    {/* Catalog Texture Snippet */}
                                    <div className="flex-1 flex flex-col items-center gap-2">
                                      <div className="h-24 w-24 rounded-full border-2 border-primary/50 overflow-hidden shadow-2xl bg-white">
                                        <OptimizedImage src={getCdnUrl(product.images?.[0], 'card') || '/placeholder.svg'} alt="Catalog Texture" className="object-contain scale-[2.5]" containerClassName="h-full w-full" />
                                      </div>
                                      <span className="text-[8px] font-black text-primary uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded backdrop-blur-sm">Catálogo</span>
                                    </div>
                                  </div>

                                  <div className="bg-background/90 backdrop-blur-md border border-primary/20 px-4 py-1.5 rounded-full shadow-2xl flex items-center gap-2">
                                    <Eye className="h-3 w-3 text-primary animate-pulse" />
                                    <span className="text-[10px] font-black uppercase tracking-tighter">Lupa de Material Ativa</span>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                            
                            {/* Match Overlay */}
                            <div className="absolute top-4 right-4 flex flex-col items-end gap-1.5">
                              <div className={cn(
                                "flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black shadow-lg backdrop-blur-md transition-all group-hover:scale-110",
                                product.relevance >= 0.9 ? "bg-emerald-500 text-white" : "bg-white/95 text-foreground border border-border"
                              )}>
                                {product.relevance >= 0.9 && <CheckCircle2 className="h-3 w-3" />}
                                {Math.round(product.relevance * 100)}% Match
                              </div>
                              <Progress 
                                value={product.relevance * 100} 
                                className="h-1 w-16 bg-white/40 overflow-hidden" 
                              />
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
                            
                            {product.matchRationale && (
                              <div className="mb-3 rounded-lg bg-primary/5 p-2.5 text-[10px] leading-relaxed text-muted-foreground border-l-2 border-primary/20 shadow-sm">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-1.5 text-primary">
                                    <Info className="h-3 w-3" />
                                    <span className="font-bold uppercase tracking-tighter">Por que este match?</span>
                                  </div>
                                  <div className="flex gap-1">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleFeedback(true, product.id, product.relevance);
                                      }}
                                      className="p-1 hover:bg-emerald-500/10 rounded transition-colors text-emerald-500"
                                      title="Confirmar match"
                                    >
                                      <CheckCircle2 className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleFeedback(false, product.id, product.relevance);
                                      }}
                                      className="p-1 hover:bg-rose-500/10 rounded transition-colors text-rose-500"
                                      title="Corrigir match"
                                    >
                                      <AlertCircle className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                                <p className="italic text-foreground/80 leading-snug">{product.matchRationale}</p>
                              </div>
                            )}
                            
                            {results?.analysis.visualEvidence && (
                              <div className="mt-3 space-y-2 border-t border-primary/5 pt-2">
                                <div className="flex flex-col gap-1.5">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-[8px] h-4 bg-background px-1 border-primary/20 text-primary uppercase font-bold">Material</Badge>
                                    <span className="text-[9px] text-muted-foreground truncate italic">"{results.analysis.visualEvidence.material}"</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-[8px] h-4 bg-background px-1 border-primary/20 text-primary uppercase font-bold">Silhueta</Badge>
                                    <span className="text-[9px] text-muted-foreground truncate italic">"{results.analysis.visualEvidence.silhouette}"</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-[8px] h-4 bg-background px-1 border-primary/20 text-primary uppercase font-bold">Acabamento</Badge>
                                    <span className="text-[9px] text-muted-foreground truncate italic">"{results.analysis.visualEvidence.finish}"</span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {product.totalFound && product.totalFound > 10 && (
                              <div className="mt-2 flex items-center gap-1.5 text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                                <TrendingUp className="h-3 w-3" /> Tendência: Encontrado {product.totalFound} vezes esta semana
                              </div>
                            )}
                            
                            <div className="flex items-center justify-between border-t border-border/50 pt-4 mt-auto">
                              <div className="flex flex-col flex-1 gap-1">
                                <div className="flex items-center justify-between pr-4">
                                  <span className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest text-left">Preço Sugerido</span>
                                  <div className="flex items-center gap-1.5 bg-muted/30 px-2 py-0.5 rounded">
                                    <div className={cn("h-1.5 w-1.5 rounded-full animate-pulse", (product.stock || 0) > 0 ? "bg-emerald-500" : "bg-rose-500")} />
                                    <span className={cn("text-[9px] font-black uppercase tracking-tighter", (product.stock || 0) > 0 ? "text-emerald-500" : "text-rose-500")}>
                                      {product.stock && product.stock > 0 ? `${product.stock} em estoque` : 'Esgotado'}
                                    </span>
                                  </div>
                                </div>
                                <span className="text-xl font-black tracking-tighter text-foreground text-left">
                                  {formatCurrency(product.price)}
                                </span>
                                <div className="space-y-1 mt-1">
                                  <div className="flex justify-between text-[7px] font-black text-muted-foreground/40 uppercase">
                                    <span>Nível de Disponibilidade</span>
                                    <span>{Math.min(100, Math.round(((product.stock || 0) / 500) * 100))}%</span>
                                  </div>
                                  <Progress value={product.stock ? Math.min(100, (product.stock / 500) * 100) : 0} className="h-1 bg-muted/30" />
                                </div>
                              </div>
                              <div className="flex items-center gap-2 pl-4">
                                {idx === 0 && (
                                  <Button 
                                    size="sm" 
                                    className="h-8 gap-1.5 text-[10px] font-bold uppercase tracking-wider shadow-lg shadow-primary/20"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toast.info("Criando rascunho de orçamento...");
                                    }}
                                  >
                                    <Zap className="h-3 w-3" /> Orçamento
                                  </Button>
                                )}
                                <motion.div 
                                  whileHover={{ x: 3 }}
                                  className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/5 text-primary transition-all group-hover:bg-primary group-hover:text-primary-foreground shadow-sm"
                                >
                                  <ArrowRight className="h-5 w-5" />
                                </motion.div>
                              </div>
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