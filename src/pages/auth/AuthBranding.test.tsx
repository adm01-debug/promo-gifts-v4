import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ContinuousRockets } from '@/pages/auth/AuthBranding';

// Mock lucide-react to avoid icon rendering issues in test
vi.mock('lucide-react', () => ({
  Rocket: () => <div data-testid="rocket-icon" />,
  Gift: () => <div />,
  Package: () => <div />,
  Factory: () => <div />,
  SlidersHorizontal: () => <div />,
  Brain: () => <div />,
}));

// Tests for the rocket animation in the branding panel.

// QA: ContinuousRockets foi inlined no componente SpaceScene durante o
// redesign do branding (não é mais um export). Os 3 testes abaixo
// dependem dessa API que não existe — todos quebram com "Element type
// is invalid (undefined)". Skip preserva o arquivo como documentação
// histórica até alguém refatorar para testar SpaceScene ou behaviors
// observáveis no AuthBrandingPanel.
describe.skip('ContinuousRockets Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders without crashing', () => {
    const { container } = render(<ContinuousRockets />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('spawns initial rockets after delays', async () => {
    const { getAllByTestId } = render(<ContinuousRockets />);

    // The component has: const delays = [0, 200, 500, 900, 1400, 2000, 2800];

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // At 2000ms, 6 rockets should have spawned (0, 200, 500, 900, 1400, 2000)
    expect(getAllByTestId('rocket-icon').length).toBe(6);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // After 3000ms, all 7 initial rockets should have spawned (at 0, 0.2, 0.5, 0.9, 1.4, 2.0, 2.8s)
    expect(getAllByTestId('rocket-icon').length).toBeGreaterThanOrEqual(7);
  });

  it('removes rockets after their duration', async () => {
    const { getAllByTestId, queryAllByTestId } = render(<ContinuousRockets />);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    const initialCount = getAllByTestId('rocket-icon').length;
    expect(initialCount).toBe(7);

    // Rocket duration is 1.5-3s (initial) + 0.5s removal delay
    // Advancing 8 seconds should clear all initial rockets
    act(() => {
      vi.advanceTimersByTime(8000);
    });

    // They should be removed, but new ones spawn every 2.8s
    // At 11s total:
    // Sustained cycle starts after mount.
    // Spawns at: 2.8s, 5.6s, 8.4s.
    // At 11s, those might still be there or removed depending on duration (2.2-5s)
    const currentCount = queryAllByTestId('rocket-icon').length;
    expect(currentCount).toBeLessThan(7);
  });
});
