/**
 * SSOT — Design tokens da marca d'água "RASCUNHO" do PDF de proposta.
 *
 * Um único ponto de verdade para o texto, cor e limites de "agressividade"
 * do watermark. Consumido pelo template (`PropostaComercialTailwind`) e por
 * todos os testes (unit + contraste + E2E), evitando divergência entre
 * literal do componente e literal duplicado nos specs.
 *
 * Regra de negócio:
 *   - alpha DEVE ficar dentro de `WATERMARK_ALPHA_BOUNDS` — abaixo do min a
 *     marca some (risco de rascunho ser enviado como final); acima do max
 *     fica agressivo e prejudica leitura do conteúdo.
 *   - fundo canônico do PDF é branco puro (rgb 255,255,255). O cálculo de contraste
 *     assume esse background — se algum dia mudarmos o fundo, revisar aqui.
 */

export const WATERMARK_TEXT = 'RASCUNHO' as const;

export const WATERMARK_RGB = { r: 200, g: 0, b: 0 } as const;

/**
 * Alpha do vermelho. Sobe/desce apenas aqui — o resto propaga.
 * Histórico: 0.07 → 0.0805 (+15%) em 2026-07-05 a pedido do PO.
 */
export const WATERMARK_ALPHA = 0.0805 as const;

/**
 * Faixa aceitável de agressividade. Testes falham fora destes limites.
 *   min: abaixo disso vira "invisível" (risco de sumiço).
 *   max: acima disso vira "agressivo" (interfere na leitura).
 */
export const WATERMARK_ALPHA_BOUNDS = { min: 0.05, max: 0.12 } as const;

/**
 * Fundo canônico assumido pelo PDF (branco puro).
 * Cálculo de contraste e legibilidade dependem disto.
 */
export const WATERMARK_BACKGROUND_RGB = { r: 255, g: 255, b: 255 } as const;

/**
 * Cor CSS final aplicada pelo template — sempre derivada dos tokens acima.
 * NÃO reescrever manualmente. Se precisar mudar o tom, ajuste RGB/ALPHA.
 */
export const WATERMARK_COLOR_CSS = `rgba(${WATERMARK_RGB.r}, ${WATERMARK_RGB.g}, ${WATERMARK_RGB.b}, ${WATERMARK_ALPHA})`;

// ── Helpers de legibilidade ──────────────────────────────────────────────────

/**
 * Compõe o vermelho semi-transparente sobre o fundo branco e devolve o RGB
 * efetivo que o olho enxerga. Fórmula clássica de alpha compositing:
 *   Cout = Cfg * a + Cbg * (1 - a)
 */
export function composeWatermarkOverWhite(): { r: number; g: number; b: number } {
  const a = WATERMARK_ALPHA;
  const fg = WATERMARK_RGB;
  const bg = WATERMARK_BACKGROUND_RGB;
  return {
    r: Math.round(fg.r * a + bg.r * (1 - a)),
    g: Math.round(fg.g * a + bg.g * (1 - a)),
    b: Math.round(fg.b * a + bg.b * (1 - a)),
  };
}

/** Luminância relativa WCAG de um RGB 0-255. */
export function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055)**2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * Contraste WCAG entre o watermark efetivo (composto sobre branco) e o
 * próprio fundo branco. Marca d'água legível — mas não agressiva — deve
 * ficar em uma faixa "sutil": perceptível ao olho, longe de contraste
 * pleno de texto (que seria ≥ 4.5:1).
 *
 * Bounds calibrados empiricamente para alpha ∈ [0.05, 0.12]:
 *   min ≈ 1.03 (perceptível)
 *   max ≈ 1.18 (não agressivo)
 */
export const WATERMARK_CONTRAST_BOUNDS = { min: 1.03, max: 1.2 } as const;

export function watermarkContrastAgainstWhite(): number {
  const composed = composeWatermarkOverWhite();
  const lFg = relativeLuminance(composed);
  const lBg = relativeLuminance(WATERMARK_BACKGROUND_RGB);
  const [lighter, darker] = lFg > lBg ? [lFg, lBg] : [lBg, lFg];
  return (lighter + 0.05) / (darker + 0.05);
}
