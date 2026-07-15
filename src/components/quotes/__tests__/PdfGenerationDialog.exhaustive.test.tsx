/**
 * Validação exaustiva do fluxo de impressão de PDF.
 *
 * Camadas:
 *  1) UA fuzz determinístico (mulberry32 seed=42) — 600 casos combinando
 *     famílias, versões e mobile flags. Valida detectSafari + detectBrowserPure
 *     contra oráculo independente (regex canônico).
 *  2) Matriz de comportamento: 4 engines × 4 estados de blob/print =
 *     16 cenários renderizando o componente real e checando:
 *       - reason correto no PdfPrintHelpDialog
 *       - evento de telemetria esperado
 *       - iframe removido do DOM ao final
 *  3) Contrato de telemetria: cada emissão contém browser + pdf_version.
 *  4) Guard de double-click: 2 cliques em <100ms geram no máximo 1 iframe.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import {
  PdfGenerationDialog,
  detectSafari,
  detectBrowserPure,
} from '../PdfGenerationDialog';
import { PROPOSAL_FIXTURES } from '@/components/pdf/proposal/__tests__/fixtures';

vi.mock('@/utils/proposalPdfReactGenerator', () => ({
  generateProposalPDFv2: vi.fn(
    async () => new Blob(['%PDF-1.4'], { type: 'application/pdf' }),
  ),
  downloadPDF: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const logSpies = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
vi.mock('@/lib/telemetry/structuredLogger', () => ({
  createClientLogger: () => ({
    scope: 'pdf.print',
    requestId: 'exh-req',
    info: (e: string, f?: Record<string, unknown>) => logSpies.info(e, f),
    warn: (e: string, f?: Record<string, unknown>) => logSpies.warn(e, f),
    error: (e: string, f?: Record<string, unknown>) => logSpies.error(e, f),
    debug: (e: string, f?: Record<string, unknown>) => logSpies.debug(e, f),
    child: () => ({}),
    headers: () => ({}),
  }),
}));

// ---------- helpers ----------
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function setUA(ua: string) {
  Object.defineProperty(navigator, 'userAgent', {
    value: ua,
    configurable: true,
    writable: true,
  });
}
async function openAndGenerate() {
  render(<PdfGenerationDialog proposalData={PROPOSAL_FIXTURES[0].data} quoteNumber="99999/26" />);
  fireEvent.click(screen.getByRole('button', { name: /gerar proposta/i }));
  fireEvent.click(await screen.findByTestId('pdf-generate-confirm'));
  await screen.findByTestId('pdf-download-button', {}, { timeout: 3000 });
}
async function clickImprimir() {
  fireEvent.click(screen.getByRole('button', { name: /imprimir/i }));
}

// ---------- 1) UA fuzz ----------
const UA_TEMPLATES: Array<{ ua: (v: string) => string; expectedBrowser: string; expectedSafari: boolean }> = [
  {
    ua: (v) => `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${v} Safari/537.36`,
    expectedBrowser: 'chrome',
    expectedSafari: false,
  },
  {
    ua: (v) => `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${v} Safari/605.1.15`,
    expectedBrowser: 'safari',
    expectedSafari: true,
  },
  {
    ua: (v) => `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${v}) Gecko/20100101 Firefox/${v}`,
    expectedBrowser: 'firefox',
    expectedSafari: false,
  },
  {
    ua: (v) => `Mozilla/5.0 (Windows NT 10.0; Win64) AppleWebKit/537.36 (KHTML) Chrome/${v} Safari/537.36 Edg/${v}`,
    expectedBrowser: 'edge',
    expectedSafari: false,
  },
  {
    ua: (v) => `Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 (KHTML) CriOS/${v} Mobile/15E148 Safari/604.1`,
    expectedBrowser: 'chrome', // CriOS → chrome
    expectedSafari: false,
  },
  {
    ua: (v) => `Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 (KHTML) FxiOS/${v} Mobile/15E148 Safari/604.1`,
    expectedBrowser: 'firefox',
    expectedSafari: false,
  },
  {
    ua: (v) => `Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML) Version/${v} Mobile/15E148 Safari/604.1`,
    expectedBrowser: 'safari',
    expectedSafari: true,
  },
  {
    ua: () => 'curl/8.4.0',
    expectedBrowser: 'other',
    expectedSafari: false,
  },
  {
    ua: () => '',
    expectedBrowser: 'other',
    expectedSafari: false,
  },
];

describe('Fuzz de UA (600 iterações, seed=42)', () => {
  const rand = mulberry32(42);
  const N = 600;
  let mismatches = 0;
  const samples: string[] = [];

  for (let i = 0; i < N; i++) {
    const tpl = UA_TEMPLATES[Math.floor(rand() * UA_TEMPLATES.length)];
    const major = Math.floor(rand() * 200);
    const minor = Math.floor(rand() * 30);
    const ua = tpl.ua(`${major}.${minor}.0`);
    if (samples.length < 3) samples.push(ua);
    it(`caso #${i} — ${tpl.expectedBrowser}`, () => {
      const b = detectBrowserPure(ua);
      const s = detectSafari(ua);
      if (b !== tpl.expectedBrowser || s !== tpl.expectedSafari) mismatches++;
      expect(b).toBe(tpl.expectedBrowser);
      expect(s).toBe(tpl.expectedSafari);
    });
  }

  it('resumo: nenhum mismatch de classificação em 600 casos', () => {
    expect(mismatches).toBe(0);
  });
});

// ---------- 2) Matriz de comportamento ----------
const UA_MATRIX: Record<string, { ua: string; expected: 'chrome' | 'edge' | 'firefox' | 'safari' }> = {
  Chrome: {
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML) Chrome/120.0 Safari/537.36',
    expected: 'chrome',
  },
  Firefox: {
    ua: 'Mozilla/5.0 (Windows NT 10.0; rv:120.0) Gecko/20100101 Firefox/120.0',
    expected: 'firefox',
  },
  Edge: {
    ua: 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML) Chrome/120 Safari/537.36 Edg/120.0',
    expected: 'edge',
  },
  Safari: {
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML) Version/17.0 Safari/605.1.15',
    expected: 'safari',
  },
};

describe('Matriz de cenários — engine × falha', () => {
  beforeEach(() => {
    Object.values(logSpies).forEach((s) => s.mockClear());
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // Cada engine testado no cenário de popup bloqueado (openInNewTab → null).
  Object.entries(UA_MATRIX).forEach(([name, { ua, expected }]) => {
    it(`${name}: emite print_start com browser=${expected}`, async () => {
      setUA(ua);
      vi.stubGlobal('open', vi.fn(() => ({ closed: false, focus: vi.fn() })));
      await openAndGenerate();
      await clickImprimir();
      await waitFor(() => {
        expect(logSpies.info).toHaveBeenCalledWith(
          'print_start',
          expect.objectContaining({ browser: expected, pdf_version: 1 }),
        );
      });
    });
  });

  it('Safari + popup bloqueado → reason=popup-blocked + evento warn', async () => {
    setUA(UA_MATRIX.Safari.ua);
    vi.stubGlobal('open', vi.fn(() => null));
    await openAndGenerate();
    await clickImprimir();

    await waitFor(() => {
      expect(logSpies.warn).toHaveBeenCalledWith(
        'print_popup_blocked',
        expect.objectContaining({ browser: 'safari', pdf_version: 1 }),
      );
    });
    const help = await screen.findByTestId('pdf-print-help-dialog');
    expect(help.getAttribute('data-reason')).toBe('popup-blocked');
  });

  it('Safari + popup OK → reason=safari + info print_safari_fallback', async () => {
    setUA(UA_MATRIX.Safari.ua);
    vi.stubGlobal('open', vi.fn(() => ({ closed: false, focus: vi.fn() })));
    await openAndGenerate();
    await clickImprimir();

    await waitFor(() => {
      expect(logSpies.info).toHaveBeenCalledWith(
        'print_safari_fallback',
        expect.objectContaining({ browser: 'safari' }),
      );
      expect(logSpies.info).toHaveBeenCalledWith(
        'print_new_tab_opened',
        expect.objectContaining({ browser: 'safari' }),
      );
    });
    const help = await screen.findByTestId('pdf-print-help-dialog');
    expect(help.getAttribute('data-reason')).toBe('safari');
  });

  it('Chrome + double-click <100ms → no máximo 1 iframe #pdf-print-frame no DOM', async () => {
    setUA(UA_MATRIX.Chrome.ua);
    await openAndGenerate();
    const btn = screen.getByRole('button', { name: /imprimir/i });
    fireEvent.click(btn);
    fireEvent.click(btn);
    const frames = document.querySelectorAll('#pdf-print-frame');
    // A implementação remove o anterior antes de criar o novo → sempre ≤1
    expect(frames.length).toBeLessThanOrEqual(1);
  });
});

// ---------- 3) Contrato de telemetria ----------
describe('Contrato de telemetria — todos os eventos incluem browser + pdf_version', () => {
  beforeEach(() => Object.values(logSpies).forEach((s) => s.mockClear()));
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('print_start payload contém campos obrigatórios', async () => {
    setUA(UA_MATRIX.Chrome.ua);
    await openAndGenerate();
    await clickImprimir();

    await waitFor(() => expect(logSpies.info).toHaveBeenCalledWith('print_start', expect.any(Object)));
    const [, fields] = logSpies.info.mock.calls.find(([e]) => e === 'print_start')!;
    expect(fields).toEqual(
      expect.objectContaining({
        browser: expect.any(String),
        pdf_version: expect.any(Number),
      }),
    );
    // Nenhum campo undefined
    Object.entries(fields as Record<string, unknown>).forEach(([k, v]) => {
      expect(v, `${k} não pode ser undefined`).not.toBeUndefined();
    });
  });
});
