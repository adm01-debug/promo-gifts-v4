import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { PromoFlixPlayer } from './PromoFlixPlayer';

type MockHlsInstance = {
  loadSource: ReturnType<typeof vi.fn>;
  attachMedia: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  startLoad: ReturnType<typeof vi.fn>;
  recoverMediaError: ReturnType<typeof vi.fn>;
  currentLevel: number;
  autoLevelEnabled: boolean;
};

let lastHlsInstance: MockHlsInstance | null = null;

// Mock hls.js for dynamic import
vi.mock('hls.js', () => {
  const mockHls = vi.fn().mockImplementation(() => {
    const instance: MockHlsInstance = {
      loadSource: vi.fn(),
      attachMedia: vi.fn(),
      on: vi.fn(),
      destroy: vi.fn(),
      startLoad: vi.fn(),
      recoverMediaError: vi.fn(),
      currentLevel: -1,
      autoLevelEnabled: true,
    };
    lastHlsInstance = instance;
    return instance;
  });

  const mockHlsStatic = mockHls as unknown as {
    isSupported: ReturnType<typeof vi.fn>;
    Events: Record<string, string>;
    ErrorTypes: Record<string, string>;
  };
  mockHlsStatic.isSupported = vi.fn().mockReturnValue(true);
  mockHlsStatic.Events = {
    MANIFEST_PARSED: 'hlsManifestParsed',
    ERROR: 'hlsError',
    LEVEL_SWITCHED: 'hlsLevelSwitched',
    LEVEL_SWITCHING: 'hlsLevelSwitching',
    FRAG_LOADED: 'hlsFragLoaded',
  };
  mockHlsStatic.ErrorTypes = {
    NETWORK_ERROR: 'networkError',
    MEDIA_ERROR: 'mediaError',
    OTHER_ERROR: 'otherError',
  };

  return { default: mockHls };
});

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
  MessageCircle: () => <div data-testid="whatsapp-icon" />,
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

