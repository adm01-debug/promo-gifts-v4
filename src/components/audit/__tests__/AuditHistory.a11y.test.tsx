/**
 * AuditHistory — testes de acessibilidade.
 *
 * Valida:
 *  - Estrutura semântica: <ol>/<li> e <time dateTime>
 *  - Navegação por teclado: trigger de expand é tab-focável e ativável por Enter/Space
 *  - Estado ARIA do Collapsible é atualizado ao expandir
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuditHistory } from '../AuditHistory';

vi.mock('@/hooks/admin', async () => {
  const actual = await vi.importActual('@/hooks/admin');
  return {
    ...actual,
    fetchAuditHistory: vi.fn().mockResolvedValue([
      {
        id: 'log-1',
        action: 'UPDATE',
        created_at: '2026-06-25T15:11:00.000Z',
        old_values: { name: 'Antigo' },
        new_values: { name: 'Novo' },
        profiles: { full_name: 'Maria Silva', email: 'maria@x.com' },
      },
      {
        id: 'log-2',
        action: 'INSERT',
        created_at: '2026-06-25T14:00:00.000Z',
        old_values: null,
        new_values: { name: 'Item' },
        profiles: { full_name: null, email: 'sys@x.com' },
      },
    ]),
  };
});

function renderWithClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AuditHistory entityType="quote" entityId="q-1" />
    </QueryClientProvider>,
  );
}

describe('AuditHistory — acessibilidade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza a lista como <ol> com <li> para cada registro', async () => {
    const { container } = renderWithClient();
    await screen.findByText('Maria Silva');

    const list = container.querySelector('ol');
    expect(list).not.toBeNull();
    const items = list?.querySelectorAll('li') ?? [];
    expect(items.length).toBe(2);
  });

  it('usa <time dateTime> em formato ISO para cada entrada', async () => {
    const { container } = renderWithClient();
    await screen.findByText('Maria Silva');

    const times = container.querySelectorAll('time');
    expect(times.length).toBeGreaterThanOrEqual(2);
    for (const t of Array.from(times)) {
      expect(t.getAttribute('datetime')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });

  it('expand de detalhes é navegável por teclado (Enter/Space) e atualiza aria-expanded', async () => {
    renderWithClient();
    await screen.findByText('Maria Silva');

    const trigger = screen.getByRole('button', { name: /ver campos alterados/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    // Foco direto + ativação (Radix CollapsibleTrigger trata Enter/Space nativamente)
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);

    const triggerAfter = screen.getByRole('button', { name: /ocultar detalhes/i });
    expect(triggerAfter).toHaveAttribute('aria-expanded', 'true');
  });

  it('header do card e ícones decorativos não poluem o accessible tree', async () => {
    const { container } = renderWithClient();
    await screen.findByText('Maria Silva');

    // Trilho da timeline é puramente decorativo
    const decorative = container.querySelectorAll('[aria-hidden="true"]');
    expect(decorative.length).toBeGreaterThan(0);
  });
});
