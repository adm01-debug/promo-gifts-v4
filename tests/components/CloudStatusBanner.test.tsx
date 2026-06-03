/**
 * CloudStatusBanner — gating dev-only vs crítico
 *
 * Garante que apenas mensagens estritamente técnicas ("warming") são ocultadas
 * para usuários comuns. Falhas críticas ("down", "degraded") são exibidas a todos.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { CloudStatusBanner } from '@/components/system/CloudStatusBanner';
import type { CloudStatus, CloudStatusSnapshot, StatusHistoryEntry } from '@/lib/cloud-status';

// Mock framer-motion para que <AnimatePresence key={status}> não bloqueie
// a troca síncrona de banner em jsdom (onde animações não progridem).
vi.mock('framer-motion', () => {
  const passthrough = (Tag: any) =>
    React.forwardRef(function M(props: any, ref: any) {
      const { children, ...rest } = props;
      const clean: any = {};
      for (const k of Object.keys(rest)) {
        if (!/^(initial|animate|exit|transition|whileHover|whileTap|variants|layout)/.test(k)) {
          clean[k] = rest[k];
        }
      }
      return React.createElement(Tag, { ref, ...clean }, children);
    });
  const motionProxy = new Proxy({}, { get: (_t, p: any) => passthrough(p) });
  return {
    motion: motionProxy,
    m: motionProxy,
    LazyMotion: ({ children }: any) => React.createElement(React.Fragment, null, children),
    domMax: {},
    domAnimation: {},
    AnimatePresence: ({ children }: any) => React.createElement(React.Fragment, null, children),
  };
});

const mockUseAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUseCloudStatus = vi.fn();
vi.mock('@/hooks/ui/useCloudStatus', () => ({
  useCloudStatus: () => mockUseCloudStatus(),
}));

const mockGetStatusTimeline = vi.fn<() => StatusHistoryEntry[]>();
vi.mock('@/lib/cloud-status', async () => {
  const actual = await vi.importActual<typeof import('@/lib/cloud-status')>('@/lib/cloud-status');
  return {
    ...actual,
    getStatusTimeline: () => mockGetStatusTimeline(),
  };
});

// Mock do hook useDevGate (já que o componente o usa agora)
const mockIsAllowed = vi.fn();
vi.mock('@/hooks/admin/useDevGate', () => ({
  useDevGate: () => ({
    isAllowed: mockIsAllowed(),
    isDev: mockUseAuth().isDev,
  }),
}));

function buildSnapshot(status: CloudStatus): CloudStatusSnapshot | null {
  if (status === 'unknown') return null;
  return {
    status,
    checkedAt: Date.now(),
    signals: {
      auth: { ok: status !== 'down', ms: 120 },
      bridge: { ok: status === 'healthy' || status === 'warming', ms: 140 },
      rest: { ok: status === 'healthy' || status === 'warming' || status === 'degraded', ms: 160 },
    },
  };
}

function setStatus(status: CloudStatus) {
  mockUseCloudStatus.mockReturnValue({
    status,
    snapshot: buildSnapshot(status),
    retry: vi.fn(),
    isChecking: false,
  });
}

beforeEach(() => {
  mockUseAuth.mockReset();
  mockUseCloudStatus.mockReset();
  mockIsAllowed.mockReset();
  mockGetStatusTimeline.mockReset();
  mockGetStatusTimeline.mockReturnValue([]);
  // Default: isAllowed segue isDev
  mockIsAllowed.mockImplementation(() => mockUseAuth().isDev);
});

describe('CloudStatusBanner — visibilidade por papel e criticidade', () => {
  it('NÃO renderiza "warming" para usuário não-dev (mensagem técnica)', () => {
    mockUseAuth.mockReturnValue({ isDev: false });
    setStatus('warming');
    const { container } = render(<CloudStatusBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('EXIBE "down" para usuário não-dev (falha crítica)', () => {
    mockUseAuth.mockReturnValue({ isDev: false });
    setStatus('down');
    render(<CloudStatusBanner />);
    expect(screen.getByText(/Backend indisponível/i)).toBeInTheDocument();
  });

  it('EXIBE "degraded" para usuário não-dev (falha crítica)', () => {
    mockUseAuth.mockReturnValue({ isDev: false });
    setStatus('degraded');
    render(<CloudStatusBanner />);
    expect(screen.getByText(/Backend instável/i)).toBeInTheDocument();
  });

  it('EXIBE tudo para usuários dev', () => {
    mockUseAuth.mockReturnValue({ isDev: true });

    // Test warming
    setStatus('warming');
    const { unmount } = render(<CloudStatusBanner />);
    expect(screen.getByText(/Backend inicializando parcialmente/i)).toBeInTheDocument();

    // Test down
    unmount();
    setStatus('down');
    render(<CloudStatusBanner />);
    expect(screen.getByText(/Backend indisponível/i)).toBeInTheDocument();
  });

  it('respeita o gate de infra: mesmo dev NÃO vê "warming" se isAllowed=false (Modo PROD)', () => {
    mockUseAuth.mockReturnValue({ isDev: true });
    mockIsAllowed.mockReturnValue(false); // Simula gate fechado em PROD
    setStatus('warming');

    const { container } = render(<CloudStatusBanner />);
    expect(container).toBeEmptyDOMElement();

    // Mas ainda vê "down"
    setStatus('down');
    render(<CloudStatusBanner />);
    expect(screen.getByText(/Backend indisponível/i)).toBeInTheDocument();
  });

  it('NÃO renderiza banner quando estado é healthy (mesmo em dev)', () => {
    // Política atual: banner saudável foi removido — indicador fica em DevStatusDot.
    mockUseAuth.mockReturnValue({ isDev: true });
    setStatus('healthy');

    const { container } = render(<CloudStatusBanner />);

    expect(container).toBeEmptyDOMElement();
  });

  it('NÃO renderiza banner quando estado é unknown (mesmo em dev)', () => {
    // Política atual: banner não aparece em unknown — primeira sondagem é silenciosa.
    mockUseAuth.mockReturnValue({ isDev: true });
    setStatus('unknown');

    const { container } = render(<CloudStatusBanner />);

    expect(container).toBeEmptyDOMElement();
  });

  it('abre painel de debug mostrando probes sem crash', () => {
    mockUseAuth.mockReturnValue({ isDev: true });
    setStatus('degraded');

    render(<CloudStatusBanner />);

    fireEvent.click(screen.getByTitle(/Debug Latência/i));

    expect(screen.getByText(/AUTH: 120ms/i)).toBeInTheDocument();
    expect(screen.getByText(/BRIDGE: 140ms/i)).toBeInTheDocument();
    expect(screen.getByText(/REST: 160ms/i)).toBeInTheDocument();
  });

  it('abre timeline histórica mostrando falhas consecutivas', async () => {
    mockUseAuth.mockReturnValue({ isDev: true });
    mockGetStatusTimeline.mockReturnValue([
      { status: 'healthy', timestamp: Date.now() - 1000, consecutiveFailures: 0 },
      { status: 'down', timestamp: Date.now() - 500, consecutiveFailures: 2 },
    ]);
    // Banner só aparece em estado de issue — usamos 'degraded' para abrir o timeline.
    setStatus('degraded');

    render(<CloudStatusBanner />);

    fireEvent.click(screen.getByTitle(/Ver histórico/i));

    expect(await screen.findByText('DOWN')).toBeInTheDocument();
    expect(await screen.findByText('(2 falhas)')).toBeInTheDocument();
  });

  it('mostra spinner no botão Tentar novamente quando isChecking=true (cobertura de animate-spin)', () => {
    mockUseAuth.mockReturnValue({ isDev: true });
    // Forçar isChecking=true para exercitar a branch animate-spin no RefreshCw
    mockUseCloudStatus.mockReturnValue({
      status: 'down',
      snapshot: buildSnapshot('down'),
      isChecking: true,
      retry: vi.fn(),
    });
    render(<CloudStatusBanner />);
    const refresh = screen.getByRole('button', { name: /Tentar novamente/i });
    // O ícone interno deve ter classe animate-spin quando isChecking=true
    expect(refresh.querySelector('.animate-spin')).not.toBeNull();
  });

  it('renderiza timeline com cores distintas para healthy/down/warming (cobertura do ternário de cores)', async () => {
    mockUseAuth.mockReturnValue({ isDev: true });
    mockGetStatusTimeline.mockReturnValue([
      { status: 'healthy', timestamp: Date.now() - 3000, consecutiveFailures: 0 },
      { status: 'warming', timestamp: Date.now() - 2000, consecutiveFailures: 0 },
      { status: 'degraded', timestamp: Date.now() - 1000, consecutiveFailures: 1 },
      { status: 'down', timestamp: Date.now() - 500, consecutiveFailures: 2 },
    ]);
    setStatus('degraded');
    render(<CloudStatusBanner />);
    fireEvent.click(screen.getByTitle(/Ver histórico/i));

    // Cada status renderiza um pill colorido distinto — exercita os 3 ramos
    // do ternário entry.status === 'healthy' ? bg-green : 'down' ? bg-red : bg-yellow
    expect(await screen.findByText('HEALTHY')).toBeInTheDocument();
    expect(await screen.findByText('WARMING')).toBeInTheDocument();
    expect(await screen.findByText('DEGRADED')).toBeInTheDocument();
    expect(await screen.findByText('DOWN')).toBeInTheDocument();
  });
});
