/**
 * Layout validation for CompanyContactSelector:
 * garante grid 50/50 (md+) com stack vertical (mobile), sem regressão.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';

vi.mock('@/lib/crm-db', () => ({
  selectCrm: vi.fn().mockResolvedValue([]),
  searchCrm: vi.fn().mockResolvedValue([]),
}));

import { CompanyContactSelector } from '@/components/quotes/CompanyContactSelector';

function renderCCS(companyId = '') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <TooltipProvider>
          <CompanyContactSelector
            companyId={companyId}
            onCompanyChange={vi.fn()}
            onContactChange={vi.fn()}
          />
        </TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CompanyContactSelector — layout 50/50', () => {
  it('wrapper aplica grid responsivo (1 col mobile, 2 col md+)', () => {
    const { container } = renderCCS();
    const wrapper = container.querySelector('div.grid');
    expect(wrapper).toBeTruthy();
    const cls = wrapper!.className;
    expect(cls).toMatch(/grid-cols-1/);
    expect(cls).toMatch(/md:grid-cols-2/);
    expect(cls).toMatch(/gap-4/);
  });

  it('contém exatamente 2 filhos diretos (Empresa + Contato)', () => {
    const { container } = renderCCS();
    const wrapper = container.querySelector('div.grid')!;
    expect(wrapper.children.length).toBe(2);
  });

  it('placeholder de Contato aparece quando companyId está vazio', () => {
    const { getByText } = renderCCS('');
    expect(getByText('Selecione uma empresa primeiro')).toBeTruthy();
  });

  it('labels Empresa e Contato estão presentes e nessa ordem', () => {
    const { container } = renderCCS();
    const labels = Array.from(container.querySelectorAll('label')).map((l) =>
      l.textContent?.trim(),
    );
    expect(labels[0]).toContain('Empresa');
    expect(labels[1]).toContain('Contato');
  });
});
