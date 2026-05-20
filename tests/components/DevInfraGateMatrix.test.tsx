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

  // DevOnlyBridgeOverlay usa <DevOnly strict>, ou seja, o gate é EXCLUSIVAMENTE
  // por `isDev` (role dev real) — admin/supervisor/override não veem o overlay
  // técnico. A visibilidade segue isDev, independente de isAllowed.
  const testCases = [
    { isAllowed: true,  isDev: true,  expectedVisible: true,  desc: 'Dev real → vê' },
    { isAllowed: true,  isDev: false, expectedVisible: false, desc: 'Não-dev com isAllowed (admin/override) → NÃO vê (strict)' },
    { isAllowed: false, isDev: true,  expectedVisible: true,  desc: 'Dev real vê mesmo com isAllowed=false (strict usa isDev)' },
    { isAllowed: false, isDev: false, expectedVisible: false, desc: 'Usuário comum → NÃO vê' },
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
