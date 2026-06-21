import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Ruler, Target, Lock, Minus, Plus } from 'lucide-react';

interface LogoSizeControlsProps {
  logoPreview: string | null;
  logoWidth: number;
  logoHeight: number;
  logoScale: number;
  logoRotation: number;
  positionX: number;
  positionY: number;
  maxWidth?: number | null;
  maxHeight?: number | null;
  onSizeChange: (width: number, height: number) => void;
  onLogoScaleChange?: (scale: number) => void;
}

export function LogoSizeControls({
  logoPreview,
  logoWidth,
  logoHeight,
  logoScale,
  logoRotation,
  positionX,
  positionY,
  maxWidth,
  maxHeight,
  onSizeChange,
  onLogoScaleChange,
}: LogoSizeControlsProps) {
  const effectiveMaxW = maxWidth && maxWidth > 0 ? maxWidth : 20;
  const effectiveMaxH = maxHeight && maxHeight > 0 ? maxHeight : 20;

  return (
    <div className="flex gap-4 border-t pt-2">
      {/* Left: Engraving Area */}
      <div className="w-1/2 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ruler className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold">Área de Gravação</span>
          </div>
          {maxWidth && maxHeight && maxWidth > 0 && maxHeight > 0 && (
            <Badge variant="outline" className="text-[10px]">
              Máx {maxWidth}×{maxHeight}cm
            </Badge>
          )}
        </div>

        {/* Width */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Largura</span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                aria-label="Diminuir largura"
                className="h-7 w-7"
                disabled={logoWidth <= 1}
                onClick={() => onSizeChange(Math.max(1, logoWidth - 0.5), logoHeight)}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="min-w-[44px] rounded bg-muted/50 px-1.5 py-0.5 text-center text-xs font-bold">
                {logoWidth}cm
              </span>
              <Button
                variant="outline"
                size="icon"
                aria-label="Aumentar largura"
                className="h-7 w-7"
                disabled={logoWidth >= effectiveMaxW}
                onClick={() => onSizeChange(Math.min(effectiveMaxW, logoWidth + 0.5), logoHeight)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <Slider
            value={[logoWidth]}
            onValueChange={(v) => onSizeChange(v[0], logoHeight)}
            min={1}
            max={effectiveMaxW}
            step={0.5}
          />
        </div>

        {/* Height */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Altura</span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                aria-label="Diminuir altura"
                className="h-7 w-7"
                disabled={logoHeight <= 1}
                onClick={() => onSizeChange(logoWidth, Math.max(1, logoHeight - 0.5))}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="min-w-[44px] rounded bg-muted/50 px-1.5 py-0.5 text-center text-xs font-bold">
                {logoHeight}cm
              </span>
              <Button
                variant="outline"
                size="icon"
                aria-label="Aumentar altura"
                className="h-7 w-7"
                disabled={logoHeight >= effectiveMaxH}
                onClick={() => onSizeChange(logoWidth, Math.min(effectiveMaxH, logoHeight + 0.5))}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <Slider
            value={[logoHeight]}
            onValueChange={(v) => onSizeChange(logoWidth, v[0])}
            min={1}
            max={effectiveMaxH}
            step={0.5}
          />
        </div>

        {/* Max area button */}
        <div className="flex items-center justify-end">
          {maxWidth && maxHeight && maxWidth > 0 && maxHeight > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-1.5 text-[10px] text-primary hover:text-primary"
              onClick={() => onSizeChange(maxWidth, maxHeight)}
            >
              <Target className="mr-1 h-3 w-3" />
              Máxima
            </Button>
          )}
        </div>
      </div>

      {/* Right: Logo Scale */}
      <div className="w-1/2 space-y-3">
        <div className="flex items-center gap-2">
          <Ruler className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold">Tamanho da Logo</span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Escala</span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                aria-label="Diminuir escala"
                className="h-7 w-7"
                disabled={!logoPreview || logoScale <= 10}
                onClick={() => onLogoScaleChange?.(Math.max(10, logoScale - 5))}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="min-w-[44px] rounded bg-muted/50 px-1.5 py-0.5 text-center text-xs font-bold">
                {logoScale}%
              </span>
              <Button
                variant="outline"
                size="icon"
                aria-label="Aumentar escala"
                className="h-7 w-7"
                disabled={!logoPreview || logoScale >= 500}
                onClick={() => onLogoScaleChange?.(Math.min(500, logoScale + 5))}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <Slider
            value={[logoScale]}
            onValueChange={(v) => onLogoScaleChange?.(v[0])}
            min={10}
            max={500}
            step={5}
            disabled={!logoPreview}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3 w-3 text-primary" />
            <span>Proporção protegida</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-1.5 text-[10px] text-primary hover:text-primary"
            onClick={() => onLogoScaleChange?.(100)}
            disabled={!logoPreview || logoScale === 100}
          >
            <Target className="mr-1 h-3 w-3" />
            Resetar 100%
          </Button>
        </div>

        {/* Status */}
        <div className="border-t pt-2">
          <div className="flex flex-col gap-1 text-[10px] text-muted-foreground">
            <span>
              Pos: {positionX}% × {positionY}%
            </span>
            <span>
              Área: {logoWidth}×{logoHeight}cm
            </span>
            <span>
              Escala: {logoScale}%{logoRotation ? ` · Rot: ${logoRotation}°` : ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
