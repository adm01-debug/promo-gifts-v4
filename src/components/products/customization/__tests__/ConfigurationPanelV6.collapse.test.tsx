/**
 * ConfigurationPanelV6 — contrato de colapso/expansão.
 *
 * Valida as invariantes do fix para o bug "conteúdo abaixo não sobe ao colapsar":
 *  - wrapper externo usa `flex flex-col` + `gap-{0|4}` (não `space-y-4`)
 *  - painel colapsável NÃO recebe atributo `hidden` (regressão B1)
 *  - painel colapsável recebe `aria-hidden` refletindo estado
 *  - alternância 20× via clique é determinística
 *  - reidratação inicial respeita `collapsed=true` vindo das prefs
 *
 * Hooks pesados (Supabase, price reactive) são mockados para isolar o contrato.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';

// Mocks — precisam vir antes do import do componente.
const setCollapsedMock = vi.fn();
let collapsedState = false;
vi.mock('@/hooks/customization/useCustomizationCollapsePrefs', async () => {
  const React = await import('react');
  return {
    useCustomizationCollapsePrefs: () => {
      const [c, setC] = React.useState<boolean>(collapsedState);
      return {
        collapsed: c,
        setCollapsed: (id: string, v: boolean) => {
          setCollapsedMock(id, v);
          collapsedState = v;
          setC(v);
        },
      };
    },
  };
});

vi.mock('@/hooks/simulation', () => ({
  useCustomizationPriceReactive: () => ({
    price: null,
    loading: false,
    error: null,
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
  },
}));

import { ConfigurationPanelV6 } from '../ConfigurationPanelV6';

const technique = {
  technique_id: 'tech-abc',
  technique_name: 'Serigrafia',
  name: 'Serigrafia',
  usa_dimensao: true,
  cobra_por_cor: true,
  efetiva_largura_max: 12,
  efetiva_altura_max: 8,
  grupo_tecnica: 'SERIGRAFIA',
  // deixamos o restante como any — o componente só lê estes campos no caminho testado.
} as unknown as Parameters<typeof ConfigurationPanelV6>[0]['technique'];

function renderPanel(overrides: Partial<Parameters<typeof ConfigurationPanelV6>[0]> = {}) {
  return render(
    <ConfigurationPanelV6
      technique={technique}
      quantity={100}
      onPriceCalculated={() => {}}
      {...overrides}
    />,
  );
}

function getWrapper(): HTMLElement {
  // O card externo é o ancestral do botão toggle que carrega `rounded-lg border`.
  const toggle = screen.getByTestId('customization-collapse-toggle');
  const wrapper = toggle.closest('.rounded-lg.border') as HTMLElement | null;
  if (!wrapper) throw new Error('wrapper do card não encontrado');
  return wrapper;
}

function getPanel(): HTMLElement {
  const toggle = screen.getByTestId('customization-collapse-toggle');
  const id = toggle.getAttribute('aria-controls');
  if (!id) throw new Error('aria-controls ausente no toggle');
  const panel = document.getElementById(id);
  if (!panel) throw new Error(`painel #${id} não encontrado`);
  return panel;
}

beforeEach(() => {
  collapsedState = false;
  setCollapsedMock.mockClear();
  cleanup();
});

describe('ConfigurationPanelV6 — contrato de colapso', () => {
  describe('Grupo A — wrapper externo (contrato visual)', () => {
    it('expandido: contém flex/flex-col/gap-4/p-4/transition-[gap]/motion-reduce', () => {
      collapsedState = false;
      renderPanel();
      const w = getWrapper();
      expect(w.className).toMatch(/\bflex\b/);
      expect(w.className).toMatch(/\bflex-col\b/);
      expect(w.className).toMatch(/\bgap-4\b/);
      expect(w.className).toMatch(/\bp-4\b/);
      expect(w.className).toMatch(/transition-\[gap\]/);
      expect(w.className).toMatch(/duration-300/);
      expect(w.className).toMatch(/motion-reduce:transition-none/);
    });

    it('colapsado: contém gap-0 e NÃO contém gap-4 nem space-y-4', () => {
      collapsedState = true;
      renderPanel();
      const w = getWrapper();
      expect(w.className).toMatch(/\bgap-0\b/);
      expect(w.className).not.toMatch(/\bgap-4\b/);
      expect(w.className).not.toMatch(/\bspace-y-4\b/);
    });
  });

  describe('Grupo B — painel colapsável', () => {
    it('NÃO possui atributo `hidden` em nenhum estado (regressão B1)', () => {
      collapsedState = false;
      const { rerender } = renderPanel();
      expect(getPanel().hasAttribute('hidden')).toBe(false);
      collapsedState = true;
      rerender(
        <ConfigurationPanelV6 technique={technique} quantity={100} onPriceCalculated={() => {}} />,
      );
      expect(getPanel().hasAttribute('hidden')).toBe(false);
    });

    it('aria-hidden reflete o estado colapsado', () => {
      collapsedState = false;
      renderPanel();
      expect(getPanel().getAttribute('aria-hidden')).toBe('false');
      cleanup();
      collapsedState = true;
      renderPanel();
      expect(getPanel().getAttribute('aria-hidden')).toBe('true');
    });

    it('aplica inert quando colapsado para bloquear foco em controles escondidos', () => {
      collapsedState = true;
      renderPanel();
      expect(getPanel().getAttribute('inert')).toBe('');

      cleanup();
      collapsedState = false;
      renderPanel();
      expect(getPanel().hasAttribute('inert')).toBe(false);
    });

    it('mantém role="region", aria-label, min-h-0 e overflow-hidden', () => {
      collapsedState = false;
      renderPanel();
      const p = getPanel();
      expect(p.getAttribute('role')).toBe('region');
      expect(p.getAttribute('aria-label')).toBe('Configurações da gravação');
      const inner = p.firstElementChild as HTMLElement;
      expect(inner.className).toMatch(/min-h-0/);
      expect(inner.className).toMatch(/overflow-hidden/);
    });

    it('classes grid-rows-[0fr]/[1fr] alternam com estado', () => {
      collapsedState = false;
      renderPanel();
      expect(getPanel().className).toMatch(/grid-rows-\[1fr\]/);
      cleanup();
      collapsedState = true;
      renderPanel();
      expect(getPanel().className).toMatch(/grid-rows-\[0fr\]/);
    });
  });

  describe('Grupo C — botão toggle', () => {
    it('aria-expanded é o inverso de collapsed e aria-controls aponta pro painel', () => {
      collapsedState = false;
      renderPanel();
      const toggle = screen.getByTestId('customization-collapse-toggle');
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      const id = toggle.getAttribute('aria-controls')!;
      expect(document.getElementById(id)).toBeTruthy();
    });

    it('aria-label alterna entre Expandir e Recolher', () => {
      collapsedState = true;
      renderPanel();
      expect(screen.getByTestId('customization-collapse-toggle').getAttribute('aria-label')).toBe(
        'Expandir configurações da gravação',
      );
      cleanup();
      collapsedState = false;
      renderPanel();
      expect(screen.getByTestId('customization-collapse-toggle').getAttribute('aria-label')).toBe(
        'Recolher configurações da gravação',
      );
    });
  });

  describe('Grupo D — persistência', () => {
    it('setCollapsed é chamado com (technique_id, boolean) a cada clique', async () => {
      collapsedState = false;
      renderPanel();
      const user = userEvent.setup();
      await user.click(screen.getByTestId('customization-collapse-toggle'));
      expect(setCollapsedMock).toHaveBeenCalledWith('tech-abc', true);
    });

    it('reidrata `collapsed=true` vindo das prefs (Grupo D)', () => {
      collapsedState = true;
      renderPanel();
      expect(getPanel().getAttribute('aria-hidden')).toBe('true');
      expect(getPanel().className).toMatch(/grid-rows-\[0fr\]/);
    });
  });

  describe('Fuzz determinístico — 200 sequências de toggles', () => {
    it('estado final e classes sempre consistentes com paridade dos cliques', () => {
      // PRNG determinística (mulberry32) para reprodutibilidade
      let seed = 0xc0ffee;
      const rand = () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = seed;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };

      for (let sim = 0; sim < 200; sim++) {
        collapsedState = false;
        setCollapsedMock.mockClear();
        renderPanel();
        const toggle = screen.getByTestId('customization-collapse-toggle');
        const clicks = 1 + Math.floor(rand() * 30);
        for (let c = 0; c < clicks; c++) {
          act(() => {
            fireEvent.click(toggle);
          });
        }
        const expectCollapsed = clicks % 2 === 1;
        expect(collapsedState).toBe(expectCollapsed);

        const w = getWrapper();
        const p = getPanel();
        // Invariantes sempre válidas
        expect(p.hasAttribute('hidden')).toBe(false);
        const hasGap0 = /\bgap-0\b/.test(w.className);
        const hasGap4 = /\bgap-4\b/.test(w.className);
        expect(hasGap0 && hasGap4).toBe(false);
        const hasRow0 = p.className.includes('grid-rows-[0fr]');
        const hasRow1 = p.className.includes('grid-rows-[1fr]');
        expect(hasRow0 && hasRow1).toBe(false);
        // Coerência com estado
        expect(hasGap0).toBe(expectCollapsed);
        expect(hasRow0).toBe(expectCollapsed);

        cleanup();
      }
    }, 30_000);
  });
});
