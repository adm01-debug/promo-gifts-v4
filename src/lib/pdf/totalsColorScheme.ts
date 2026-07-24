/**
 * SSOT do esquema de cores dos badges "Você economiza" e "Total"
 * usados por `ProposalTotals` (exportação) e `TotalsSection`
 * (`ProposalSections`, PDF interno).
 *
 * Flag A/B controlada por `VITE_PROPOSAL_TOTALS_SCHEME`:
 *   - "discount-hero" (default, teste atual) → desconto rouba a cena
 *   - "total-hero"                            → esquema histórico
 *
 * PDFs são renderizados sempre em fundo branco pelo pipeline html→pdf;
 * NÃO existe dark mode aqui. Não adicionar `.dark` overrides.
 *
 * Contraste (WCAG AA / body 14px+ passa em 4.5:1):
 *   - #0a0a0a sobre #00c853  → ~16.9:1  ✅ AAA
 *   - #1b5e20 sobre #f1f8e9  → ~9.1:1   ✅ AAA
 *   - #2e7d32 sobre #f1f8e9  → ~5.9:1   ✅ AA
 * Fonte: verificado com relative luminance manual + qa/reports/pdf-contrast-report.md.
 */

export type TotalsColorScheme = 'discount-hero' | 'total-hero';

export interface TotalsBadgeStyle {
  /** Background sólido do bloco */
  bg: string;
  /** Cor de texto principal (label + valor) */
  fg: string;
  /** Borda opcional (usado no estilo "suave") */
  border?: string;
}

export interface TotalsColorTokens {
  scheme: TotalsColorScheme;
  discount: TotalsBadgeStyle;
  total: TotalsBadgeStyle;
}

const SOLID: TotalsBadgeStyle = { bg: '#00c853', fg: '#0a0a0a' };
const SOFT: TotalsBadgeStyle = { bg: '#f1f8e9', fg: '#1b5e20', border: '#c8e6c9' };

const SCHEMES: Record<TotalsColorScheme, { discount: TotalsBadgeStyle; total: TotalsBadgeStyle }> = {
  'discount-hero': { discount: SOLID, total: SOFT },
  'total-hero': { discount: SOFT, total: SOLID },
};

function readSchemeFromEnv(): TotalsColorScheme {
  try {
    const raw = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
      ?.VITE_PROPOSAL_TOTALS_SCHEME;
    if (raw === 'total-hero' || raw === 'discount-hero') return raw;
  } catch {
    /* SSR/test env sem import.meta.env — cai no default */
  }
  return 'discount-hero';
}

export function getTotalsColorTokens(override?: TotalsColorScheme): TotalsColorTokens {
  const scheme = override ?? readSchemeFromEnv();
  return { scheme, ...SCHEMES[scheme] };
}

/** Marcador para embutir no PDF (data-attr) — permite auditar qual variante foi usada. */
export function totalsSchemeMarker(scheme: TotalsColorScheme): Record<string, string> {
  return { 'data-totals-scheme': scheme };
}
