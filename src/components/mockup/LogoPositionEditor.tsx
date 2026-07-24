import { memo, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Move } from 'lucide-react';
import { useProductBounds } from '@/hooks/products';
import { logger } from '@/lib/logger';
import type { TechniqueColorConfig } from './techniqueColorUtils';
import { getTechniqueFilter } from './logo-editor/logoTechniqueFilters';
import { useElementSize } from './logo-editor/useElementSize';
import { useLogoProcessing } from './logo-editor/useLogoProcessing';
import { useLogoDrag } from './logo-editor/useLogoDrag';
import { LogoPreviewCanvas } from './logo-editor/LogoPreviewCanvas';
import { LogoQuickActions } from './logo-editor/LogoQuickActions';
import { LogoSizeControls } from './logo-editor/LogoSizeControls';

interface LogoPositionEditorProps {
  productImageUrl: string;
  logoPreview: string | null;
  positionX: number;
  positionY: number;
  logoWidth: number;
  logoHeight: number;
  logoRotation?: number;
  logoScale?: number;
  techniqueCode?: string | null;
  techniqueName?: string;
  maxWidth?: number | null;
  maxHeight?: number | null;
  productHeightCm?: number | null;
  productWidthCm?: number | null;
  techniqueColorConfig?: TechniqueColorConfig | null;
  onColorConfigClick?: () => void;
  onPositionChange: (x: number, y: number) => void;
  onRotationChange?: (rotation: number) => void;
  onSizeChange: (width: number, height: number) => void;
  onLogoScaleChange?: (scale: number) => void;
  headerActions?: React.ReactNode;
}

export const LogoPositionEditor = memo(
  ({
    productImageUrl,
    logoPreview,
    positionX,
    positionY,
    logoWidth,
    logoHeight,
    logoRotation = 0,
    logoScale = 100,
    techniqueCode,
    techniqueName,
    maxWidth,
    maxHeight,
    productHeightCm,
    productWidthCm,
    techniqueColorConfig,
    onColorConfigClick,
    onPositionChange,
    onRotationChange,
    onSizeChange,
    onLogoScaleChange,
    headerActions,
  }: LogoPositionEditorProps) => {
    const { ref: containerRef, size: containerSize } = useElementSize<HTMLDivElement>();
    const productBounds = useProductBounds(productImageUrl);
    const { processedLogoUrl } = useLogoProcessing(logoPreview, techniqueColorConfig);
    const { handlePointerDown } = useLogoDrag(containerRef, positionX, positionY, onPositionChange);

    const techniqueFilter = useMemo(
      () => getTechniqueFilter(techniqueCode, techniqueName),
      [techniqueCode, techniqueName],
    );

    const colorConfigFilter = useMemo(() => {
      if (!techniqueColorConfig) return null;
      if (techniqueColorConfig.category === 'laser') {
        const tone = techniqueColorConfig.laserTone || 'escuro';
        return tone === 'claro'
          ? { filter: 'grayscale(1) brightness(1.4)', opacity: 0.75 }
          : { filter: 'grayscale(1) brightness(0.6)', opacity: 0.88 };
      }
      if (techniqueColorConfig.category === 'serigrafia') {
        return { filter: 'contrast(1.2)', opacity: 0.92 };
      }
      return null;
    }, [techniqueColorConfig]);

    // cm→px conversion using product physical dimensions
    const boundsReady = productBounds.detected;
    const logoDisplay = useMemo(() => {
      if (!boundsReady) return null;

      const containerW = containerSize.width || 400;
      const containerH = containerSize.height || containerW;
      const prodH = productHeightCm && productHeightCm > 0 ? productHeightCm : null;
      const prodW = productWidthCm && productWidthCm > 0 ? productWidthCm : null;
      const effectiveMaxW = maxWidth && maxWidth > 0 ? maxWidth : null;
      const effectiveMaxH = maxHeight && maxHeight > 0 ? maxHeight : null;

      const imgAR = productBounds.imageAspectRatio || 1;
      const containerAR = containerW / containerH;
      let renderedImgW: number, renderedImgH: number;
      if (imgAR > containerAR) {
        renderedImgW = containerW;
        renderedImgH = containerW / imgAR;
      } else {
        renderedImgH = containerH;
        renderedImgW = containerH * imgAR;
      }

      const physW = prodW || (prodH ? prodH * 0.4 : effectiveMaxW ? effectiveMaxW * 2 : 8);
      const physH = prodH || (prodW ? prodW * 2.5 : effectiveMaxH ? effectiveMaxH * 2.5 : 20);

      if (!prodH && !prodW) {
        logger.warn('[LogoPositionEditor] Product physical dims missing — using estimates:', {
          physW,
          physH,
        });
      }

      const scaleByW = (renderedImgW * productBounds.fractionX) / physW;
      const scaleByH = (renderedImgH * productBounds.fractionY) / physH;
      const cmToPx = Math.min(scaleByW, scaleByH);

      const rawW = logoWidth * cmToPx;
      const rawH = logoHeight * cmToPx;
      const minPx = 40;
      if (rawW < minPx && rawH < minPx) {
        const boost = minPx / Math.max(rawW, rawH);
        return { widthPx: rawW * boost, heightPx: rawH * boost };
      }

      return { widthPx: rawW, heightPx: rawH };
    }, [
      boundsReady,
      logoWidth,
      logoHeight,
      containerSize.width,
      containerSize.height,
      maxWidth,
      maxHeight,
      productHeightCm,
      productWidthCm,
      productBounds,
    ]);

    const userScaleFactor = (logoScale || 100) / 100;

    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Move className="h-4 w-4 text-primary" aria-hidden="true" />
                Posicionar Logo
              </CardTitle>
              <CardDescription className="text-xs">
                Arraste o logo para posicionar. Use os sliders para ajustar tamanho.
              </CardDescription>
            </div>
            {headerActions}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <LogoPreviewCanvas
            containerRef={containerRef}
            productImageUrl={productImageUrl}
            logoPreview={logoPreview}
            logoDisplay={logoDisplay}
            positionX={positionX}
            positionY={positionY}
            logoRotation={logoRotation}
            userScaleFactor={userScaleFactor}
            processedLogoUrl={processedLogoUrl}
            techniqueFilter={techniqueFilter}
            colorConfigFilter={colorConfigFilter}
            techniqueColorConfig={techniqueColorConfig}
            techniqueName={techniqueName}
            onPointerDown={handlePointerDown}
            onColorConfigClick={onColorConfigClick}
          />

          <LogoQuickActions
            logoPreview={logoPreview}
            positionX={positionX}
            positionY={positionY}
            logoRotation={logoRotation}
            onPositionChange={onPositionChange}
            onRotationChange={onRotationChange}
          />

          <LogoSizeControls
            logoPreview={logoPreview}
            logoWidth={logoWidth}
            logoHeight={logoHeight}
            logoScale={logoScale}
            logoRotation={logoRotation}
            positionX={positionX}
            positionY={positionY}
            maxWidth={maxWidth}
            maxHeight={maxHeight}
            onSizeChange={onSizeChange}
            onLogoScaleChange={onLogoScaleChange}
          />
        </CardContent>
      </Card>
    );
  },
);
