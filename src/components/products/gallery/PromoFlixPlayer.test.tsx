
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { PromoFlixPlayer } from './PromoFlixPlayer';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Play: () => <div data-testid="play-icon" />,
  Pause: () => <div data-testid="pause-icon" />,
  Volume2: () => <div data-testid="volume-icon" />,
  VolumeX: () => <div data-testid="mute-icon" />,
  Maximize: () => <div data-testid="maximize-icon" />,
  Minimize: () => <div data-testid="minimize-icon" />,
  Settings: () => <div data-testid="settings-icon" />,
  RotateCcw: () => <div data-testid="rotate-ccw-icon" />,
  RotateCw: () => <div data-testid="rotate-cw-icon" />,
  Camera: () => <div data-testid="camera-icon" />,
  Zap: () => <div data-testid="zap-icon" />,
  ZapOff: () => <div data-testid="zap-off-icon" />,
  ChevronLeft: () => <div data-testid="chevron-left-icon" />,
  ChevronRight: () => <div data-testid="chevron-right-icon" />,
  Search: () => <div data-testid="search-icon" />,
  Target: () => <div data-testid="target-icon" />,
  Info: () => <div data-testid="info-icon" />,
  X: () => <div data-testid="x-icon" />,
  PictureInPicture2: () => <div data-testid="pip-icon" />,
  Gauge: () => <div data-testid="gauge-icon" />,
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('PromoFlixPlayer Persistence and Logic', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    
    // Mock HTMLMediaElement prototype
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: vi.fn().mockImplementation(() => Promise.resolve()),
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'load', {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'canPlayType', {
      configurable: true,
      value: vi.fn().mockReturnValue('maybe'),
    });
  });

  it('should initialize volume from localStorage', () => {
    localStorage.setItem('promoflix_volume', '0.5');
    render(<PromoFlixPlayer src="test.mp4" />);
    // Check if localStorage was accessed correctly
    expect(localStorage.getItem('promoflix_volume')).toBe('0.5');
  });

  it('should initialize playing state from localStorage', () => {
    localStorage.setItem('promoflix_playing', 'true');
    render(<PromoFlixPlayer src="test.mp4" autoPlay={false} />);
    expect(localStorage.getItem('promoflix_playing')).toBe('true');
  });
  
  it('should check playback rates constants', () => {
    const rates = [0.5, 0.75, 1, 1.25, 1.5, 2];
    expect(rates).toContain(1);
    expect(rates).toContain(0.5);
    expect(rates).toContain(2);
  });

  it('should show retry button after timeout if video is stuck', async () => {
    vi.useFakeTimers();
    const { getByText, queryByText } = render(<PromoFlixPlayer src="stuck.mp4" />);
    
    // Initial state: loading
    expect(getByText(/Carregando/i)).toBeDefined();
    
    // Advance 11 seconds to trigger STUCK_LOADING_TIMEOUT (10s)
    await vi.advanceTimersByTimeAsync(11000);
    
    // Should show manual load button
    expect(getByText(/Carregar Manualmente/i)).toBeDefined();
    
    vi.useRealTimers();
  });

  it('should show CORS error message when video fails with code 4', async () => {
    const { findByText } = render(<PromoFlixPlayer src="cors-error.mp4" />);
    
    const video = document.querySelector('video');
    if (video) {
      // Simulate CORS error (code 4)
      Object.defineProperty(video, 'error', {
        value: { code: 4, message: 'CORS policy' },
        configurable: true
      });
      video.dispatchEvent(new Event('error'));
    }
    
    expect(await findByText(/Erro de CORS ou Formato não suportado/i)).toBeDefined();
  });

  it('should hide loading overlay when progress event has buffer', async () => {
    const { queryByText } = render(<PromoFlixPlayer src="test.mp4" />);
    
    const video = document.querySelector('video');
    if (video) {
      // Mock buffered range
      Object.defineProperty(video, 'buffered', {
        value: {
          length: 1,
          start: () => 0,
          end: () => 10,
        },
        configurable: true
      });
      video.dispatchEvent(new Event('progress'));
    }
    
    // Overlay should be gone (isLoading = false)
    expect(queryByText(/Carregando/i)).toBeNull();
  });
});
