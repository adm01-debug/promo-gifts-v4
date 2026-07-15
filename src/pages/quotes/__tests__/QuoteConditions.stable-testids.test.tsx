import { describe, it, expect } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Renderiza a seção "Condições" (isolada) N vezes e valida que:
 * - Os data-testid dos três campos permanecem estáveis
 * - Não há duplicação do elemento de texto (SelectValue) por trigger
 * - As classes de alinhamento à esquerda persistem
 */
function ConditionsSection() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <Select defaultValue="30">
        <SelectTrigger
          data-testid="proposal-validity-select"
          className="h-8 text-xs [&>span]:flex-1 [&>span]:text-left [&>span]:leading-none"
        >
          <SelectValue placeholder="Selecione" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="30">30 dias</SelectItem>
        </SelectContent>
      </Select>

      <Select defaultValue="boleto">
        <SelectTrigger
          data-testid="payment-method-select"
          className="h-8 text-xs [&>span]:flex-1 [&>span]:text-left [&>span]:leading-none"
        >
          <SelectValue placeholder="Selecione" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="boleto">Boleto Bancário</SelectItem>
        </SelectContent>
      </Select>

      <Select defaultValue="7_dias">
        <SelectTrigger
          data-testid="payment-terms-select"
          className="h-8 text-xs [&>span]:flex-1 [&>span]:text-left [&>span]:leading-none"
        >
          <SelectValue placeholder="Selecione" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7_dias">7 dias a partir da entrega</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

const IDS = [
  'proposal-validity-select',
  'payment-method-select',
  'payment-terms-select',
];

describe('QuoteBuilder — Condições · data-testid estáveis em renders repetidos', () => {
  it('mantém 1 trigger único por testid ao longo de 25 renders', () => {
    for (let i = 0; i < 25; i += 1) {
      const { container } = render(<ConditionsSection />);
      for (const id of IDS) {
        const nodes = container.querySelectorAll(`[data-testid="${id}"]`);
        expect(nodes.length, `render #${i}: testid "${id}" deve existir exatamente 1x`).toBe(1);

        // O SelectValue vira um <span> filho direto do trigger; não deve haver duplicação
        const trigger = nodes[0] as HTMLElement;
        const valueSpans = trigger.querySelectorAll(':scope > span');
        expect(valueSpans.length, `render #${i}: "${id}" deve ter 1 SelectValue`).toBe(1);
      }
      cleanup();
    }
  });

  it('preserva classes de alinhamento à esquerda em todos os triggers', () => {
    const { container } = render(<ConditionsSection />);
    for (const id of IDS) {
      const trigger = container.querySelector(`[data-testid="${id}"]`)!;
      const cls = trigger.className;
      expect(cls).toMatch(/\[&>span\]:flex-1/);
      expect(cls).toMatch(/\[&>span\]:text-left/);
      expect(cls).toMatch(/\[&>span\]:leading-none/);
    }
    cleanup();
  });
});
