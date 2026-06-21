import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import * as scrollLock from '@/lib/dom/scroll-lock';
import { RootInteractivityGuard } from '@/components/system/RootInteractivityGuard';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';

// Mock scroll lock functions to track calls
vi.mock('@/lib/dom/scroll-lock', async () => {
  const actual = await vi.importActual<typeof scrollLock>('@/lib/dom/scroll-lock');
  return {
    ...actual,
    forceRootInteractive: vi.fn(actual.forceRootInteractive),
    hasOpenOverlay: vi.fn(actual.hasOpenOverlay),
    isRootInert: vi.fn(actual.isRootInert),
  };
});

describe('Overlay Interactivity & RootInteractivityGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.style.pointerEvents = '';
    document.documentElement.style.pointerEvents = '';

    // Ensure root element exists for the guard
    let root = document.getElementById('root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'root';
      document.body.appendChild(root);
    }

    // Default mock behavior: inert if body is none and no overlay open
    vi.mocked(scrollLock.isRootInert).mockImplementation(() => {
      const bodyPE = document.body.style.pointerEvents;
      const htmlPE = document.documentElement.style.pointerEvents;
      const hasOverlay = vi.mocked(scrollLock.hasOpenOverlay)();
      return (bodyPE === 'none' || htmlPE === 'none') && !hasOverlay;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('RootInteractivityGuard recovers from stuck pointer-events: none', async () => {
    vi.useFakeTimers();
    vi.mocked(scrollLock.hasOpenOverlay).mockReturnValue(false);

    render(<RootInteractivityGuard />);

    // Simulate a stuck pointer-events: none on body
    document.body.style.pointerEvents = 'none';

    // Advance timers to trigger the guard's interval check
    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(scrollLock.forceRootInteractive).toHaveBeenCalled();
  });

  it('restores interactivity when navigating quickly between routes', async () => {
    vi.useFakeTimers();

    const TestApp = () => {
      const navigate = useNavigate();
      return (
        <Routes>
          <Route
            path="/"
            element={
              <div>
                <button onClick={() => navigate('/two')}>Go to 2</button>
              </div>
            }
          />
          <Route path="/two" element={<div>Page 2</div>} />
        </Routes>
      );
    };

    render(
      <MemoryRouter initialEntries={['/']}>
        <RootInteractivityGuard />
        <TestApp />
      </MemoryRouter>,
    );

    // Initial state: No modal open, but something left pointer-events: none
    vi.mocked(scrollLock.hasOpenOverlay).mockReturnValue(false);
    document.body.style.pointerEvents = 'none';

    // Click navigation
    const btn = screen.getByText('Go to 2');
    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => {
      btn.click();
    });

    // After navigation, guard should run its interval check
    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => {
      vi.advanceTimersByTime(1000); // 1000ms covers all initial checks and interval
    });

    expect(scrollLock.forceRootInteractive).toHaveBeenCalled();
  });

  it('does NOT restore interactivity when an overlay is legitimately open', async () => {
    vi.useFakeTimers();
    vi.mocked(scrollLock.hasOpenOverlay).mockReturnValue(true);

    render(<RootInteractivityGuard />);

    document.body.style.pointerEvents = 'none';

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    // Should NOT call recovery if overlay is open
    expect(scrollLock.forceRootInteractive).not.toHaveBeenCalled();
  });
});
