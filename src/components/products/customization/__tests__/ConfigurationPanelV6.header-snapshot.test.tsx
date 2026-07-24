/**
 * Snapshot do cabeçalho da gravação confirmada em ConfigurationPanelV6.
 *
 * Garante estabilidade da estrutura DOM em duas etapas:
 *  1. Loading → skeleton animate-pulse presente, sem título.
 *  2. Loaded → skeleton removido, título formatado exibido.
 *
 * Se a estrutura mudar (ex.: perder o wrapper que sustenta a altura durante
 * a transição), o snapshot quebra e força revisão consciente para evitar
 * regressão de "piscada" no cabeçalho.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ConfigurationPanelV6 } from '../ConfigurationPanelV6';
import type { TechniqueOption } from '@/types/customization';

const hookState: { price: unknown; loading: boolean; error: unknown } = {
  price: null,
  loading: false,
  error: null,
};

vi.mock('@/hooks/simulation', () => ({
  useCustomizationPriceReactive: () => hookState,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
    auth: { getUser: async () => ({ data: { user: null } }) },
    from: () => ({
      // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
      // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
      upsert: async () => ({ error: null }),
    }),
  },
}));

const technique = {
  technique_id: 'tec-1',
  technique_name: 'fiber laser',
  name: 'fiber laser',
  codigo_tabela: 'FL-001',
  grupo_tecnica: 'Laser',
  usa_dimensao: false,
  cobra_por_cor: false,
  max_cores: 1,
  efetiva_largura_max: 0,
  efetiva_altura_max: 0,
} as unknown as TechniqueOption;

function renderHeader() {
  const utils = render(
    <ConfigurationPanelV6
      technique={technique}
      quantity={10}
      isConfirmed
      onPriceCalculated={() => {}}
    />,
  );
  const header = utils.getByTestId('customization-confirmed-header');
  return { ...utils, header };
}

describe('ConfigurationPanelV6 — snapshot do cabeçalho', () => {
  it('snapshot: estado LOADING (skeleton visível, sem título)', () => {
    hookState.price = null;
    hookState.loading = true;

    const { header } = renderHeader();

    // Skeleton presente com animate-pulse e largura fixa.
    const skeleton = header.querySelector('[data-testid="customization-confirmed-skeleton"]');
    expect(skeleton).not.toBeNull();
    expect(skeleton?.className).toMatch(/animate-pulse/);
    expect(skeleton?.className).toMatch(/w-24/);

    // Título ainda não renderizado.
    expect(header.querySelector('[data-testid="customization-confirmed-title"]')).toBeNull();

    expect(header.outerHTML).toMatchInlineSnapshot(
      `"<p class="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-foreground" data-testid="customization-confirmed-header"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg><span aria-hidden="true" data-testid="customization-confirmed-skeleton" class="inline-block h-3.5 w-24 animate-pulse rounded bg-muted"></span></p>"`,
    );
  });

  it('snapshot: estado LOADED (título formatado, skeleton ausente)', () => {
    hookState.price = { nome_tabela: 'FIBER LASER | PLANA' };
    hookState.loading = false;

    const { header } = renderHeader();

    // Skeleton ausente.
    expect(
      header.querySelector('[data-testid="customization-confirmed-skeleton"]'),
    ).toBeNull();

    // Título formatado pelo SSOT.
    const title = header.querySelector('[data-testid="customization-confirmed-title"]');
    expect(title?.textContent).toBe('Fiber Laser | Plana');
    // whitespace-nowrap para evitar quebras estranhas em "X | Y".
    expect(title?.className).toMatch(/whitespace-nowrap/);
    expect(title?.className).toMatch(/truncate/);

    expect(header.outerHTML).toMatchInlineSnapshot(
      `"<p class="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-foreground" data-testid="customization-confirmed-header"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg><span class="truncate whitespace-nowrap" title="Fiber Laser | Plana" data-testid="customization-confirmed-title">Fiber Laser | Plana</span></p>"`,
    );
  });
});
