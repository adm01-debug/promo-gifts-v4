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
 * Cobre "Prazo | Entrega" e "Frete": mesmas classes de alinhamento à esquerda
 * aplicadas em "Validade | Proposta". Renderiza N vezes para garantir
 * estabilidade de data-testid e ausência de duplicação de SelectValue.
 */
function DeliveryAndFreightSection() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <Select defaultValue="14_dias">
        <SelectTrigger
          data-testid="delivery-time-select"
          className="h-8 text-xs [&>span]:flex-1 [&>span]:text-left [&>span]:leading-none"
        >
          <SelectValue placeholder="Selecione" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="14_dias">14 dias | Após aprovação</SelectItem>
        </SelectContent>
      </Select>

      <Select defaultValue="fob">
        <SelectTrigger
          data-testid="shipping-type-select"
          className="h-8 text-xs [&>span]:flex-1 [&>span]:text-left [&>span]:leading-none"
        >
          <SelectValue placeholder="Selecione" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="fob">FOB | Repassado ao cliente</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

const IDS = ['delivery-time-select', 'shipping-type-select'];

describe('QuoteBuilder — Prazo|Entrega e Frete · alinhamento à esquerda', () => {
  it('preserva classes de alinhamento à esquerda em ambos os triggers', () => {
    const { container } = render(<DeliveryAndFreightSection />);
    for (const id of IDS) {
      const trigger = container.querySelector(`[data-testid="${id}"]`)!;
      expect(trigger, `testid "${id}" deve existir`).toBeTruthy();
      const cls = trigger.className;
      expect(cls).toMatch(/\[&>span\]:flex-1/);
      expect(cls).toMatch(/\[&>span\]:text-left/);
      expect(cls).toMatch(/\[&>span\]:leading-none/);
    }
    cleanup();
  });

  it('mantém 1 SelectValue único por trigger ao longo de 25 renders', () => {
    for (let i = 0; i < 25; i += 1) {
      const { container } = render(<DeliveryAndFreightSection />);
      for (const id of IDS) {
        const nodes = container.querySelectorAll(`[data-testid="${id}"]`);
        expect(nodes.length, `render #${i}: testid "${id}" deve existir 1x`).toBe(1);
        const valueSpans = (nodes[0] as HTMLElement).querySelectorAll(':scope > span');
        expect(valueSpans.length, `render #${i}: "${id}" deve ter 1 SelectValue`).toBe(1);
      }
      cleanup();
    }
  });
});

describe('QuoteBuilder — código-fonte da página · Prazo|Entrega e Frete', () => {
  it('QuoteBuilderPage.tsx aplica as classes de alinhamento nos dois triggers', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const src = readFileSync(
      resolve(__dirname, '../QuoteBuilderPage.tsx'),
      'utf8',
    );

    for (const id of ['delivery-time-select', 'shipping-type-select']) {
      const re = new RegExp(
        `data-testid="${id}"[\\s\\S]{0,400}?className=\\{cn\\(\\s*'([^']+)'`,
      );
      const m = src.match(re);
      expect(m, `bloco cn() de ${id} não encontrado`).toBeTruthy();
      expect(m![1]).toMatch(/\[&>span\]:flex-1/);
      expect(m![1]).toMatch(/\[&>span\]:text-left/);
      expect(m![1]).toMatch(/\[&>span\]:leading-none/);
    }
  });
});
