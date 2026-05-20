import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { DevOnlyBridgeOverlay } from '@/components/dev/DevOnlyBridgeOverlay';
import { useDevGate } from '@/hooks/admin/useDevGate';

// Mock do hook useDevGate
vi.mock('@/hooks/admin/useDevGate', () => ({
  useDevGate: vi.fn(),
}));

// Mock do overlay real
vi.mock('@/components/dev/BridgeMetricsOverlay', () => ({
  default: () => <div data-testid="bridge-metrics-overlay-real">Overlay Visible</div>,
}));

describe('DevInfraGate Matrix — Parameterized Permission Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const testCases = [
    { isAllowed: true,  isDev: true,  expectedVisible: true,  desc: 'Usuário Dev com permissão aprovada' },
    { isAllowed: true,  isDev: false, expectedVisible: true,  desc: 'Usuário não-Dev mas com permissão aprovada (ex: override ou Admin)' },
    { isAllowed: false, isDev: true,  expectedVisible: false, desc: 'Usuário Dev mas com permissão negada (ex: env gate desligado)' },
    { isAllowed: false, isDev: false, expectedVisible: false, desc: 'Usuário comum com permissão negada' },
  ];

  it.each(testCases)('$desc -> visível: $expectedVisible', async ({ isAllowed, isDev, expectedVisible }) => {
    vi.mocked(useDevGate).mockReturnValue({ isAllowed, isDev });
    
    const { container } = render(<DevOnlyBridgeOverlay />);
    
    if (expectedVisible) {
      expect(await screen.findByTestId('bridge-metrics-overlay-real')).toBeInTheDocument();
    } else {
      expect(container).toBeEmptyDOMElement();
      expect(screen.queryByTestId('bridge-metrics-overlay-real')).not.toBeInTheDocument();
    }
  });
});
