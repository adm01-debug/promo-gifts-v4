/**
 * theme-presets-css-vars-patch.ts
 * BUG-04 Fix — documentação do patch aplicado a CSS_VARS_TO_APPLY
 *
 * PATCH STATUS: APPLIED (2026-05-25). Os tokens orange-* foram adicionados
 * ao array CSS_VARS_TO_APPLY em src/lib/theme-presets.ts:162-169.
 *
 * Contexto histórico: sem esses 5 tokens, applyThemePreset() nunca atualizava
 * --orange-* ao trocar de preset. Componentes usando hsl(var(--orange)) ficavam
 * travados no valor padrão (217 91% 60% = azul).
 *
 * O validateBug04Patch() abaixo serve como sentinel de regressão —
 * importável em testes para garantir que o patch não seja revertido.
 *
 * @see docs/design-system-audit-2026-05-25.md BUG-04
 */
export const BUG_04_PATCH = {
  file: 'src/lib/theme-presets.ts',
  arrayName: 'CSS_VARS_TO_APPLY',
  tokensToAdd: [
    'orange',
    'orange-hover',
    'orange-active',
    'orange-glow',
    'orange-foreground',
  ] as const,
  insertAfter: 'chart-1',
  reason: 'applyThemePreset() nunca atualizava --orange-* tokens ao trocar de preset',
  appliedAt: '2026-05-25',
  status: 'APPLIED' as const,
};

/**
 * Validator — chame isso em testes para garantir que o patch foi aplicado.
 * @example
 *   import { CSS_VARS_TO_APPLY } from './theme-presets';
 *   import { validateBug04Patch } from './theme-presets-css-vars-patch';
 *   expect(validateBug04Patch(CSS_VARS_TO_APPLY)).toBe(true);
 */
export function validateBug04Patch(cssVarsToApply: readonly string[]): boolean {
  return BUG_04_PATCH.tokensToAdd.every((token) => cssVarsToApply.includes(token));
}
