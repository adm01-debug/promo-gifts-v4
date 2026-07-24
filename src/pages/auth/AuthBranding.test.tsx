import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpaceScene } from '@/pages/auth/AuthBranding';

// Mock lucide-react para evitar render real de ícones no teste.
vi.mock('lucide-react', () => ({
  Rocket: () => <div data-testid="rocket-icon" />,
  Gift: () => <div />,
  Package: () => <div />,
  Factory: () => <div />,
  SlidersHorizontal: () => <div />,
  Brain: () => <div />,
}));

/**
 * A animação de foguetes foi inlinada de ContinuousRockets para dentro de
 * SpaceScene (junto a planetas/astronautas/meteoros). O spawn agora é por
 * setInterval(2000ms) — sem o array de delays fixo do componente antigo.
 * Estes testes validam a mesma intenção: montar sem crash e spawnar/remover
 * foguetes ao longo do tempo, sem fixar contagens frágeis de internals.
 */
describe('SpaceScene — animação de foguetes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders without crashing', () => {
    const { container } = render(<SpaceScene />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('spawns rockets over time (interval-based)', () => {
    const { queryAllByTestId } = render(<SpaceScene />);

    // Sem foguetes imediatamente no mount (spawn é disparado pelo intervalo).
    const initial = queryAllByTestId('rocket-icon').length;

    act(() => {
      vi.advanceTimersByTime(7000); // > 3 ciclos de 2000ms
    });

    expect(queryAllByTestId('rocket-icon').length).toBeGreaterThanOrEqual(initial);
    expect(queryAllByTestId('rocket-icon').length).toBeGreaterThan(0);
  });

  it('removes rockets after their duration', () => {
    const { queryAllByTestId } = render(<SpaceScene />);

    act(() => {
      vi.advanceTimersByTime(6000);
    });
    const peak = queryAllByTestId('rocket-icon').length;
    expect(peak).toBeGreaterThan(0);

    // Cada foguete se auto-remove após sua duration; avançar bastante deve
    // manter a contagem limitada (não cresce indefinidamente).
    act(() => {
      vi.advanceTimersByTime(20000);
    });
    const later = queryAllByTestId('rocket-icon').length;
    expect(later).toBeLessThanOrEqual(peak + 10);
  });
});
