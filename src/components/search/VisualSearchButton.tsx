import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Upload, X, Loader2, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/ui";
import { supabase } from "@/integrations/supabase/client";

interface ProductAnalysis {
  productType: string;
  material: string;
  colors: string[];
  category: string;
  keywords: string[];
  description: string;
}

interface SearchResult {
  id: string;
  name: string;
  sku: string;
  category_name: string;
  description: string;
  price: number;
  colors: string[] | null | undefined;
  relevance: number;
}

interface VisualSearchProps {
  onResultsFound: (products: SearchResult[], analysis: ProductAnalysis) => void;
}

export function VisualSearchButton({ onResultsFound }: VisualSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const { toast } = useToast();

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione uma imagem.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "A imagem deve ter no máximo 10MB.",
        variant: "destructive",
      });
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      setPreviewImage(base64);
      await performVisualSearch(base64);
    };
    reader.readAsDataURL(file);
  }, []);

  const performVisualSearch = async (imageBase64: string) => {
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("visual-search", {
        body: { imageBase64 },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      const { products, analysis } = data;
      
      toast({
        title: "Busca concluída!",
        description: `Encontrados ${products.length} produtos similares.`,
      });

      onResultsFound(products, analysis);
      setIsOpen(false);
      
    } catch (error) {
      console.error("Visual search error:", error);
      toast({
        title: "Erro na busca",
        description: error instanceof Error ? error.message : "Não foi possível processar a imagem.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, [handleFileSelect]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const clearPreview = () => {
    setPreviewImage(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="icon"
          className="relative group border-orange/30 hover:border-orange hover:bg-orange/10"
         aria-label="Câmera"><Camera className="h-4 w-4 text-orange" />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange rounded-full animate-pulse" />
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-orange" />
            Busca Visual com IA
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Faça upload de uma imagem de produto para encontrar itens similares no catálogo usando inteligência artificial.
          </p>

          <AnimatePresence mode="wait">
            {previewImage ? (
              <motion.div
                key="preview"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative rounded-xl overflow-hidden border border-border"
              >
                <img src={previewImage} 
                  alt="Preview" 
                  className="w-full h-48 object-contain bg-muted"
                 loading="lazy"/>
                
                {isLoading ? (
                  <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-orange" />
                    <p className="text-sm font-medium">Analisando imagem com IA...</p>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 bg-background/80 hover:bg-background"
                    onClick={clearPreview}
                   aria-label="Fechar"><X className="h-4 w-4" />
                  </Button>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="upload"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <label
                  htmlFor="visual-search-input"
                  className={`
                    flex flex-col items-center justify-center w-full h-48 
                    border-2 border-dashed rounded-xl cursor-pointer 
                    transition-all duration-200
                    ${dragActive 
                      ? "border-orange bg-orange/10" 
                      : "border-border hover:border-orange/50 hover:bg-muted/50"
                    }
                  `}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <div className="flex flex-col items-center gap-3 p-4">
                    <div className="p-3 rounded-full bg-orange/10">
                      <Upload className="h-6 w-6 text-orange" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium">
                        Arraste uma imagem ou clique para selecionar
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        PNG, JPG ou WEBP (max. 10MB)
                      </p>
                    </div>
                  </div>
                  <input
                    id="visual-search-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleInputChange}
                    disabled={isLoading}
                  />
                </label>
              </motion.div>
            )}
          </AnimatePresence>

          {!isLoading && previewImage && (
            <Button 
              onClick={() => performVisualSearch(previewImage)}
              className="w-full bg-orange hover:bg-orange-hover"
            >
              <Search className="h-4 w-4 mr-2" />
              Buscar Produtos Similares
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
