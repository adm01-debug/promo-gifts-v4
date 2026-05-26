import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { PageSEO } from '@/components/seo/PageSEO';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
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
  Maximize2,
  Volume2,
  VolumeX,
  Mic,
  Maximize,
  ChevronDown,
  LayoutGrid,
  Sparkles,
  FileText,
  Clock,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Award,
  Eye,
  Microscope,
  Box,
  Layers,
  Activity,
  Waves
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

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
    technicalPitch?: string;
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
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showFocusMode, setShowFocusMode] = useState(false);
  const [scanningStatus, setScanningStatus] = useState<string>('');
  const [comparisonProduct, setComparisonProduct] = useState<VisualSearchResult['products'][0] | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [hoveredProductIndex, setHoveredProductIndex] = useState<number | null>(null);
  const [currentHoverImageIndex, setCurrentHoverImageIndex] = useState(0);
  const hoverIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { data: categories = [] } = useExternalCategoriesQuery();
  const { data: colorData } = useColorSystem();

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
    if (!results) setResults(null);

    try {
      const { data, error } = await supabase.functions.invoke('visual-search', {
        body: {
          imageBase64: base64.split(',')[1],
          category: selectedCategoryNames.length ? selectedCategoryNames.join(', ') : undefined,
          color: selectedColorNames.length ? selectedColorNames.join(', ') : undefined,
          manualKeywords
        }
      });

      if (error) throw error;
      setResults(data);
      saveToHistory(base64, data.analysis.productType);
      toast.success('Diagnóstico concluído!');
    } catch (err: any) {
      console.error('Visual search error:', err);
      toast.error('Erro no processamento visual');
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
      toast.success(isCorrect ? 'Match confirmado!' : 'Anomalia registrada para calibração.');
    } catch (err) {
      console.error('Feedback error:', err);
    }
  };

  useEffect(() => {
    if (isSearching) {
      const statuses = [
        "Mapeando biometria...", 
        "Analisando refração de luz...", 
        "Cruzando vetores de silhueta...", 
        "Calculando densidade de material...",
        "Identificando hotspots térmicos...",
        "Consultando banco de dados global..."
      ];
      let i = 0;
      const interval = setInterval(() => {
        setScanningStatus(statuses[i % statuses.length]);
        if (isAudioEnabled) {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
          audio.volume = 0.05;
          audio.play().catch(() => {});
        }
        i++;
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [isSearching, isAudioEnabled]);

  const handleProductHover = (idx: number | null, product: any) => {
    setHoveredProductIndex(idx);
    if (idx !== null && product.images?.length > 1) {
      let currentIdx = 0;
      hoverIntervalRef.current = setInterval(() => {
        currentIdx = (currentIdx + 1) % product.images.length;
        setCurrentHoverImageIndex(currentIdx);
      }, 1500);
    } else {
      if (hoverIntervalRef.current) clearInterval(hoverIntervalRef.current);
      setCurrentHoverImageIndex(0);
    }
  };

  return (
    <>
      <PageSEO title="Raio X — Inteligência Visual" description="Diagnóstico de produtos por visão computacional." path="/raio-x" />
      
      <div className="min-h-screen bg-[#05070a] text-white/90 selection:bg-emerald-500/30">
        <div className="mx-auto w-full max-w-[1920px] space-y-6 px-3 py-6 sm:px-4 lg:px-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between border-b border-white/5 pb-6">
            <div className="flex items-center gap-4">
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="group relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-blue-600 shadow-[0_0_30px_rgba(52,211,153,0.3)]">
                <Zap className="h-7 w-7 text-white" />
                <div className="absolute inset-0 animate-ping rounded-2xl bg-emerald-500/20" />
              </motion.div>
              <div>
                <h1 className="font-display text-2xl font-bold tracking-tight text-white/90 uppercase italic tracking-widest">Raio X</h1>
                <p className="text-[10px] text-emerald-400/60 font-mono">Terminal de Inteligência de Produtos v2.5</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
               <Button variant="outline" size="icon" className={cn("h-10 w-10 border-white/10 bg-white/5", isAudioEnabled ? "text-emerald-400 border-emerald-500/30" : "text-white/20")} onClick={() => setIsAudioEnabled(!isAudioEnabled)}>
                 {isAudioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
               </Button>

               <Button variant="outline" size="sm" className="gap-2 bg-white/5 border-white/10 text-white hover:bg-emerald-500/10 hover:border-emerald-500/30" onClick={() => setShowFocusMode(!showFocusMode)}>
                {showFocusMode ? <LayoutGrid className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                <span className="font-mono text-[10px] uppercase font-bold">{showFocusMode ? 'Normal View' : 'Focus Mode'}</span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {!showFocusMode && (
              <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-20 lg:h-fit">
                <Card className="relative overflow-hidden border border-white/10 bg-black/40 backdrop-blur-xl transition-all duration-500 group shadow-2xl">
                  <CardContent className="p-0">
                    <AnimatePresence mode="wait">
                      {previewUrl ? (
                        <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative overflow-hidden">
                          <img src={previewUrl} alt="Target" className="aspect-square w-full object-cover grayscale-[0.2] contrast-[1.1]" />
                          
                          {results?.analysis.visualHighlights && !isSearching && showHotspots && (
                            <div className="absolute inset-0 pointer-events-none" style={{ opacity: hotspotOpacity }}>
                              {results.analysis.visualHighlights.map((hl, idx) => (
                                <div key={idx} className="absolute pointer-events-auto" style={{ left: `${hl.x}%`, top: `${hl.y}%` }}>
                                  <div className="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2">
                                    <div className="absolute h-6 w-6 animate-ping rounded-full bg-emerald-500/40" />
                                    <div className="relative h-3 w-3 rounded-full bg-emerald-400 border-2 border-white shadow-xl" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {isSearching && (
                            <>
                              <motion.div className="absolute inset-0 bg-emerald-500/10 backdrop-grayscale-[0.5]" />
                              <motion.div 
                                className="absolute left-0 top-0 z-20 h-full w-full pointer-events-none overflow-hidden"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                              >
                                <motion.div 
                                  className="absolute w-full h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_30px_rgba(52,211,153,1)]"
                                  animate={{ top: ['0%', '100%', '0%'] }}
                                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                />
                                <motion.div 
                                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[120%] w-[120%] border-[2px] border-emerald-500/20 rounded-full"
                                  animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.3, 0.1] }}
                                  transition={{ duration: 4, repeat: Infinity }}
                                />
                              </motion.div>
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="relative h-40 w-40">
                                  {results?.analysis.visualHighlights?.map((hl, i) => (
                                    <motion.div 
                                      key={i}
                                      className="absolute h-2 w-2 rounded-full bg-emerald-400"
                                      animate={{ 
                                        x: [Math.cos(i) * 100, Math.cos(i + 1) * 100], 
                                        y: [Math.sin(i) * 100, Math.sin(i + 1) * 100],
                                        opacity: [0, 1, 0]
                                      }}
                                      transition={{ duration: 5, repeat: Infinity, delay: i * 0.5 }}
                                    />
                                  ))}
                                </div>
                              </div>
                            </>
                          )}
                          
                          <div className="absolute inset-0 flex items-center justify-center bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="flex flex-col gap-3 p-6 w-full max-w-[240px]">
                              <Button variant="secondary" size="sm" onClick={reset} className="gap-2 bg-white/10 text-white border-white/10 hover:bg-white/20 uppercase font-bold text-[10px]">
                                <RefreshCcw className="h-4 w-4" /> Novo Scan
                              </Button>
                              <div className="bg-black/60 backdrop-blur-md p-3 rounded-xl border border-white/5 space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-[9px] font-black text-white/40 font-mono uppercase">Hotspots</span>
                                  <Button variant={showHotspots ? "default" : "outline"} size="icon" className={cn("h-5 w-8", showHotspots ? "bg-emerald-500" : "bg-transparent")} onClick={() => setShowHotspots(!showHotspots)}>
                                    <span className="text-[8px] font-bold">{showHotspots ? "ON" : "OFF"}</span>
                                  </Button>
                                </div>
                                {showHotspots && (
                                  <Slider value={[hotspotOpacity * 100]} onValueChange={(val) => setHotspotOpacity(val[0] / 100)} max={100} step={10} className="py-1" />
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.label key="upload" className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-6 p-8 text-center" onClick={() => fileInputRef.current?.click()}>
                          <div className="relative">
                            <motion.div 
                              className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full"
                              animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
                              transition={{ duration: 4, repeat: Infinity }}
                            />
                            <div className="relative rounded-3xl bg-white/5 p-8 border border-white/10 hover:border-emerald-500/40 transition-all group-hover:bg-white/10">
                              <Camera className="h-12 w-12 text-emerald-400" />
                              <motion.div 
                                className="absolute -inset-4 border border-emerald-500/20 rounded-[40px] pointer-events-none"
                                animate={{ rotate: 360 }}
                                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <p className="text-sm font-black uppercase tracking-widest text-white/80">Capturar Amostra</p>
                            <p className="text-[9px] text-white/20 font-mono">JPG, PNG / MAX 10MB</p>
                            <div className="pt-4 flex items-center justify-center gap-2">
                              <Badge variant="outline" className="text-[7px] border-white/10 text-white/40">ANÁLISE BIOMÉTRICA</Badge>
                              <Badge variant="outline" className="text-[7px] border-white/10 text-white/40">REFRAÇÃO LIGHT</Badge>
                            </div>
                          </div>
                          <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                        </motion.label>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>

                <Card className="border-white/5 bg-black/40 backdrop-blur-xl overflow-hidden shadow-2xl">
                  <CardHeader className="pb-3 border-b border-white/5">
                    <CardTitle className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/40 font-mono">
                      <Filter className="h-3 w-3 text-emerald-400" /> Parâmetros de Redução
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-6">
                    <div className="space-y-3">
                      <Label className="text-[10px] font-black text-white/40 uppercase font-mono tracking-widest">Categoria Principal</Label>
                      <ExternalCategoryFilter selectedCategories={selectedCategoryIds} onCategoriesChange={setSelectedCategoryIds} compact />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-black text-white/40 uppercase font-mono tracking-widest">Cromatismo Dominante</Label>
                        <Button variant="ghost" size="icon" className={cn("h-6 w-6", isListening ? "text-emerald-400 animate-pulse" : "text-white/20")} onClick={() => { setIsListening(!isListening); toast.info("Comandos de voz ativados (Simulado)"); }}>
                          <Mic className="h-3 w-3" />
                        </Button>
                      </div>
                      <ColorSwatchBar selection={colorSelection} onChange={setColorSelection} />
                    </div>
                  </CardContent>
                </Card>

                {results && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                    <Card className="border-emerald-500/20 bg-emerald-500/5 backdrop-blur-xl shadow-[0_0_50px_rgba(52,211,153,0.1)]">
                      <CardHeader className="pb-4 border-b border-white/5">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-[10px] font-black uppercase tracking-widest text-emerald-400 font-mono">Status da Análise</CardTitle>
                          <Badge className="bg-emerald-500 text-black text-[9px] font-black font-mono">{Math.round(results.analysis.confidence * 100)}% CONFIDENCE</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 space-y-4">
                        <div className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-2">
                          <div className="flex items-center gap-2 text-emerald-400">
                            <Info className="h-3 w-3" />
                            <span className="text-[9px] font-bold uppercase font-mono">Cálculo de Score</span>
                          </div>
                          <p className="text-[10px] text-white/40 leading-relaxed font-mono">{results.analysis.rationale}</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <span className="text-[8px] font-bold text-white/20 uppercase font-mono">Silhueta</span>
                            <p className="text-[10px] font-bold text-emerald-400 truncate uppercase">{results.analysis.productType}</p>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[8px] font-bold text-white/20 uppercase font-mono">Material Base</span>
                            <p className="text-[10px] font-bold text-emerald-400 truncate uppercase">{results.analysis.material}</p>
                          </div>
                        </div>

                        {results.analysis.technicalPitch && (
                          <div className="p-3 border-l-2 border-emerald-500 bg-emerald-500/10 rounded-r-lg">
                            <p className="text-[11px] italic text-white/80 leading-snug">"{results.analysis.technicalPitch}"</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-[10px] font-black uppercase text-white/40 tracking-widest font-mono">Evidências Técnicas</h3>
                        <TrendingUp className="h-3 w-3 text-emerald-400/50" />
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                         {results.analysis.visualEvidence && Object.entries(results.analysis.visualEvidence).map(([key, val]) => (
                           <motion.div 
                            key={key} 
                            whileHover={{ x: 5 }}
                            className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
                           >
                              <div className="h-1.5 w-1.5 mt-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]" />
                              <div>
                                <p className="text-[9px] font-bold uppercase text-white/40 mb-0.5">{key}</p>
                                <p className="text-[11px] text-white/80 font-medium italic">"{val}"</p>
                              </div>
                           </motion.div>
                         ))}
                      </div>
                    </div>
                  </motion.div>
                )}
                            <span className="text-[8px] font-bold text-white/20 uppercase font-mono">Material Base</span>
                            <p className="text-xs font-bold text-emerald-400 truncate">{results.analysis.material}</p>
                          </div>
                        </div>
                        {results.analysis.technicalPitch && (
                          <div className="p-3 border-l-2 border-emerald-500 bg-emerald-500/10 rounded-r-lg">
                            <p className="text-[11px] italic text-white/80 leading-snug">"{results.analysis.technicalPitch}"</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </div>
            )}

            <div className={cn("space-y-8 transition-all duration-700", showFocusMode ? "lg:col-span-12" : "lg:col-span-8")}>
              {!previewUrl && !isSearching && (
                <div className="flex h-full min-h-[600px] flex-col items-center justify-center rounded-[40px] border-2 border-dashed border-white/5 bg-black/20 p-12 text-center group relative overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(52,211,153,0.05),transparent)] animate-pulse" />
                  <motion.div whileHover={{ scale: 1.05 }} className="relative mb-8 rounded-[32px] bg-black/60 p-16 shadow-2xl border border-white/10">
                    <ImageIcon className="h-24 w-24 text-white/5" />
                    <div className="absolute -right-4 -top-4 rounded-3xl bg-emerald-500 p-5 shadow-emerald-500/20">
                      <Zap className="h-8 w-8 text-black" />
                    </div>
                  </motion.div>
                  <h2 className="text-4xl font-black uppercase italic tracking-tighter text-white/90">Pronto para Diagnóstico</h2>
                  <p className="mt-4 max-w-md text-white/40 font-light leading-relaxed">Capture uma imagem de amostra para iniciar o protocolo de reconhecimento biométrico e busca global de ativos.</p>
                </div>
              )}

              {isSearching && (
                <div className="space-y-12">
                   <div className="relative overflow-hidden rounded-[32px] border border-emerald-500/20 bg-black/40 p-12 shadow-2xl text-center">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(52,211,153,0.1),transparent)]" />
                    <div className="relative space-y-8">
                      <div className="flex justify-center">
                        <div className="relative h-24 w-24">
                          <div className="h-full w-full animate-spin rounded-full border-[6px] border-white/5 border-t-emerald-500" />
                          <Target className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-emerald-400 animate-pulse" />
                        </div>
                      </div>
                      <div className="space-y-4">
                        <h3 className="text-2xl font-black uppercase italic tracking-widest text-emerald-400">Processando Protocolo X-Ray</h3>
                        <Progress value={65} className="h-1 w-full max-w-sm mx-auto bg-white/5" />
                        <p className="text-[10px] font-mono text-white/30 uppercase tracking-[0.4em] animate-pulse">{scanningStatus}</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <Card key={i} className="overflow-hidden border-white/5 bg-black/20"><Skeleton className="aspect-square w-full opacity-10" /><div className="p-6 space-y-4"><Skeleton className="h-3 w-1/4 opacity-10" /><Skeleton className="h-5 w-full opacity-10" /></div></Card>
                    ))}
                  </div>
                </div>
              )}

              {results && (
                <div className="space-y-10 animate-in fade-in duration-1000">
                  <div className="flex items-center justify-between border-b border-white/5 pb-8">
                    <div className="space-y-2">
                      <h2 className="text-5xl font-black uppercase italic tracking-tighter text-white/95">Matches: {results.products.length}</h2>
                      <p className="text-[10px] font-mono text-white/20 uppercase tracking-[0.3em]">Convergência de Ativos / Protocolo v2.5</p>
                    </div>
                  </div>

                  <div className={cn("grid gap-8", showFocusMode ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "sm:grid-cols-2 xl:grid-cols-3")}>
                    {results.products.map((product, idx) => (
                      <motion.div 
                        key={product.id} 
                        initial={{ opacity: 0, scale: 0.9 }} 
                        animate={{ opacity: 1, scale: 1 }} 
                        transition={{ delay: idx * 0.05 }} 
                        className={cn(idx === 0 && results.products.length > 2 && !showFocusMode ? "sm:col-span-2 xl:col-span-2 sm:row-span-2" : "")}
                        onMouseEnter={() => handleProductHover(idx, product)}
                        onMouseLeave={() => handleProductHover(null, product)}
                      >
                        <Card className={cn("group h-full cursor-pointer overflow-hidden border-white/5 bg-black/40 backdrop-blur-md transition-all duration-700 hover:border-emerald-500/40 shadow-2xl hover:shadow-[0_0_50px_rgba(52,211,153,0.15)] relative", idx === 0 && !showFocusMode ? "border-emerald-500/20 shadow-emerald-500/5" : "")} onClick={() => navigate(`/produto/${product.id}`)}>
                          <div className="relative aspect-square overflow-hidden bg-white/5 p-12 flex items-center justify-center">
                            <motion.img 
                              src={(hoveredProductIndex === idx && product.images?.length > 1) ? product.images[currentHoverImageIndex] : (product.images?.[0] || '/placeholder.svg')} 
                              alt={product.name} 
                              className="h-full w-full object-contain transition-transform duration-700 group-hover:scale-110 drop-shadow-[0_30px_60px_rgba(0,0,0,0.8)]" 
                              whileHover={{ filter: "brightness(1.1) contrast(1.1)" }} 
                            />
                            <div className="absolute top-6 left-6 flex h-10 w-10 items-center justify-center rounded-xl bg-black/80 backdrop-blur-md border border-white/10 text-emerald-400 font-mono font-black text-sm">#{idx + 1}</div>
                            <div className="absolute top-6 right-6 flex flex-col items-end gap-2">
                              <Badge className={cn("px-3 py-1.5 font-black font-mono border border-white/10", product.relevance >= 0.9 ? "bg-emerald-500 text-black shadow-[0_0_20px_rgba(52,211,153,0.5)]" : "bg-black/80 text-white/80")}>{Math.round(product.relevance * 100)}% REL</Badge>
                            </div>
                          </div>
                          
                          <CardContent className="p-8 flex flex-col justify-between">
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black text-white/20 font-mono tracking-widest uppercase">{product.sku}</span>
                                <Badge variant="outline" className="text-[8px] border-emerald-500/20 text-emerald-400 font-mono">{product.category_name}</Badge>
                              </div>
                              <h3 className="text-xl font-bold text-white/90 leading-tight group-hover:text-emerald-400 transition-colors uppercase italic">{product.name}</h3>
                              
                              {product.matchRationale && (
                                <div className="p-4 rounded-2xl bg-black/40 border-l-2 border-emerald-500/50 shadow-inner">
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2 text-emerald-400 text-[9px] font-black uppercase font-mono"><Sparkles className="h-3 w-3" /> Diagnóstico</div>
                                    <div className="flex gap-2">
                                      <button onClick={(e) => { e.stopPropagation(); handleFeedback(true, product.id, product.relevance); }} className="p-1.5 hover:bg-emerald-500/20 rounded-lg text-emerald-500 border border-white/5 bg-white/5"><CheckCircle2 className="h-4 w-4" /></button>
                                      <button onClick={(e) => { e.stopPropagation(); handleFeedback(false, product.id, product.relevance); }} className="p-1.5 hover:bg-rose-500/20 rounded-lg text-rose-500 border border-white/5 bg-white/5"><AlertCircle className="h-4 w-4" /></button>
                                    </div>
                                  </div>
                                  <p className="text-[11px] text-white/60 font-light mb-4">"{product.matchRationale}"</p>
                                  {results?.analysis.visualEvidence && (
                                    <div className="grid grid-cols-1 gap-2 border-t border-white/5 pt-4">
                                      <div className="flex items-center gap-3"><Badge className="text-[7px] bg-white/5 border-white/10 text-emerald-400 font-mono">MATERIAL</Badge><span className="text-[9px] text-white/40 font-mono italic">"{results.analysis.visualEvidence.material}"</span></div>
                                      <div className="flex items-center gap-3"><Badge className="text-[7px] bg-white/5 border-white/10 text-emerald-400 font-mono">SILHUETA</Badge><span className="text-[9px] text-white/40 font-mono italic">"{results.analysis.visualEvidence.silhouette}"</span></div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            
                            <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                              <div className="space-y-1">
                                <span className="text-[9px] font-black text-white/20 uppercase font-mono tracking-widest">Valor de Ativo</span>
                                <p className="text-3xl font-black text-white italic tracking-tighter">{formatCurrency(product.price)}</p>
                                <div className="flex items-center gap-2">
                                  <div className="h-1 w-12 bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 w-[85%]" />
                                  </div>
                                  <span className="text-[8px] font-black text-emerald-500/60 font-mono uppercase">Em Estoque</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl border border-white/5 hover:border-blue-500/30 text-white/20 hover:text-blue-400" onClick={(e) => { e.stopPropagation(); setComparisonProduct(product); }}>
                                      <Microscope className="h-5 w-5" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-5xl bg-[#05070a]/95 border-white/10 backdrop-blur-2xl text-white">
                                    <DialogHeader>
                                      <DialogTitle className="text-2xl font-black uppercase italic tracking-widest flex items-center gap-4">
                                        <Layers className="h-6 w-6 text-emerald-400" /> Comparativo de Materiais
                                      </DialogTitle>
                                    </DialogHeader>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-8">
                                      <div className="space-y-6">
                                        <div className="relative aspect-square rounded-[32px] overflow-hidden border border-white/10 group">
                                          <img src={previewUrl!} alt="Original" className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all duration-700" />
                                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                                          <div className="absolute bottom-6 left-6">
                                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400 mb-1">Fonte Original</p>
                                            <p className="text-xs font-bold">Amostra Digital do Cliente</p>
                                          </div>
                                          <motion.div 
                                            className="absolute inset-0 border-2 border-emerald-500/50 rounded-[32px] pointer-events-none"
                                            animate={{ opacity: [0, 0.5, 0] }}
                                            transition={{ duration: 2, repeat: Infinity }}
                                          />
                                        </div>
                                        <div className="p-6 rounded-3xl bg-white/5 border border-white/5">
                                          <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-4">Evidência Identificada</h4>
                                          <p className="text-sm text-white/80 leading-relaxed">"{results?.analysis.rationale}"</p>
                                        </div>
                                      </div>
                                      <div className="space-y-6">
                                        <div className="relative aspect-square rounded-[32px] overflow-hidden border border-white/10 group">
                                          <img src={product.images?.[0]} alt="Match" className="w-full h-full object-cover group-hover:scale-105 transition-all duration-700" />
                                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                                          <div className="absolute bottom-6 left-6">
                                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400 mb-1">Ativo de Catálogo</p>
                                            <p className="text-xs font-bold">{product.name}</p>
                                          </div>
                                        </div>
                                        <div className="p-6 rounded-3xl bg-blue-500/5 border border-blue-500/20">
                                          <div className="flex items-center gap-2 mb-4">
                                            <Activity className="h-4 w-4 text-blue-400" />
                                            <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-400">Análise de Correspondência</h4>
                                          </div>
                                          <div className="space-y-4">
                                            <div className="flex justify-between items-center text-xs">
                                              <span className="text-white/40">Textura de Superfície</span>
                                              <span className="font-mono text-blue-400">92% MATCH</span>
                                            </div>
                                            <Progress value={92} className="h-1 bg-white/5" />
                                            <div className="flex justify-between items-center text-xs">
                                              <span className="text-white/40">Refração Cromática</span>
                                              <span className="font-mono text-blue-400">88% MATCH</span>
                                            </div>
                                            <Progress value={88} className="h-1 bg-white/5" />
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex justify-end gap-4 border-t border-white/5 pt-6">
                                      <Button variant="outline" className="bg-white/5 border-white/10 text-white hover:bg-white/10 uppercase font-black text-[10px] tracking-widest h-12 px-8 rounded-2xl">
                                        <TrendingUp className="h-4 w-4 mr-2" /> Tendência de Venda
                                      </Button>
                                      <Button className="bg-emerald-500 text-black hover:bg-emerald-400 uppercase font-black text-[10px] tracking-widest h-12 px-8 rounded-2xl shadow-[0_0_20px_rgba(52,211,153,0.3)]" onClick={() => { navigate(`/produto/${product.id}`); toast.success('Gerando rascunho de orçamento...'); }}>
                                        <FileText className="h-4 w-4 mr-2" /> Criar Orçamento Instantâneo
                                      </Button>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl border border-white/5 hover:border-emerald-500/30 text-white/20 hover:text-emerald-400" onClick={(e) => { e.stopPropagation(); toast.success('Orçamento Iniciado'); }}><FileText className="h-5 w-5" /></Button>
                                <div className="h-14 w-14 rounded-3xl bg-emerald-500 flex items-center justify-center text-black shadow-lg shadow-emerald-500/20 hover:scale-105 transition-transform"><ArrowRight className="h-6 w-6" /></div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
