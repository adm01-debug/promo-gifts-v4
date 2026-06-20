/**
 * MockupLayoutButtons — "Gerar Layout" buttons for the mockup result panel.
 * Two modes: AI (uses existing generated mockup) and Static (high-res composition).
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, ImageIcon, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { detectProductBounds } from '@/lib/product-bounds-detector';
import { MockupApprovalPreview } from './MockupApprovalPreview';
import type { MockupApprovalData } from '@/types/mockup-approval';
import type { MockupClient } from '@/components/mockup/MockupConfigPanel';
import type { DetectedColor } from '@/hooks/simulation';

import { logger } from '@/lib/logger';
interface MockupLayoutButtonsProps {
  /** The AI-generated mockup URL */
  generatedMockup: string | null;
  /** Product info */
  product: {
    name: string;
    sku?: string;
    imageUrl?: string;
    color?: string;
    colorHex?: string;
    material?: string;
    heightCm?: number | null;
    widthCm?: number | null;
    diameterCm?: number | null;
    depthCm?: number | null;
    capacityMl?: number | null;
    weightG?: number | null;
  } | null;
  /** Selected technique */
  technique: {
    name: string;
    code?: string | null;
    maxWidth?: number | null;
    maxHeight?: number | null;
    locationName?: string | null;
  } | null;
  /** Selected client */
  client: MockupClient | null;
  /** Seller info */
  seller: {
    name: string;
    email?: string;
  } | null;
  /** Active personalization area dimensions */
  activeArea: {
    logoWidth: number;
    logoHeight: number;
    logoPreview?: string | null;
    positionX: number;
    positionY: number;
    logoRotation?: number;
    logoScale?: number;
    name: string;
  } | null;
  /** Physical product dimensions in cm */
  productHeightCm?: number | null;
  productWidthCm?: number | null;
  /** Pantone colors from logo analysis */
  pantoneColors?: DetectedColor[];
  /** Number of colors from technique config */
  colorsCount?: number;
  /** Callback to save the generated static mockup to history */
  onStaticGenerated?: (
    dataUrl: string,
    extra?: { locationName?: string; colorsCount?: number },
  ) => void;
  /** Callback when layout image is captured from the approval template */
  onLayoutCaptured?: (layoutDataUrl: string) => void;
  /** Trigger AI mockup generation (async) */
  onGenerateMockup?: () => Promise<void>;
  /** Whether AI mockup is currently being generated */
  isGeneratingMockup?: boolean;
}