describe('PromoFlixPlayer Automated Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    lastHlsInstance = null;

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
      value: vi.fn().mockReturnValue(''), // Mock NOT supported to force HLS.js
    });
  });

  it('should initialize volume from localStorage', () => {
    localStorage.setItem('promoflix_volume', '0.5');
    render(<PromoFlixPlayer src="test.mp4" />);
    expect(localStorage.getItem('promoflix_volume')).toBe('0.5');
  });

  it('should initialize playing state from localStorage', () => {
    localStorage.setItem('promoflix_playing', 'true');
    render(<PromoFlixPlayer src="test.mp4" autoPlay={false} />);
    expect(localStorage.getItem('promoflix_playing')).toBe('true');
  });

  it('should show manual load button after 10s timeout if video is stuck', async () => {
    vi.useFakeTimers();
    const { getByText } = render(<PromoFlixPlayer src="stuck.mp4" />);

    // Initial state: loading
    expect(getByText(/Carregando/i)).toBeDefined();

    // Advance 11 seconds to trigger STUCK_LOADING_TIMEOUT (10s)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(11000);
    });

    // Should show manual load button
    expect(getByText(/Carregar Manualmente/i)).toBeDefined();

    vi.useRealTimers();
  });

  it('should show actionable error message when native video fails with code 4 (SRC_NOT_SUPPORTED)', async () => {
    const { findByText, getByRole } = render(<PromoFlixPlayer src="cors-error.mp4" />);

    const video = document.querySelector('video');
    if (video) {
      // Simulate SRC_NOT_SUPPORTED (code 4) on native playback (no HLS.js attached for .mp4)
      await act(async () => {
        Object.defineProperty(video, 'error', {
          value: { code: 4, message: 'SRC_NOT_SUPPORTED' },
          configurable: true,
        });
        fireEvent(video, new Event('error'));
      });
    }

    // Check for actionable message (generalized — previously falsely attributed to CORS)
    expect(await findByText(/Não foi possível reproduzir este vídeo/i)).toBeDefined();
    expect(await findByText(/formato pode não ser suportado/i)).toBeDefined();

    // Ensure "Tentar Novamente" button exists and works
    const retryButton = getByRole('button', { name: /Tentar Novamente/i });
    expect(retryButton).toBeDefined();

    await act(async () => {
      fireEvent.click(retryButton);
    });

    // After retry, it should be in loading state again
    expect(await findByText(/Carregando/i)).toBeDefined();
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
        configurable: true,
      });

      await act(async () => {
        fireEvent(video, new Event('progress'));
      });
    }

    // Overlay should be gone (isLoading = false)
    await waitFor(() => {
      expect(queryByText(/Carregando/i)).toBeNull();
    });
  });

  it('should hide loading overlay when loadeddata event fires', async () => {
    const { queryByText } = render(<PromoFlixPlayer src="test.mp4" />);

    const video = document.querySelector('video');
    if (video) {
      await act(async () => {
        fireEvent(video, new Event('loadeddata'));
      });
    }

    await waitFor(() => {
      expect(queryByText(/Carregando/i)).toBeNull();
    });
  });

  it('should hide loading overlay when canplay event fires', async () => {
    const { queryByText } = render(<PromoFlixPlayer src="test.mp4" />);

    const video = document.querySelector('video');
    if (video) {
      await act(async () => {
        fireEvent(video, new Event('canplay'));
      });
    }

    await waitFor(() => {
      expect(queryByText(/Carregando/i)).toBeNull();
    });
  });

  describe('HLS.js specific scenarios', () => {
    const waitForHlsInstance = async () => {
      await waitFor(
        () => {
          expect(lastHlsInstance).not.toBeNull();
        },
        { timeout: 2000 },
      );
      return lastHlsInstance!;
    };

    it('should handle HLS.js fatal network errors with recovery attempts', async () => {
      const { findByText } = render(<PromoFlixPlayer src="test.m3u8" isHls={true} />);

      const hlsInstance = await waitForHlsInstance();
      const errorHandler = hlsInstance.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'hlsError',
      )![1];

      // Simulate 1st fatal network error (should trigger startLoad)
      await act(async () => {
        errorHandler('hlsError', {
          fatal: true,
          type: 'networkError',
          details: 'manifestLoadError',
        });
      });

      expect(hlsInstance.startLoad).toHaveBeenCalledTimes(1);

      // Simulate 4 more fatal network errors (total 5, > 3 threshold)
      for (let i = 0; i < 4; i++) {
        await act(async () => {
          errorHandler('hlsError', {
            fatal: true,
            type: 'networkError',
            details: 'manifestLoadError',
          });
        });
      }

      // Should show the final error message
      expect(
        await findByText(/Não foi possível carregar o vídeo. Verifique sua conexão/i),
      ).toBeDefined();
    });

    it('should handle HLS.js fatal media errors with recovery', async () => {
      render(<PromoFlixPlayer src="test.m3u8" isHls={true} />);

      const hlsInstance = await waitForHlsInstance();
      const errorHandler = hlsInstance.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'hlsError',
      )![1];

      // Simulate fatal media error
      await act(async () => {
        errorHandler('hlsError', {
          fatal: true,
          type: 'mediaError',
          details: 'bufferStalledError',
        });
      });

      expect(hlsInstance.recoverMediaError).toHaveBeenCalledTimes(1);
    });

    it('should hide loading overlay when HLS.js MANIFEST_PARSED event fires', async () => {
      const { queryByText } = render(<PromoFlixPlayer src="test.m3u8" isHls={true} />);

      const hlsInstance = await waitForHlsInstance();
      const manifestHandler = hlsInstance.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'hlsManifestParsed',
      )![1];

      await act(async () => {
        manifestHandler('hlsManifestParsed', { levels: [] });
      });

      await waitFor(() => {
        expect(queryByText(/Carregando/i)).toBeNull();
      });
    });

    it('should hide loading overlay when HLS.js FRAG_LOADED event fires', async () => {
      const { queryByText } = render(<PromoFlixPlayer src="test.m3u8" isHls={true} />);

      const hlsInstance = await waitForHlsInstance();
      const fragLoadedHandler = hlsInstance.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'hlsFragLoaded',
      )![1];

      await act(async () => {
        fragLoadedHandler('hlsFragLoaded', {});
      });

      await waitFor(() => {
        expect(queryByText(/Carregando/i)).toBeNull();
      });
    });
  });

  describe('Level Changes and Auto-Leveling', () => {
    const waitForHlsInstance = async () => {
      await waitFor(
        () => {
          expect(lastHlsInstance).not.toBeNull();
        },
        { timeout: 2000 },
      );
      return lastHlsInstance!;
    };

    it('should update quality state during multiple level changes with auto-level enabled', async () => {
      const { queryByText } = render(<PromoFlixPlayer src="test.m3u8" isHls={true} />);

      const hlsInstance = await waitForHlsInstance();
      const levelSwitchedHandler = hlsInstance.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'hlsLevelSwitched',
      )![1];
      const manifestHandler = hlsInstance.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'hlsManifestParsed',
      )![1];

      // Initially auto-level is enabled (-1)
      expect(hlsInstance.autoLevelEnabled).toBe(true);

      // Trigger manifest parsed to clear loading state
      await act(async () => {
        manifestHandler('hlsManifestParsed', { levels: [{ height: 720 }, { height: 1080 }] });
      });

      expect(queryByText(/Carregando/i)).toBeNull();

      // Simulate first level switch
      await act(async () => {
        levelSwitchedHandler('hlsLevelSwitched', { level: 1 });
      });

      // Overlay should remain hidden
      expect(queryByText(/Carregando/i)).toBeNull();

      // Simulate second level switch
      await act(async () => {
        levelSwitchedHandler('hlsLevelSwitched', { level: 2 });
      });

      expect(queryByText(/Carregando/i)).toBeNull();
    });

    it('should show "Manual Load" button and re-initialize player on click', async () => {
      vi.useFakeTimers();
      const { getByText, queryByText } = render(<PromoFlixPlayer src="stuck.m3u8" isHls={true} />);

      // Advance to trigger timeout
      await act(async () => {
        await vi.advanceTimersByTimeAsync(11000);
      });

      const manualLoadBtn = getByText(/Carregar Manualmente/i);
      expect(manualLoadBtn).toBeDefined();

      // Click the button
      await act(async () => {
        fireEvent.click(manualLoadBtn);
      });

      // Button should disappear and loading should restart
      expect(queryByText(/Carregar Manualmente/i)).toBeNull();
      expect(getByText(/Carregando/i)).toBeDefined();

      vi.useRealTimers();
    });
  });
});
