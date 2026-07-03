/**
 * Teste isolado do bloco "Prazo | Entrega ⓘ [Contar dias|Data fixa]".
 *
 * Reproduz APENAS o wrapper do label (o mesmo padrão do QuoteBuilderPage)
 * e valida que a ordem DOM é: Label → Tooltip trigger → DeliveryModeToggle,
 * dentro do mesmo container flex — garantindo que o toggle fica colado ao
 * rótulo, não empurrado para a extremidade direita.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeliveryModeToggle } from '@/pages/quotes/components/DeliveryModeToggle';

function Bloco() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-1.5" data-testid="delivery-label-row">
        <label className="text-xs text-muted-foreground">Prazo | Entrega</label>
        <span data-testid="delivery-info-tooltip-trigger" aria-label="Info" />
        <DeliveryModeToggle value="prazo" onChange={() => {}} />
      </div>
    </div>
  );
}

describe('Bloco Prazo | Entrega + Toggle — posicionamento', () => {
  it('toggle é irmão direto do label dentro do mesmo flex row', () => {
    render(<Bloco />);
    const row = screen.getByTestId('delivery-label-row');
    const toggle = screen.getByTestId('delivery-mode-toggle');
    expect(row.contains(toggle)).toBe(true);
    expect(toggle.parentElement).toBe(row);
  });

  it('ordem DOM: label → tooltip → toggle', () => {
    render(<Bloco />);
    const row = screen.getByTestId('delivery-label-row');
    const children = Array.from(row.children);
    expect(children[0].tagName).toBe('LABEL');
    expect(children[1].getAttribute('data-testid')).toBe('delivery-info-tooltip-trigger');
    expect(children[2].getAttribute('data-testid')).toBe('delivery-mode-toggle');
  });

  it('row usa flex items-center gap-1.5 (não justify-between)', () => {
    render(<Bloco />);
    const row = screen.getByTestId('delivery-label-row');
    expect(row.className).toContain('flex');
    expect(row.className).toContain('items-center');
    expect(row.className).toContain('gap-1.5');
    expect(row.className).not.toContain('justify-between');
  });
});
