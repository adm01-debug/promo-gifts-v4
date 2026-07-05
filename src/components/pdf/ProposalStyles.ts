/**
 * Shared styles and constants for ProposalHtmlTemplate
 */
import type React from 'react';

export const GREEN = '#00c853';
export const GREEN_DARK = '#009e41';
export const DARK = '#333333';
export const BLUE = '#0085ca';

/**
 * Design tokens do PDF da proposta (SSOT).
 * Centraliza cores usadas em headers/totais/swatches para garantir
 * consistência e permitir verificação automática de contraste WCAG.
 */
export const PDF_TOKENS = {
  /** Texto sobre header verde e sobre linhas totais (valor em destaque). */
  textOnGreen: '#111',
  /** Rótulo secundário sobre o header verde (ex.: "Valor Total:") — cinza médio para leveza visual. Bold ≥13px, ratio ~3.3:1 sobre GREEN (WCAG AA UI/large-text, abaixo do AA texto normal 4.5:1 por decisão de design). */
  labelOnGreen: '#555',
  /** Texto padrão em células de conteúdo. */
  textBody: '#333',
  /** Fundo do swatch de cor quando `colorHex` está ausente. */
  swatchFallback: '#ccc',
  /** Borda do swatch — reforçada para contrastar com texto preto adjacente. */
  swatchBorder: '#666',
  /** Fundo linhas pares / ímpares. */
  rowEven: '#ffffff',
  rowOdd: '#f9fafb',
} as const;

/**
 * Largura canônica do bloco de totais (SSOT).
 * Compartilhada entre `ProposalSections.TotalsSection` (PDF interno) e
 * `proposal/ProposalTotals` (proposta exportada) para evitar divergência
 * visual entre as duas variações. Valor atual reflete redução de 20%
 * aplicada em 2026-07 sobre a largura anterior (288px/304px).
 */
export const TOTALS_BLOCK_WIDTH_PX = 276;


export function fmt(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export const thStyle: React.CSSProperties = {
  backgroundColor: GREEN,
  color: '#111',
  padding: '15px 12px',
  fontSize: '13px',
  fontFamily: "'Montserrat', sans-serif",
  fontWeight: 700,
  textTransform: 'uppercase',
};

export const tdStyle: React.CSSProperties = {
  padding: '20px 12px',
  fontSize: '15px',
  color: '#333',
  verticalAlign: 'middle',
};

export const totalsRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '8px 0',
  fontSize: '14px',
  color: '#555',
  borderBottom: '1px solid #fafafa',
};
