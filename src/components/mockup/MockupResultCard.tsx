import { useState, useEffect, memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Download,
  ImageIcon,
  Sparkles,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  CheckCircle2,
  Maximize2,
  X,
  ArrowLeftRight,
} from "lucide-react";
import confetti from "canvas-confetti";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { MockupBeforeAfter } from "./MockupBeforeAfter";
import { MockupAnnotations, type Annotation } from "./MockupAnnotations";
import { ShareMenu } from "./ShareMenu";

interface MockupResultCardProps {
  generatedMockup: string | null;
  isLoading: boolean;
  onDownload: () => void;
  productName?: string;
  techniqueName?: string;
  onReset?: () => void;
  className?: string;
  /** The product image with logo overlay for before/after comparison */
  beforeImage?: string | null;
  /** Callback to persist annotations */
  onAnnotationsChange?: (annotations: Annotation[]) => void;
  annotations?: Annotation[];
}

export const MockupResultCard = memo(function MockupResultCard({
  generatedMockup,
  isLoading,
  onDownload,
  productName,
  techniqueName,
  onReset,
  className,
  beforeImage,
  onAnnotationsChange,
  annotations = [],
}: MockupResultCardProps) {
  const [zoom, setZoom] = useState(1);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showBeforeAfter, setShowBeforeAfter] = useState(false);

  // Trigger success animation when mockup is generated
  useEffect(() => {
    if (generatedMockup && !isLoading) {
      setShowSuccess(true);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#7c3aed", "#a855f7", "#f97316", "#22c55e"],
      });
      const timer = setTimeout(() => setShowSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [generatedMockup, isLoading]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenZoom, setFullscreenZoom] = useState(1);
  const [isClientMode, setIsClientMode] = useState(false);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleZoomReset = () => setZoom(1);

  // Loading State
  if (isLoading) {
    return (
      <Card className={cn("overflow-hidden border-border/30", className)}>
        <CardContent className="py-12">
          <div className="text-center space-y-6">
            <div className="relative mx-auto w-24 h-24">
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
              <div className="absolute inset-2 rounded-full bg-primary/30 animate-ping animation-delay-150" />
              <div className="relative flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 backdrop-blur-sm">
                <Sparkles className="h-12 w-12 text-primary animate-pulse" />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-lg font-semibold text-foreground">Criando seu mockup com IA...</p>
              <p className="text-sm text-muted-foreground">Isso leva apenas alguns segundos</p>
            </div>
            <div className="flex justify-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
            <div className="w-48 mx-auto h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary via-primary/80 to-primary rounded-full animate-shimmer" style={{ width: "100%", backgroundSize: "200% 100%" }} />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Success State with Mockup
  if (generatedMockup) {
    return (
      <Card
        data-testid="mockup-result-card"
        className={cn(
          "overflow-hidden transition-all duration-500 border-border/30",
          showSuccess && "ring-2 ring-success shadow-lg shadow-success/20",
          className
        )}
      >
        <CardHeader className="pb-3 bg-gradient-to-r from-success/10 via-primary/5 to-transparent">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <div className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300",
                showSuccess ? "bg-success/20 text-success" : "bg-primary/10 text-primary"
              )}>
                {showSuccess ? <CheckCircle2 className="h-4 w-4 animate-scale-in" /> : <ImageIcon className="h-4 w-4" />}
              </div>
              <div>
                <span className="text-foreground">{showSuccess ? "Mockup Criado!" : "Mockup Gerado"}</span>
                {productName && <p className="text-xs font-normal text-muted-foreground">{productName}</p>}
              </div>
            </CardTitle>
            <div className="flex items-center gap-2">
              <ShareMenu
                mockupUrl={generatedMockup}
                productName={productName}
                techniqueName={techniqueName}
              />
              <Button size="sm" onClick={onDownload} className="gap-1.5">
                <Download className="h-4 w-4" /> Baixar
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-3">
          {/* Before/After toggle */}
          {beforeImage && (
            <div className="flex items-center gap-2">
              <Button
                variant={showBeforeAfter ? "default" : "outline"}
                size="sm"
                onClick={() => setShowBeforeAfter(!showBeforeAfter)}
                className="gap-1.5"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
                {showBeforeAfter ? "Resultado" : "Antes / Depois"}
              </Button>
            </div>
          )}

          {/* Before/After or Result */}
          {showBeforeAfter && beforeImage ? (
            <MockupBeforeAfter beforeImage={beforeImage} afterImage={generatedMockup} />
          ) : (
            <div className={cn(
              "relative rounded-xl border-2 border-dashed border-primary/20 bg-muted/30 overflow-hidden",
              "ring-4 ring-primary/10 transition-all duration-300"
            )}>
              <div className="aspect-square flex items-center justify-center overflow-auto" style={{ cursor: zoom > 1 ? "grab" : "default" }}>
                <img
                  src={generatedMockup}
                  alt="Generated mockup"
                  className="max-w-full max-h-full object-contain transition-transform duration-200"
                  style={{ transform: `scale(${zoom})` }} loading="lazy" />
              </div>
              {/* Zoom Controls */}
              <div className="absolute bottom-3 right-3 flex items-center gap-1 p-1 bg-background/80 backdrop-blur-sm rounded-lg border shadow-sm">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleZoomOut} disabled={zoom <= 0.5} aria-label="Reduzir"><ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-xs font-medium w-12 text-center">{Math.round(zoom * 100)}%</span>
                <Button size="icon" aria-label="Ampliar" variant="ghost" className="h-7 w-7" onClick={handleZoomIn} disabled={zoom >= 3}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleZoomReset} aria-label="Rotacionar"><RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Annotations */}
          {onAnnotationsChange && (
            <MockupAnnotations
              imageUrl={generatedMockup}
              annotations={annotations}
              onAnnotationsChange={onAnnotationsChange}
            />
          )}

          {/* Metadata */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              {techniqueName && <Badge variant="secondary" className="font-normal">{techniqueName}</Badge>}
              <Button size="sm" variant="ghost" onClick={() => setIsFullscreen(true)} className="text-muted-foreground hover:text-foreground gap-1">
                <Maximize2 className="h-3.5 w-3.5" /> Tela cheia
              </Button>
            </div>
            {onReset && (
              <Button size="sm" variant="ghost" onClick={onReset} className="text-muted-foreground hover:text-foreground">
                Criar novo mockup
              </Button>
            )}
          </div>
        </CardContent>

        {/* Fullscreen Lightbox */}
        <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] w-auto h-auto p-0 border-0 bg-background/95 backdrop-blur-xl [&>button]:hidden">
            <div className="relative flex flex-col items-center justify-center w-full h-full min-h-[60vh]">
              {!isClientMode && (
                <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setIsClientMode(true)} className="gap-1.5 shadow-md">
                    <Maximize2 className="h-4 w-4" /> Modo Apresentação
                  </Button>
                  <Button size="sm" variant="secondary" onClick={onDownload} className="gap-1.5 shadow-md">
                    <Download className="h-4 w-4" /> Baixar
                  </Button>
                  <Button size="icon" aria-label="Fechar" variant="secondary" className="h-8 w-8 shadow-md" onClick={() => setIsFullscreen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              
              {isClientMode && (
                <Button 
                  size="sm" 
                  variant="secondary" 
                  onClick={() => setIsClientMode(false)} 
                  className="absolute top-3 right-3 z-20 gap-1.5 shadow-md bg-background/50 hover:bg-background/80"
                >
                  <X className="h-4 w-4" /> Sair do modo limpo
                </Button>
              )}

              {!isClientMode && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 p-1.5 bg-background/90 backdrop-blur-sm rounded-lg border shadow-lg">
                  <Button size="icon" aria-label="Reduzir" variant="ghost" className="h-8 w-8" onClick={() => setFullscreenZoom(z => Math.max(z - 0.25, 0.25))} disabled={fullscreenZoom <= 0.25}>
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-xs font-medium w-14 text-center">{Math.round(fullscreenZoom * 100)}%</span>
                  <Button size="icon" aria-label="Ampliar" variant="ghost" className="h-8 w-8" onClick={() => setFullscreenZoom(z => Math.min(z + 0.25, 5))}>
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button size="icon" aria-label="Desfazer" variant="ghost" className="h-8 w-8" onClick={() => setFullscreenZoom(1)}>
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
              <div className="overflow-auto w-full h-full flex items-center justify-center p-8" style={{ cursor: fullscreenZoom > 1 ? 'grab' : 'default' }}>
                
<img src={generatedMockup} alt="Mockup em tela cheia" className="max-w-full max-h-[85vh] object-contain transition-transform duration-200" style={{ transform: `scale(${fullscreenZoom})` }}  loading="lazy" />
              </div>
              {(productName || techniqueName) && (
                <div className="absolute top-3 left-3 z-10">
                  <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm shadow-md">
                    {productName}{techniqueName ? ` • ${techniqueName}` : ''}
                  </Badge>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </Card>
    );
  }

  return null;
});
