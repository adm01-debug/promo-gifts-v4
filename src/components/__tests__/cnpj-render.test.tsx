/**
 * B3 — Render tests: componentes puros de PDF/HTML que agora mascaram CNPJ.
 *
 * Cobrem os call-sites mais críticos (barra de cliente em propostas +
 * template de aprovação de mockup) sem depender de router/react-query.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ProposalClientBar } from '@/components/pdf/proposal/ProposalClientBar';
import { ClientBar as SectionsClientBar } from '@/components/pdf/ProposalSections';

const RAW = '02931668000188';
const MASKED = '02.931.668/0001-88';

const baseData = {
  client: {
    name: 'Sicoob Fluminense',
    company: 'Sicoob Fluminense',
    contactName: 'Tamires',
    phone: '',
    cnpj: RAW,
  },
} as never;

describe('B3 — ProposalClientBar (PDF)', () => {
  it('renderiza CNPJ mascarado ao lado do nome fantasia', () => {
    const { container } = render(<ProposalClientBar data={baseData} />);
    const html = container.innerHTML;
    expect(html).toContain('Sicoob Fluminense');
    expect(html).toContain(MASKED);
    expect(html).not.toContain(`CNPJ: ${RAW}`);
  });
});

describe('B3 — ProposalSections.ClientBar (PDF)', () => {
  it('renderiza CNPJ mascarado', () => {
    const { container } = render(
      <SectionsClientBar company="Sicoob Fluminense" contact="Tamires" cnpj={RAW} />,
    );
    const html = container.innerHTML;
    expect(html).toContain('Sicoob Fluminense');
    expect(html).toContain(MASKED);
    expect(html).not.toContain(`CNPJ: ${RAW}`);
  });

  it('omite bloco de CNPJ quando ausente', () => {
    const { container } = render(
      <SectionsClientBar company="X" contact="Y" cnpj={undefined} />,
    );
    expect(container.innerHTML).not.toContain('CNPJ:');
  });
});
