/**
 * Contraste/legibilidade — marca d'água "RASCUNHO".
 *
 * Guarda-corpo numérico para o alpha do watermark. Não confia em inspeção
 * visual: mede que o vermelho composto sobre branco fica dentro de uma
 * janela de contraste WCAG "sutil-mas-perceptível":
 *
 *   • Alpha DENTRO de WATERMARK_ALPHA_BOUNDS (não some, não fica agressivo).
 *   • Contraste calculado (relativa) DENTRO de WATERMARK_CONTRAST_BOUNDS.
 *   • RGB composto sobre branco continua com dominância clara do canal R
 *     (senão perde a semântica de "aviso vermelho").
 *
 * Se alguém tentar puxar o alpha para 0.02 (some) ou 0.20 (agressivo),
 * este teste barra ANTES do E2E rodar.
 */
import { describe, it, expect } from 'vitest';
import {
  WATERMARK_ALPHA,
  WATERMARK_ALPHA_BOUNDS,
  WATERMARK_CONTRAST_BOUNDS,
  WATERMARK_RGB,
  composeWatermarkOverWhite,
  watermarkContrastAgainstWhite,
} from '../watermarkTokens';

describe('watermarkTokens · contraste e legibilidade', () => {
  it('alpha está dentro dos limites de agressividade', () => {
    expect(
      WATERMARK_ALPHA,
      `alpha ${WATERMARK_ALPHA} fora de [${WATERMARK_ALPHA_BOUNDS.min}, ${WATERMARK_ALPHA_BOUNDS.max}]`,
    ).toBeGreaterThanOrEqual(WATERMARK_ALPHA_BOUNDS.min);
    expect(WATERMARK_ALPHA).toBeLessThanOrEqual(WATERMARK_ALPHA_BOUNDS.max);
  });

  it('contraste WCAG contra branco fica na faixa perceptível-mas-não-agressiva', () => {
    const ratio = watermarkContrastAgainstWhite();
    expect(
      ratio,
      `contraste ${ratio.toFixed(3)} fora de [${WATERMARK_CONTRAST_BOUNDS.min}, ${WATERMARK_CONTRAST_BOUNDS.max}]`,
    ).toBeGreaterThanOrEqual(WATERMARK_CONTRAST_BOUNDS.min);
    expect(ratio).toBeLessThanOrEqual(WATERMARK_CONTRAST_BOUNDS.max);
  });

  it('RGB efetivo mantém dominância do vermelho (semântica de aviso)', () => {
    const composed = composeWatermarkOverWhite();
    // Sobre branco, foreground (200,0,0) puxa G/B para baixo mais que R.
    // Diferença R − média(G,B) captura o "tom rosado" perceptível.
    const avgGB = (composed.g + composed.b) / 2;
    expect(
      composed.r - avgGB,
      `sem dominância vermelha visível (composed=${JSON.stringify(composed)})`,
    ).toBeGreaterThan(3);
    // Vermelho não pode saturar em bloco denso (fica < 255) e não pode desbotar
    // até quase branco puro (fica ≥ 240, senão o aviso some).
    expect(composed.r).toBeLessThan(255);
    expect(composed.r).toBeGreaterThanOrEqual(240);
  });

  it('cores base do token não foram alteradas silenciosamente', () => {
    // Snapshot rígido do tom: RGB do design é 200/0/0. Se mudar, revisar
    // marca com o PO — não é ajuste técnico.
    expect(WATERMARK_RGB).toEqual({ r: 200, g: 0, b: 0 });
  });
});
