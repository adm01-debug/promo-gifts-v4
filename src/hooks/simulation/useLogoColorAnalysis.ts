/**
 * useLogoColorAnalysis — Hook para análise de cores de logo
 *
 * Envia a imagem para a edge function, recebe cores detectadas,
 * e mapeia para Pantone mais próximo via Delta-E.
 */

import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getBestPantoneMatch, type PantoneMatch } from '@/utils/color-matching';
import { toast } from 'sonner';

export interface DetectedColor {
  name: string;
  hex: string;
  pantoneMatch: PantoneMatch;
  /** User can override the Pantone selection */
  selectedPantone: string;
}

export interface LogoColorAnalysisResult {
  colors: DetectedColor[];
  isAnalyzing: boolean;
  error: string | null;
}

export function useLogoColorAnalysis() {
  const [colors, setColors] = useState<DetectedColor[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const analyzeImage = useCallback(async (imageBase64: string) => {
    // 1. Resize image locally before sending to edge function for faster processing
    // Color analysis doesn't need high resolution
    const resizeImage = (base64: string): Promise<string> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 200; // Small is fine for color extraction
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(base64);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/png', 0.8));
        };
        img.onerror = () => resolve(base64);
        img.src = base64;
      });
    };

    // Cancel any in-flight analysis
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsAnalyzing(true);
    setError(null);
    setColors([]);

    try {
      const resizedBase64 = await resizeImage(imageBase64);

      const { data, error: fnError } = await supabase.functions.invoke('analyze-logo-colors', {
        body: { imageBase64: resizedBase64 },
      });

      if (fnError) throw fnError;

      if (data?.error) {
        throw new Error(data.error);
      }

      const rawColors: Array<{ name: string; hex: string }> = data?.colors ?? [];

      if (rawColors.length === 0) {
        setError('Nenhuma cor detectada na imagem');
        return [];
      }

      // Map each detected color to nearest Pantone
      const mapped: DetectedColor[] = rawColors.map((c) => {
        const match = getBestPantoneMatch(c.hex);
        return {
          name: c.name,
          hex: c.hex,
          pantoneMatch: match,
          selectedPantone: match.pantoneCode,
        };
      });

      setColors(mapped);
      toast.success(`${mapped.length} cor(es) detectada(s) na logo`);
      return mapped;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return [];
      if (controller.signal.aborted) return [];
      const msg = err instanceof Error ? err.message : 'Erro ao analisar cores da logo';
      setError(msg);
      toast.error(msg);
      return [];
    } finally {
      if (!controller.signal.aborted) setIsAnalyzing(false);
    }
  }, []);

  const updatePantone = useCallback((index: number, pantoneCode: string) => {
    setColors((prev) =>
      prev.map((c, i) => (i === index ? { ...c, selectedPantone: pantoneCode } : c)),
    );
  }, []);

  const clearAnalysis = useCallback(() => {
    setColors([]);
    setError(null);
  }, []);

  return {
    colors,
    isAnalyzing,
    error,
    analyzeImage,
    updatePantone,
    clearAnalysis,
  };
}
