import { useState, useEffect } from 'react';
import { processLogoForLaser, processLogoForSerigrafia } from '@/utils/laser-logo-processor';
import { logger } from '@/lib/logger';
import type { TechniqueColorConfig } from '../techniqueColorUtils';

/**
 * Canvas-based logo processing for Laser + Serigrafia techniques.
 * Laser: converts all visible pixels to a single solid tone (claro/escuro).
 * Serigrafia: maps each pixel to the nearest selected Pantone color.
 * Both preserve white/transparent gaps between logo elements.
 */
export function useLogoProcessing(
  logoPreview: string | null,
  techniqueColorConfig?: TechniqueColorConfig | null,
) {
  const [processedLogoUrl, setProcessedLogoUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const isLaser = techniqueColorConfig?.category === 'laser';
    const isSerigrafia = techniqueColorConfig?.category === 'serigrafia';
    const needsProcessing = isLaser || isSerigrafia;

    if (!needsProcessing || !logoPreview) {
      setProcessedLogoUrl(null);
      return;
    }

    let cancelled = false;
    setIsProcessing(true);

    let promise: Promise<string>;

    if (isLaser) {
      const tone = techniqueColorConfig?.laserTone || 'escuro';
      promise = processLogoForLaser(logoPreview, tone);
    } else {
      const selectedColors = techniqueColorConfig?.selectedColors ?? [];
      if (selectedColors.length === 0) {
        setIsProcessing(false);
        setProcessedLogoUrl(null);
        return;
      }
      promise = processLogoForSerigrafia(logoPreview, selectedColors);
    }

    promise
      .then((dataUrl) => {
        if (!cancelled) setProcessedLogoUrl(dataUrl);
      })
      .catch((err: unknown) => {
        logger.error('[useLogoProcessing] Falha ao processar logo para técnica:', err);
        if (!cancelled) setProcessedLogoUrl(null);
      })
      .finally(() => {
        if (!cancelled) setIsProcessing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    logoPreview,
    techniqueColorConfig?.category,
    techniqueColorConfig?.laserTone,
    techniqueColorConfig?.selectedColors,
  ]);

  return { processedLogoUrl, isProcessing };
}
