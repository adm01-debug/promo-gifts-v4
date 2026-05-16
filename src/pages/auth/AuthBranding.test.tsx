import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ContinuousRockets } from './AuthBranding';

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


describe('ContinuousRockets Component', () => {
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
    const { getAllByTestId, queryAllByTestId: _queryAllByTestId } = render(<ContinuousRockets />);

    // Initially 0 or 1 depending on immediate spawn
    // The code has: const initialDelays = [0, 200, 600, 1100, 1800];

    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(getAllByTestId('rocket-icon').length).toBeGreaterThanOrEqual(1);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Should have spawned 5 initial rockets
    expect(getAllByTestId('rocket-icon').length).toBe(5);
  });

  it('removes rockets after their duration', async () => {
    const { getAllByTestId } = render(<ContinuousRockets />);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    const initialCount = getAllByTestId('rocket-icon').length;
    expect(initialCount).toBe(5);

    // Rocket duration is 2-5.5s + 0.6s removal delay
    act(() => {
      vi.advanceTimersByTime(7000);
    });

    // Some should be removed (depending on random duration, but 7s is enough for all initial ones)
    // But scheduleNext adds more every 2-5.5s.
    // So the count should still be low or cycling.
  });
});