export function MockupLayoutButtons({
  generatedMockup,
  product,
  technique,
  client,
  seller,
  activeArea,
  productHeightCm,
  productWidthCm,
  pantoneColors,
  colorsCount,
  onStaticGenerated,
  onLayoutCaptured,
  onGenerateMockup,
  isGeneratingMockup,
}: MockupLayoutButtonsProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [approvalData, setApprovalData] = useState<MockupApprovalData | null>(null);
  const [isGeneratingStatic, setIsGeneratingStatic] = useState(false);
  const pendingLayoutAI = useRef(false);

  const buildApprovalData = useCallback(
    (mockupUrl: string, mode: 'ai' | 'static'): MockupApprovalData => {
      const now = new Date();
      const dateStr = now.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      const docNumber = `MK-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

      return {
        documentNumber: docNumber,
        date: dateStr,
        client: {
          name: client?.nome_fantasia || client?.razao_social || client?.name || '—',
          cnpj: client?.cnpj,
          logoUrl: client?.logo_url || undefined,
        },
        seller: {
          name: seller?.name || '—',
          email: seller?.email,
        },
        product: {
          name: product?.name || '—',
          sku: product?.sku,
          imageUrl: product?.imageUrl,
          color: product?.color,
          colorHex: product?.colorHex,
          material: product?.material,
          heightCm: product?.heightCm,
          widthCm: product?.widthCm,
          diameterCm: product?.diameterCm,
          depthCm: product?.depthCm,
          capacityMl: product?.capacityMl,
          weightG: product?.weightG,
        },
        personalization: {
          techniqueName: technique?.name || '—',
          techniqueCode: technique?.code || undefined,
          locationName: technique?.locationName || activeArea?.name || 'Frente',
          widthCm: activeArea?.logoWidth || technique?.maxWidth || 0,
          heightCm: activeArea?.logoHeight || technique?.maxHeight || 0,
          colorsCount,
        },
        pantoneColors: (pantoneColors || []).map((c) => ({
          name: c.selectedPantone || c.pantoneMatch?.pantoneCode || c.name,
          hex: c.hex,
        })),
        mockupImageUrl: mockupUrl,
        layoutMode: mode,
      };
    },
    [client, seller, product, technique, activeArea, pantoneColors, colorsCount],
  );

  // When generatedMockup arrives and we were waiting for it, auto-open layout
  useEffect(() => {
    if (pendingLayoutAI.current && generatedMockup) {
      pendingLayoutAI.current = false;
      const data = buildApprovalData(generatedMockup, 'ai');
      setApprovalData(data);
      setPreviewOpen(true);
    }
  }, [generatedMockup, buildApprovalData]);

  const handleLayoutAI = useCallback(async () => {
    if (generatedMockup) {
      // Mockup already exists, open layout directly
      const data = buildApprovalData(generatedMockup, 'ai');
      setApprovalData(data);
      setPreviewOpen(true);
      return;
    }
    // No mockup yet — trigger generation, layout opens via useEffect above
    if (!onGenerateMockup) {
      toast.error('Configure o gerador de mockup primeiro.');
      return;
    }
    // BUG-LAY1 FIX: wrap in try/catch so that (a) unhandled rejection is prevented
    // and (b) pendingLayoutAI is cleared if onGenerateMockup throws, stopping it
    // from auto-opening the layout dialog on the next unrelated mockup generation.
    pendingLayoutAI.current = true;
    try {
      await onGenerateMockup();
    } catch {
      pendingLayoutAI.current = false;
    }
  }, [generatedMockup, buildApprovalData, onGenerateMockup]);

  const handleLayoutStatic = useCallback(async () => {
    if (!product?.imageUrl || !activeArea?.logoPreview) {
      toast.error('Selecione um produto e faça upload do logo primeiro.');
      return;
    }

    setIsGeneratingStatic(true);
    try {
      const CANVAS_SIZE = 1024;
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_SIZE;
      canvas.height = CANVAS_SIZE;
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // Load product image with CORS fallback
      const productImg = await loadImageWithFallback(product.imageUrl);

      // Detect product bounds (same as editor's useProductBounds)
      const bounds = await detectProductBounds(product.imageUrl);

      // Draw product centered with object-contain logic (matches editor)
      const imgAR = productImg.naturalWidth / productImg.naturalHeight;
      let renderedImgW: number, renderedImgH: number;
      if (imgAR > 1) {
        renderedImgW = CANVAS_SIZE;
        renderedImgH = CANVAS_SIZE / imgAR;
      } else {
        renderedImgH = CANVAS_SIZE;
        renderedImgW = CANVAS_SIZE * imgAR;
      }
      const imgLeft = (CANVAS_SIZE - renderedImgW) / 2;
      const imgTop = (CANVAS_SIZE - renderedImgH) / 2;
      ctx.drawImage(productImg, imgLeft, imgTop, renderedImgW, renderedImgH);

      // Load logo
      const logoImg = await loadImageWithFallback(activeArea.logoPreview);

      // ── Replicate editor's cm→px scaling logic exactly ──
      const effectiveMaxW =
        technique?.maxWidth && technique.maxWidth > 0 ? technique.maxWidth : null;
      const effectiveMaxH =
        technique?.maxHeight && technique.maxHeight > 0 ? technique.maxHeight : null;
      const prodH = productHeightCm && productHeightCm > 0 ? productHeightCm : null;
      const prodW = productWidthCm && productWidthCm > 0 ? productWidthCm : null;

      const physW = prodW || (prodH ? prodH * 0.4 : effectiveMaxW ? effectiveMaxW * 2 : 8);
      const physH = prodH || (prodW ? prodW * 2.5 : effectiveMaxH ? effectiveMaxH * 2.5 : 20);

      const scaleByW = (renderedImgW * bounds.fractionX) / physW;
      const scaleByH = (renderedImgH * bounds.fractionY) / physH;
      const cmToPx = Math.min(scaleByW, scaleByH);

      let areaW = activeArea.logoWidth * cmToPx;
      let areaH = activeArea.logoHeight * cmToPx;
      const minPx = 40;
      if (areaW < minPx && areaH < minPx) {
        const boost = minPx / Math.max(areaW, areaH);
        areaW *= boost;
        areaH *= boost;
      }

      // Position: same as editor (left/top % of full container/canvas)
      const areaX = (activeArea.positionX / 100) * CANVAS_SIZE - areaW / 2;
      const areaY = (activeArea.positionY / 100) * CANVAS_SIZE - areaH / 2;

      // Replicate editor's inner img object-contain transform scale/rotate
      const logoAR = logoImg.naturalWidth / logoImg.naturalHeight;
      const areaAR = areaW / areaH;
      let containW: number;
      let containH: number;
      if (logoAR > areaAR) {
        containW = areaW;
        containH = areaW / logoAR;
      } else {
        containH = areaH;
        containW = areaH * logoAR;
      }
      const offsetX = (areaW - containW) / 2;
      const offsetY = (areaH - containH) / 2;

      const rotation = ((activeArea.logoRotation || 0) * Math.PI) / 180;
      const userScale = (activeArea.logoScale ?? 100) / 100;

      // Parent container in editor uses overflow-hidden; replicate by clipping the area rect
      ctx.save();
      ctx.beginPath();
      ctx.rect(areaX, areaY, areaW, areaH);
      ctx.clip();

      // Transform around area center (same visual behavior as CSS transform on child image)
      ctx.translate(areaX + areaW / 2, areaY + areaH / 2);
      ctx.rotate(rotation);
      ctx.scale(userScale, userScale);

      ctx.drawImage(logoImg, -areaW / 2 + offsetX, -areaH / 2 + offsetY, containW, containH);
      ctx.restore();

      const dataUrl = canvas.toDataURL('image/png');
      // Save to history automatically
      onStaticGenerated?.(dataUrl, {
        locationName: technique?.locationName || activeArea?.name || undefined,
        colorsCount,
      });
      const data = buildApprovalData(dataUrl, 'static');
      setApprovalData(data);
      setPreviewOpen(true);
    } catch (err) {
      logger.error('Static composition error:', err);
      toast.error('Erro ao gerar composição estática. Verifique se as imagens estão acessíveis.');
    } finally {
      setIsGeneratingStatic(false);
    }
  }, [
    product,
    activeArea,
    technique,
    productHeightCm,
    productWidthCm,
    buildApprovalData,
    onStaticGenerated,
    colorsCount,
  ]);

  // Don't show if no product/technique selected
  if (!product || !technique || !activeArea) return null;

  return (
    <>
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex-1">
              <Button
                size="sm"
                onClick={handleLayoutStatic}
                disabled={!activeArea?.logoPreview || isGeneratingStatic}
                className="w-full gap-1.5 !bg-primary font-semibold !text-primary-foreground shadow-md shadow-primary/30 transition-all hover:!bg-primary/80 hover:shadow-lg hover:shadow-primary/40 disabled:cursor-not-allowed disabled:!opacity-40"
              >
                {isGeneratingStatic ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ImageIcon className="h-3.5 w-3.5" />
                )}
                Gerar Layout
              </Button>
            </span>
          </TooltipTrigger>
          {!activeArea?.logoPreview && (
            <TooltipContent side="bottom">
              <p>Faça upload do logo primeiro</p>
            </TooltipContent>
          )}
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex-1">
              <Button
                size="sm"
                onClick={handleLayoutAI}
                disabled={!activeArea?.logoPreview || isGeneratingMockup}
                className="w-full gap-1.5 !bg-primary font-semibold !text-primary-foreground shadow-md shadow-primary/30 transition-all hover:!bg-primary/80 hover:shadow-lg hover:shadow-primary/40 disabled:cursor-not-allowed disabled:!opacity-40"
              >
                {isGeneratingMockup ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Gerar Layout - IA
              </Button>
            </span>
          </TooltipTrigger>
          {!activeArea?.logoPreview && (
            <TooltipContent side="bottom">
              <p>Faça upload do logo primeiro</p>
            </TooltipContent>
          )}
        </Tooltip>
      </div>

      {approvalData && (
        <MockupApprovalPreview
          data={approvalData}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          onLayoutCaptured={onLayoutCaptured}
        />
      )}
    </>
  );
}

/* ─── Util: Load image with CORS fallback ─── */
async function loadImageWithFallback(src: string): Promise<HTMLImageElement> {
  // Try with CORS first
  try {
    return await loadImage(src, true);
  } catch {
    // Fallback: fetch as blob to bypass CORS
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const img = await loadImage(blobUrl, false);
      URL.revokeObjectURL(blobUrl);
      return img;
    } catch {
      // Last resort: try without CORS attribute (will taint canvas but at least renders)
      return loadImage(src, false);
    }
  }
}

function loadImage(src: string, useCors: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (useCors) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}
