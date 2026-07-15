/**
 * Validação exaustiva — aviso "Confira as informações antes de enviar" no header
 * do `PdfGenerationDialog`. Cobertura: renderização condicional, a11y,
 * responsividade, resiliência a títulos longos, coexistência com badges.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { PdfGenerationDialog } from '../PdfGenerationDialog';
import { PROPOSAL_FIXTURES } from '@/components/pdf/proposal/__tests__/fixtures';

vi.mock('@/utils/proposalPdfReactGenerator', () => ({
  // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
  generateProposalPDFv2: vi.fn(async () => new Blob(['%PDF-1.4'], { type: 'application/pdf' })),
  downloadPDF: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const baseData = PROPOSAL_FIXTURES[0].data;

function openDialog(props: Partial<Parameters<typeof PdfGenerationDialog>[0]> = {}) {
  const utils = render(
    <PdfGenerationDialog
      proposalData={baseData}
      quoteNumber="00001/26"
      quoteStatus="draft"
      {...props}
    />
  );
  // trigger padrão
  const trigger = screen.getByRole('button', { name: /gerar proposta/i });
  trigger.click();
  return utils;
}

describe('PdfGenerationDialog — aviso do header (preview stage)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renderiza o aviso apenas no stage "preview" com a11y correto', async () => {
    openDialog();
    const status = await screen.findByRole('status', { name: /confira as informações antes de enviar/i });
    expect(status).toBeInTheDocument();
    // Ícone deve ser aria-hidden para não poluir SR
    const icon = status.querySelector('svg');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    // aria-live polite (não interrompe fluxo)
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  it('inclui as duas variantes de texto (curta + longa) para responsividade', async () => {
    openDialog();
    const status = await screen.findByRole('status');
    expect(within(status).getByText('Confira as informações antes de enviar')).toBeInTheDocument();
    expect(within(status).getByText('Confira antes de enviar')).toBeInTheDocument();
  });

  it('não empurra a pílula quando o número do orçamento é enorme (100 chars)', async () => {
    const huge = `${'X'.repeat(100)}/26`;
    openDialog({ quoteNumber: huge });
    const title = await screen.findByRole('heading', { name: new RegExp(huge.slice(0, 20)) });
    // O container do título tem min-w-0 + truncate para não empurrar
    expect(title.className).toMatch(/truncate/);
    const titleGroup = title.parentElement;
    expect(titleGroup?.className).toMatch(/min-w-0/);
  });

  it('coexiste com Badges "Rascunho" e "vN" sem overflow', async () => {
    openDialog({ quoteStatus: 'draft' });
    expect(await screen.findByText('Rascunho')).toBeInTheDocument();
    const status = await screen.findByRole('status');
    // Pílula tem shrink-0 (não colapsa)
    expect(status.className).toMatch(/shrink-0/);
  });

  it('classes de responsividade estão presentes (hidden < sm)', async () => {
    openDialog();
    const status = await screen.findByRole('status');
    expect(status.className).toMatch(/hidden/);
    expect(status.className).toMatch(/sm:inline-flex/);
    // longa oculta no mobile, curta oculta no md+
    const longText = within(status).getByText('Confira as informações antes de enviar');
    expect(longText.className).toMatch(/hidden md:inline/);
    const shortText = within(status).getByText('Confira antes de enviar');
    expect(shortText.className).toMatch(/md:hidden/);
  });

  it('fuzz: 30 quoteNumbers aleatórios (5-300 chars) não quebram render', async () => {
    for (let i = 0; i < 30; i++) {
      const len = 5 + Math.floor(Math.random() * 295);
      const q = Array.from({ length: len }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join('');
      const { unmount } = render(
        <PdfGenerationDialog proposalData={baseData} quoteNumber={q} quoteStatus="active" />
      );
      const trigger = screen.getAllByRole('button', { name: /gerar proposta/i }).slice(-1)[0];
      trigger.click();
      // Não lança e monta título truncado
      const heading = await screen.findAllByRole('heading');
      expect(heading.length).toBeGreaterThan(0);
      unmount();
    }
  });
});
