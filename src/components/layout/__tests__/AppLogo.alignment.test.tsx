/**
 * Regressão visual (estrutural) — garante que "Store System" fica alinhado
 * à direita, no mesmo eixo de "Gifts", em TODAS as variants do AppLogo.
 *
 * JSDOM não computa layout real, então o teste valida os invariantes que
 * produzem o alinhamento no browser:
 *   1. o span de "Store System" tem `text-right` em toda variant;
 *   2. está dentro de um container `flex flex-col` (que estica os filhos
 *      à largura de "Promo Gifts", fazendo o texto encostar no `.right`);
 *   3. a classe `text-right` NÃO depende de breakpoint (sem prefixo
 *      `sm:`/`md:`) — cobre mobile.
 *
 * A validação geométrica real (getBoundingClientRect) roda no gate
 * Playwright/preview; este teste apenas trava a estrutura CSS.
 */
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AppLogo } from '@/components/layout/AppLogo';

const VARIANTS = ['brand', 'dark', 'light', 'sidebar'] as const;

describe('AppLogo — alinhamento do subtítulo "Store System"', () => {
  it.each(VARIANTS)(
    'variant=%s: "Store System" tem text-right dentro de flex flex-col',
    (variant) => {
      const { getByText } = render(<AppLogo variant={variant} />);
      const store = getByText('Store System');

      // 1. classe text-right presente (sem prefixo de breakpoint)
      expect(store.className).toContain('text-right');
      expect(store.className).not.toMatch(/\b(sm|md|lg|xl):text-right\b/);

      // 2. container pai é flex-col (base do alinhamento)
      const column = store.parentElement;
      expect(column?.className).toContain('flex');
      expect(column?.className).toContain('flex-col');

      // 3. "Promo Gifts" está no mesmo container
      const brand = getByText('Promo Gifts');
      expect(brand.parentElement).toBe(column);
    },
  );

  it('não renderiza subtítulo quando showText=false', () => {
    const { queryByText } = render(<AppLogo showText={false} />);
    expect(queryByText('Store System')).toBeNull();
  });
});
