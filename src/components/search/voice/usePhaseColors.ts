import { useMemo, useState, useEffect } from 'react';
import type { VoiceAgentPhase } from '@/hooks/intelligence';

function getThemeHSL(): [number, number, number] {
  if (typeof window === 'undefined') return [25, 95, 53];
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
  const parts = raw.split(/\s+/).map((s) => parseFloat(s));
  if (parts.length >= 3 && !parts.some(isNaN)) return [parts[0], parts[1], parts[2]];
  return [25, 95, 53];
}

export function hsl(h: number, s: number, l: number) {
  return `hsl(${h}, ${s}%, ${l}%)`;
}
export function hsla(h: number, s: number, l: number, a: number) {
  return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

export interface PhaseColors {
  primary: string;
  secondary: string;
  accent: string;
  glow1: string;
  glow2: string;
  particles: string[];
}

export function usePhaseColors(phase: VoiceAgentPhase, isBooting: boolean): PhaseColors {
  const effectivePhase = isBooting ? 'booting' : phase;
  const [baseHSL, setBaseHSL] = useState<[number, number, number]>([25, 95, 53]);

  useEffect(() => {
    setBaseHSL(getThemeHSL());
    const obs = new MutationObserver(() => setBaseHSL(getThemeHSL()));
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style', 'class'],
    });
    return () => obs.disconnect();
  }, []);

  return useMemo(() => {
    const [h, s, l] = baseHSL;
    const rosa = 330;
    const violeta = 270;
    const magenta = 300;
    const lavanda = 285;

    switch (effectivePhase) {
      case 'listening':
        return {
          primary: hsl(h, s, l),
          secondary: hsl(rosa, 80, 65),
          accent: hsl(violeta, 70, 60),
          glow1: hsla(h, s, l, 0.5),
          glow2: hsla(rosa, 75, 60, 0.4),
          particles: [
            hsl(h, s, l),
            hsl(rosa, 85, 65),
            hsl(rosa, 75, 75),
            hsl(violeta, 70, 60),
            hsl(violeta, 65, 72),
            hsl(magenta, 80, 68),
          ],
        };
      case 'processing':
        return {
          primary: hsl(violeta, 75, 58),
          secondary: hsl(rosa, 80, 62),
          accent: hsl(magenta, 78, 65),
          glow1: hsla(violeta, 75, 58, 0.5),
          glow2: hsla(rosa, 80, 62, 0.4),
          particles: [
            hsl(violeta, 75, 58),
            hsl(violeta, 65, 70),
            hsl(magenta, 78, 65),
            hsl(rosa, 80, 62),
            hsl(rosa, 70, 72),
            hsl(lavanda, 65, 70),
          ],
        };
      case 'speaking':
        return {
          primary: hsl(rosa, 82, 62),
          secondary: hsl(h, s, l),
          accent: hsl(magenta, 75, 68),
          glow1: hsla(rosa, 82, 62, 0.5),
          glow2: hsla(violeta, 70, 58, 0.35),
          particles: [
            hsl(rosa, 82, 62),
            hsl(rosa, 75, 72),
            hsl(magenta, 75, 68),
            hsl(h, s, l),
            hsl(violeta, 65, 65),
            hsl(lavanda, 60, 75),
          ],
        };
      case 'error':
        return {
          primary: hsl(0, 75, 55),
          secondary: hsl(330, 70, 50),
          accent: hsl(0, 70, 65),
          glow1: hsla(0, 75, 55, 0.45),
          glow2: hsla(330, 70, 50, 0.3),
          particles: [hsl(0, 75, 55), hsl(0, 70, 65), hsl(0, 60, 75), hsl(330, 70, 50)],
        };
      case 'booting':
        return {
          primary: hsl(h, s, l),
          secondary: hsl(violeta, 65, 62),
          accent: hsl(rosa, 70, 68),
          glow1: hsla(h, s, l, 0.4),
          glow2: hsla(violeta, 65, 62, 0.35),
          particles: [
            hsl(h, s, l),
            hsl(rosa, 70, 68),
            hsl(rosa, 60, 78),
            hsl(violeta, 65, 62),
            hsl(violeta, 55, 72),
          ],
        };
      case 'idle':
      default:
        return {
          primary: hsl(h, s, l),
          secondary: hsl(rosa, 75, 65),
          accent: hsl(violeta, 65, 60),
          glow1: hsla(h, s, l, 0.35),
          glow2: hsla(rosa, 70, 62, 0.25),
          particles: [
            hsl(h, s, l),
            hsl(rosa, 75, 65),
            hsl(rosa, 65, 75),
            hsl(violeta, 65, 60),
            hsl(violeta, 55, 72),
          ],
        };
    }
  }, [effectivePhase, baseHSL]);
}
