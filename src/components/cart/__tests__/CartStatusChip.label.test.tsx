/**
 * Garante que:
 *  1. O label do status `em_separacao` é o rótulo curto "Separação"
 *     (uma palavra, cabe em uma linha do chip da tabela de Carrinhos).
 *  2. O chip renderizado inclui `whitespace-nowrap`, prevenindo quebra
 *     mesmo que futuros rótulos venham a ter espaço.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { STATUS_CONFIG, getStatusCfg } from '@/components/cart/CartUtilComponents';
import { cn } from '@/lib/utils';

describe('Cart status chip — rótulo "Separação"', () => {
  it('STATUS_CONFIG.em_separacao.label é "Separação" (single-word, cabe em 1 linha)', () => {
    expect(STATUS_CONFIG.em_separacao.label).toBe('Separação');
    expect(STATUS_CONFIG.em_separacao.label).not.toMatch(/\s/);
  });

  it('chip da linha renderiza com whitespace-nowrap e o texto correto', () => {
    const cfg = getStatusCfg('em_separacao');
    const { container } = render(
      <span
        data-testid="chip"
        className={cn(
          'inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold',
          cfg.color,
        )}
      >
        {cfg.label}
      </span>,
    );
    const chip = container.querySelector('[data-testid="chip"]')!;
    expect(chip).not.toBeNull();
    expect(chip.textContent).toBe('Separação');
    expect(chip.className).toMatch(/whitespace-nowrap/);
  });
});
