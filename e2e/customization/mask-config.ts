/**
 * Configuração central de máscaras dinâmicas e limiares por viewport para o
 * spec de reflow do LocationPanel (`collapse-reflow.spec.ts`).
 *
 * Editar aqui evita mexer no spec quando um `data-testid` muda ou quando
 * precisamos afrouxar/apertar tolerância em um viewport específico.
 *
 * Extensão via env (rápido, sem alterar código):
 *   COLLAPSE_MASK_EXTRA="[data-testid=meu-badge],[data-testid=novo-timer]"
 *   COLLAPSE_MASK_DISABLE="[data-testid*=badge-count]"
 *   COLLAPSE_THRESHOLD_MOBILE=0.30
 *   COLLAPSE_RATIO_TABLET=0.02
 */

export type ViewportLabel = "mobile" | "tablet" | "desktop";

export interface ThresholdConfig {
  threshold: number;
  maxDiffPixelRatio: number;
}

/** Selectors sempre mascarados (base). */
export const BASE_DYNAMIC_MASK_SELECTORS: readonly string[] = [
  '[data-testid*="timer"]',
  '[data-testid*="countdown"]',
  '[data-testid*="badge-count"]',
  '[data-testid="quote-total-personalization"]',
  '[data-dynamic="true"]',
  '[data-live-region="true"]',
  '[aria-live="polite"]',
  '[aria-live="assertive"]',
  ".sonner-toast",
] as const;

/** Limiar padrão por viewport (pode ser sobrescrito por env). */
export const DEFAULT_THRESHOLDS: Record<ViewportLabel, ThresholdConfig> = {
  mobile: { threshold: 0.25, maxDiffPixelRatio: 0.015 },
  tablet: { threshold: 0.25, maxDiffPixelRatio: 0.015 },
  desktop: { threshold: 0.25, maxDiffPixelRatio: 0.015 },
};

function splitList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Selectors efetivos após aplicar COLLAPSE_MASK_EXTRA/DISABLE. */
export function getMaskSelectors(): string[] {
  const extra = splitList(process.env.COLLAPSE_MASK_EXTRA);
  const disabled = new Set(splitList(process.env.COLLAPSE_MASK_DISABLE));
  return [...BASE_DYNAMIC_MASK_SELECTORS, ...extra].filter((s) => !disabled.has(s));
}

/** Limiares efetivos por viewport (env sobrescreve default). */
export function getThresholds(vp: ViewportLabel): ThresholdConfig {
  const base = DEFAULT_THRESHOLDS[vp];
  // GAP-B1: `Number("")` e `Number("   ")` retornam 0 (não NaN), o que
  // silenciosamente aceitava env vazio/whitespace como threshold=0 —
  // ignorando o default. Normalizamos com trim + guard de string vazia.
  const parse = (raw: string | undefined, fallback: number): number => {
    if (raw === undefined) return fallback;
    const trimmed = raw.trim();
    if (trimmed === "") return fallback;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : fallback;
  };
  return {
    threshold: parse(process.env[`COLLAPSE_THRESHOLD_${vp.toUpperCase()}`], base.threshold),
    maxDiffPixelRatio: parse(process.env[`COLLAPSE_RATIO_${vp.toUpperCase()}`], base.maxDiffPixelRatio),
  };
}


/** Snapshot serializável (útil para relatórios/PR comment). */
export function describeConfig() {
  const viewports: ViewportLabel[] = ["mobile", "tablet", "desktop"];
  return {
    masks: getMaskSelectors(),
    thresholds: Object.fromEntries(viewports.map((v) => [v, getThresholds(v)])) as Record<
      ViewportLabel,
      ThresholdConfig
    >,
  };
}
