/**
 * Validação exaustiva — botão "Gerar PDF" do footer:
 * a11y (aria-label, min-tap-target 44px), tooltip, responsividade,
 * estados de interação (hover/focus/active) via classes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PdfGenerationDialog } from '../PdfGenerationDialog';
import { PROPOSAL_FIXTURES } from '@/components/pdf/proposal/__tests__/fixtures';

vi.mock('@/utils/proposalPdfReactGenerator', () => ({
  // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
  generateProposalPDFv2: vi.fn(async () => new Blob(['%PDF-1.4'], { type: 'application/pdf' })),
  downloadPDF: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const baseData = PROPOSAL_FIXTURES[0].data;

async function openAndGetGenerateBtn() {
  render(<PdfGenerationDialog proposalData={baseData} quoteNumber="00001/26" />);
  const trigger = screen.getByRole('button', { name: /gerar proposta/i });
  trigger.click();
  return screen.findByTestId('pdf-generate-confirm');
}

describe('PdfGenerationDialog — botão "Gerar PDF" (footer)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('tem aria-label descritivo (independe do texto visível)', async () => {
    const btn = await openAndGetGenerateBtn();
    expect(btn).toHaveAttribute('aria-label', 'Gerar e baixar PDF da proposta');
  });

  it('respeita o alvo tátil mínimo (min-h-11 = 44px WCAG AAA)', async () => {
    const btn = await openAndGetGenerateBtn();
    expect(btn.className).toMatch(/min-h-11/);
  });

  it('padding é responsivo por breakpoint (px-5 sm:px-6 md:px-7)', async () => {
    const btn = await openAndGetGenerateBtn();
    expect(btn.className).toMatch(/px-5/);
    expect(btn.className).toMatch(/sm:px-6/);
    expect(btn.className).toMatch(/md:px-7/);
  });

  it('possui classes de hover/active/focus-visible para feedback consistente', async () => {
    const btn = await openAndGetGenerateBtn();
    expect(btn.className).toMatch(/hover:brightness-110/);
    expect(btn.className).toMatch(/active:scale-\[0\.98\]/);
    expect(btn.className).toMatch(/focus-visible:ring-2/);
    expect(btn.className).toMatch(/focus-visible:ring-offset-2/);
  });

  it('tooltip aparece ao focar o botão', async () => {
    const user = userEvent.setup();
    const btn = await openAndGetGenerateBtn();
    await user.tab(); // Botão de fechar do dialog
    btn.focus();
    // Tooltip Radix renderiza em role="tooltip"
    const tip = await screen.findByRole('tooltip', {}, { timeout: 1500 });
    expect(tip).toHaveTextContent(/gera e baixa o pdf final da proposta/i);
  });

  it('ícone Info interno é aria-hidden', async () => {
    const btn = await openAndGetGenerateBtn();
    const svg = btn.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('click aciona o gerador de PDF', async () => {
    const user = userEvent.setup();
    const { generateProposalPDFv2 } = await import('@/utils/proposalPdfReactGenerator');
    const btn = await openAndGetGenerateBtn();
    await user.click(btn);
    // handleGenerate encadeia ~500ms de setTimeout antes de chamar o gerador
    await vi.waitFor(() => expect(generateProposalPDFv2).toHaveBeenCalled(), { timeout: 2000 });
  });
});
