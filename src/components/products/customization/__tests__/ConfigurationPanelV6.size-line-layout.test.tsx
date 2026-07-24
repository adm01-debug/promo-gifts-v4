/**
 * Layout responsivo da linha "Tamanho da gravação".
 *
 * Garante que o texto de orientação ("Máx. X × Y cm") fica na MESMA linha
 * do rótulo em 360px (mobile) e 768px (tablet), sem quebrar em segunda linha
 * inesperada por conta do `flex-wrap`.
 *
 * jsdom não roda layout real: simulamos larguras via mock de
 * `getBoundingClientRect` em cada filho (baseado em conteúdo textual) e
 * validamos que a soma cabe na largura do container. Se um dev remover o
 * `flex-wrap` OU inflar o texto além do container, o teste falha e força
 * revisão consciente do layout.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { ConfigurationPanelV6 } from '../ConfigurationPanelV6';
import type { TechniqueOption } from '@/types/customization';

vi.mock('@/hooks/simulation', () => ({
  useCustomizationPriceReactive: () => ({ price: null, loading: false, error: null }),
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
  technique_name: 'silk',
  name: 'silk',
  codigo_tabela: 'SK-001',
  grupo_tecnica: 'Silk',
  usa_dimensao: true,
  cobra_por_cor: false,
  max_cores: 1,
  efetiva_largura_max: 10,
  efetiva_altura_max: 10,
} as unknown as TechniqueOption;

// Heurística: 7px por caractere + 14px do ícone + 2 gaps de 6px.
// Não é layout real, mas suficiente para detectar overflow grosseiro.
const CHAR_PX = 7;
const ICON_PX = 14;
const GAP_PX = 6;

function estimateChildWidth(el: Element): number {
  if (el.tagName === 'svg') return ICON_PX;
  return (el.textContent?.length ?? 0) * CHAR_PX;
}

function findSizeRow(container: HTMLElement): HTMLElement {
  const label = Array.from(container.querySelectorAll('span')).find(
    (s) => s.textContent?.trim() === 'Tamanho da gravação',
  );
  if (!label) throw new Error('Linha "Tamanho da gravação" não encontrada');
  return label.parentElement!;
}

function assertFitsOnOneLine(row: HTMLElement, containerWidth: number) {
  const children = Array.from(row.children);
  const total =
    children.reduce((sum, c) => sum + estimateChildWidth(c), 0) +
    Math.max(0, children.length - 1) * GAP_PX;
  expect(total, `soma estimada (${total}px) deve caber em ${containerWidth}px`).toBeLessThanOrEqual(
    containerWidth,
  );
}

describe('ConfigurationPanelV6 — layout da linha "Tamanho da gravação"', () => {
  const originalInnerWidth = window.innerWidth;

  beforeEach(() => {
    // Estabiliza matchMedia para jsdom.
    window.matchMedia ||= ((q: string) => ({
      matches: false,
      media: q,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, configurable: true });
  });

  it('mantém rótulo + orientação na mesma linha em 360px (mobile)', () => {
    Object.defineProperty(window, 'innerWidth', { value: 360, configurable: true });
    const { container } = render(
      <ConfigurationPanelV6 technique={technique} quantity={10} onPriceCalculated={() => {}} />,
    );
    const row = findSizeRow(container);

    // Deve continuar sendo um flex-wrap (fallback controlado) — se removerem,
    // o layout quebra em telas muito estreitas.
    expect(row.className).toMatch(/flex/);
    expect(row.className).toMatch(/items-center/);
    expect(row.className).toMatch(/flex-wrap/);

    // Padding lateral do painel + inputs adjacentes ≈ 32px. Usamos 328 como
    // largura útil segura em 360px.
    assertFitsOnOneLine(row, 328);
  });

  it('mantém rótulo + orientação na mesma linha em 768px (tablet)', () => {
    Object.defineProperty(window, 'innerWidth', { value: 768, configurable: true });
    const { container } = render(
      <ConfigurationPanelV6 technique={technique} quantity={10} onPriceCalculated={() => {}} />,
    );
    const row = findSizeRow(container);

    // Em tablet o container ainda pode ser estreito (painel lateral): 480px é
    // um piso conservador. Se ainda assim couber, o layout está saudável.
    assertFitsOnOneLine(row, 480);
  });

  it('estrutura: ícone + rótulo + orientação são irmãos diretos (sem <p> quebrando linha)', () => {
    const { container } = render(
      <ConfigurationPanelV6 technique={technique} quantity={10} onPriceCalculated={() => {}} />,
    );
    const row = findSizeRow(container);
    const children = Array.from(row.children);

    // Regressão explícita da mudança pedida: a orientação NÃO pode voltar a
    // um <p> separado — precisa continuar como irmão do rótulo.
    expect(children.length).toBeGreaterThanOrEqual(3);
    expect(row.querySelector('p')).toBeNull();
    expect(
      children.some((c) => c.textContent?.includes('Máx.') && c.textContent?.includes('cm')),
    ).toBe(true);
  });
});
