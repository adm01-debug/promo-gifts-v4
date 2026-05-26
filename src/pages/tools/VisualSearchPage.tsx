import { useState, useCallback } from 'react';
import { PageSEO } from '@/components/seo/PageSEO';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, Search, Camera, Image as ImageIcon, Zap, ArrowRight, Loader2, RefreshCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';

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
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [results, setResults] = useState<VisualSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);

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
        body: { imageBase64: base64.split(',')[1] }
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
