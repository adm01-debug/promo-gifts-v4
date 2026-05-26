/**
 * theme-presets-css-vars-patch.ts
 * BUG-04 Fix — documentação do patch aplicado a CSS_VARS_TO_APPLY
 *
 * O array CSS_VARS_TO_APPLY em src/lib/theme-presets.ts deve incluir
 * os tokens orange-* para que applyThemePreset() os atualize ao trocar de preset.
 *
 * APLICAR MANUALMENTE em src/lib/theme-presets.ts:
 * Localizar o final do array CSS_VARS_TO_APPLY (linha com 'chart-1',)
 * e adicionar as 5 linhas abaixo ANTES do fechamento ];
 *
 * ```ts
 * export const CSS_VARS_TO_APPLY: (keyof ThemeModeColors)[] = [
 *   // ... tokens existentes ...
 *   'chart-1',
 *   // BUG-04 fix — @see docs/design-system-audit-2026-05-25.md
 *   'orange',
 *   'orange-hover',
 *   'orange-active',
 *   'orange-glow',
 *   'orange-foreground',
 * ];
 * ```
 *
 * Sem esses 5 tokens, applyThemePreset() nunca atualiza --orange-*
 * ao trocar de preset. Componentes usando hsl(var(--orange)) ficam
 * travados no valor padrão (217 91% 60% = azul).
 *
 * @see docs/design-system-audit-2026-05-25.md BUG-04
 */
export const BUG_04_PATCH = {
  file: 'src/lib/theme-presets.ts',
  arrayName: 'CSS_VARS_TO_APPLY',
  tokensToAdd: ['orange', 'orange-hover', 'orange-active', 'orange-glow', 'orange-foreground'] as const,
  insertAfter: 'chart-1',
  reason: 'applyThemePreset() nunca atualizava --orange-* tokens ao trocar de preset',
  appliedAt: '2026-05-25',
  status: 'PENDING_MANUAL_APPLY' as const,
};

/**
 * Validator — chame isso em testes para garantir que o patch foi aplicado.
 * @example
 *   import { CSS_VARS_TO_APPLY } from './theme-presets';
 *   import { validateBug04Patch } from './theme-presets-css-vars-patch';
 *   expect(validateBug04Patch(CSS_VARS_TO_APPLY)).toBe(true);
 */
export function validateBug04Patch(cssVarsToApply: readonly string[]): boolean {
  return BUG_04_PATCH.tokensToAdd.every(token => cssVarsToApply.includes(token));
}
