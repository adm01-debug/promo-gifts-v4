import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React, { useState, useEffect } from 'react';
import * as scrollLock from '@/lib/dom/scroll-lock';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { RootInteractivityGuard } from '@/components/system/RootInteractivityGuard';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';

// Mock scroll lock functions to track calls
vi.mock('@/lib/dom/scroll-lock', async () => {
  const actual = await vi.importActual('@/lib/dom/scroll-lock');
  return {
    ...actual as any,
    releaseScrollLockIfIdle: vi.fn(actual.releaseScrollLockIfIdle as any),
    forceRootInteractive: vi.fn(actual.forceRootInteractive as any),
    hasOpenOverlay: vi.fn(actual.hasOpenOverlay as any),
    isRootInert: vi.fn(actual.isRootInert as any),
  };
});

describe('Overlay Interactivity & RootInteractivityGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.style.pointerEvents = '';
    document.documentElement.style.pointerEvents = '';
    
    // Setup root element for the guard
    if (!document.getElementById('root')) {
      const root = document.createElement('div');
      root.id = 'root';
      document.body.appendChild(root);
    }
    
    (scrollLock.isRootInert as any).mockImplementation(() => {
      return document.body.style.pointerEvents === 'none' && !(scrollLock.hasOpenOverlay as any)();
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    const root = document.getElementById('root');
    if (root) root.remove();
  });

  it('RootInteractivityGuard recovers from stuck pointer-events: none', async () => {
    vi.useFakeTimers();
    (scrollLock.hasOpenOverlay as any).mockReturnValue(false);
    
    render(<RootInteractivityGuard />);

    // Simulate a stuck pointer-events: none on body
    document.body.style.pointerEvents = 'none';
    
    // Advance timers to trigger the guard's interval check
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(scrollLock.forceRootInteractive).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('restores interactivity when navigating quickly between routes', async () => {
    vi.useFakeTimers();
    
    const TestApp = () => {
      const navigate = useNavigate();
      return (
        <Routes>
          <Route path="/" element={
            <div>
              <Dialog open={true}>
                <DialogContent>Modal 1</DialogContent>
              </Dialog>
              <button onClick={() => navigate('/two')}>Go to 2</button>
            </div>
          } />
          <Route path="/two" element={<div>Page 2</div>} />
        </Routes>
      );
    };

    render(
      <MemoryRouter initialEntries={['/']}>
        <RootInteractivityGuard />
        <TestApp />
      </MemoryRouter>
    );

    // Initial state: Modal is open, pointer-events: none might be applied by Radix
    document.body.style.pointerEvents = 'none';
    (scrollLock.hasOpenOverlay as any).mockReturnValue(true);

    // Navigate to Page 2
    const btn = screen.getByText('Go to 2');
    await act(async () => {
      btn.click();
    });

    // On Page 2, Modal 1 is unmounted. Radix SHOULD cleanup but if it doesn't:
    (scrollLock.hasOpenOverlay as any).mockReturnValue(false);
    
    // Guard should catch it
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(scrollLock.forceRootInteractive).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('does NOT restore interactivity when an overlay is legitimately open', async () => {
    vi.useFakeTimers();
    (scrollLock.hasOpenOverlay as any).mockReturnValue(true);
    
    render(<RootInteractivityGuard />);

    document.body.style.pointerEvents = 'none';
    
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    // Should NOT call recovery if overlay is open
    expect(scrollLock.forceRootInteractive).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
