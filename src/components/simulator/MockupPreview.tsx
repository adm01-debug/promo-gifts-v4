// src/components/simulator/MockupPreview.tsx
// Melhoria #4: Preview de mockup na simulação

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Eye, Image as ImageIcon, Package, Palette, Move, ZoomIn } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import type { SimulationOption, Product } from '@/types/simulation';

interface MockupPreviewProps {
  option: SimulationOption;
  product: Product | undefined;
  clientLogoUrl?: string | null;
}

export function MockupPreview({ option, product, clientLogoUrl }: MockupPreviewProps) {
  const [open, setOpen] = useState(false);
  const [logoScale, setLogoScale] = useState([100]);
  const [logoPosition, setLogoPosition] = useState({ x: 50, y: 50 });

  // Dimensões em pixels baseadas na área real
  const logoDimensions = useMemo(() => {
    const baseScale = logoScale[0] / 100;
    const widthPx = option.width * 10 * baseScale; // ~10px por cm
    const heightPx = option.height * 10 * baseScale;
    return { width: widthPx, height: heightPx };
  }, [option.width, option.height, logoScale]);

  // Técnica visual mock
  const techniqueOverlay = useMemo(() => {
    const code = option.techniqueCode.toUpperCase();

    if (code.includes('BORD') || code.includes('EMBROID')) {
      return { filter: 'contrast(1.1)', mixBlendMode: 'multiply' as const };
    }
    if (code.includes('SILK') || code.includes('SERIGRAFIA')) {
      return { opacity: 0.95, filter: 'saturate(1.2)' };
    }
    if (code.includes('SUB') || code.includes('DTF')) {
      return { filter: 'brightness(1.05) saturate(1.1)' };
    }
    if (code.includes('LASER')) {
      return { filter: 'grayscale(0.5) contrast(1.2)' };
    }
    return {};
  }, [option.techniqueCode]);

  if (!product?.image_url) {
    return (
      <Button variant="ghost" size="sm" disabled className="gap-1.5 opacity-50">
        <ImageIcon className="h-4 w-4" />
        <span className="hidden sm:inline">Preview</span>
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <Eye className="h-4 w-4" />
          <span className="hidden sm:inline">Preview</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Preview do Mockup
          </DialogTitle>
          <DialogDescription>
            Visualização aproximada de como ficará a personalização
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Mockup Area */}
          <div className="relative aspect-square overflow-hidden rounded-xl border bg-muted/30">
            {/* Product Image */}
            <img
              src={product.image_url}
              alt={product.name}
              className="h-full w-full object-contain"
              loading="lazy"
            />

            {/* Logo Overlay */}
            {clientLogoUrl ? (
              <div
                className="pointer-events-none absolute transition-all duration-200"
                style={{
                  left: `${logoPosition.x}%`,
                  top: `${logoPosition.y}%`,
                  transform: 'translate(-50%, -50%)',
                  width: `${logoDimensions.width}px`,
                  height: `${logoDimensions.height}px`,
                  ...techniqueOverlay,
                }}
              >
                <img
                  src={clientLogoUrl}
                  alt="Logo"
                  className="h-full w-full object-contain"
                  loading="lazy"
                />
              </div>
            ) : (
              <div
                className="absolute flex items-center justify-center rounded-lg border-2 border-dashed border-primary/50 bg-primary/10"
                style={{
                  left: `${logoPosition.x}%`,
                  top: `${logoPosition.y}%`,
                  transform: 'translate(-50%, -50%)',
                  width: `${logoDimensions.width}px`,
                  height: `${logoDimensions.height}px`,
                }}
              >
                <div className="p-2 text-center">
                  <Palette className="mx-auto mb-1 h-5 w-5 text-primary" />
                  <p className="text-[10px] font-medium text-primary">
                    {option.width}×{option.height}cm
                  </p>
                </div>
              </div>
            )}

            {/* Technique Badge */}
            <Badge className="absolute left-2 top-2 text-xs" variant="secondary">
              {option.techniqueName}
            </Badge>
          </div>

          {/* Controls */}
          <div className="space-y-4">
            <Card>
              <CardContent className="space-y-4 p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Package className="h-4 w-4 text-primary" />
                  {product.name}
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-muted/50 p-2">
                    <p className="text-xs text-muted-foreground">Área</p>
                    <p className="font-semibold">
                      {option.width}×{option.height}cm
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2">
                    <p className="text-xs text-muted-foreground">Cores</p>
                    <p className="font-semibold">{option.colors} cor(es)</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2">
                    <p className="text-xs text-muted-foreground">Posições</p>
                    <p className="font-semibold">{option.positions}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2">
                    <p className="text-xs text-muted-foreground">Prazo</p>
                    <p className="font-semibold">~{option.estimatedDays} dias</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 p-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-sm font-medium">
                      <ZoomIn className="h-4 w-4" />
                      Escala do Logo
                    </label>
                    <span className="text-sm text-muted-foreground">{logoScale[0]}%</span>
                  </div>
                  <Slider
                    value={logoScale}
                    onValueChange={setLogoScale}
                    min={50}
                    max={150}
                    step={5}
                    className="w-full"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Move className="h-3 w-3" />
                      Posição X
                    </label>
                    <Slider
                      value={[logoPosition.x]}
                      onValueChange={([x]) => setLogoPosition((p) => ({ ...p, x }))}
                      min={10}
                      max={90}
                      step={5}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Move className="h-3 w-3" />
                      Posição Y
                    </label>
                    <Slider
                      value={[logoPosition.y]}
                      onValueChange={([y]) => setLogoPosition((p) => ({ ...p, y }))}
                      min={10}
                      max={90}
                      step={5}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <p className="text-center text-xs text-muted-foreground">
              * Preview ilustrativo. O resultado final pode variar.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
