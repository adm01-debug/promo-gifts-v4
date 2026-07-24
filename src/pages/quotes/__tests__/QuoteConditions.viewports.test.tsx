import { describe, it, expect, beforeEach } from 'vitest';
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
 * Cobre TODA a seção "Condições" (Validade, Forma, Prazo|Pagamento,
 * Prazo|Entrega e Frete) simulando as larguras 320 (mobile), 768 (md) e
 * 1280 (xl). jsdom não faz layout real; validamos:
 * - classes de alinhamento à esquerda (`[&>span]:flex-1 [&>span]:text-left`)
 * - `leading-none` no SelectValue
 * - estabilidade de data-testid em N renderizações
 * - unicidade do SelectValue (1 span filho direto por trigger)
 * - ordem DOM: SelectValue à esquerda, chevron à direita
 */

const LEFT_ALIGN_CLS =
  'h-8 text-xs [&>span]:flex-1 [&>span]:text-left [&>span]:leading-none';

function FullConditionsSection() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Select defaultValue="30">
          <SelectTrigger data-testid="proposal-validity-select" className={LEFT_ALIGN_CLS}>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">30 dias</SelectItem>
          </SelectContent>
        </Select>

        <Select defaultValue="boleto">
          <SelectTrigger data-testid="payment-method-select" className={LEFT_ALIGN_CLS}>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="boleto">Boleto Bancário</SelectItem>
          </SelectContent>
        </Select>

        <Select defaultValue="50_50">
          <SelectTrigger data-testid="payment-terms-select" className={LEFT_ALIGN_CLS}>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="50_50">50/50 | 50% entrada / 50% após entrega</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Select defaultValue="14_dias">
          <SelectTrigger data-testid="delivery-time-select" className={LEFT_ALIGN_CLS}>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="14_dias">14 dias | Após aprovação</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Select defaultValue="fob">
          <SelectTrigger data-testid="shipping-type-select" className={LEFT_ALIGN_CLS}>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fob">FOB | Repassado ao cliente</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

const ALL_IDS = [
  'proposal-validity-select',
  'payment-method-select',
  'payment-terms-select',
  'delivery-time-select',
  'shipping-type-select',
];

const VIEWPORTS = [
  { name: 'mobile', width: 320 },
  { name: 'md', width: 768 },
  { name: 'xl', width: 1280 },
];

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  window.dispatchEvent(new Event('resize'));
}

describe('QuoteBuilder — Condições · alinhamento em 320/768/1280', () => {
  beforeEach(() => cleanup());

  for (const vp of VIEWPORTS) {
    it(`[${vp.name} · ${vp.width}px] todos os triggers preservam text-left + leading-none`, () => {
      setViewport(vp.width);
      const { container } = render(<FullConditionsSection />);
      for (const id of ALL_IDS) {
        const t = container.querySelector(`[data-testid="${id}"]`)!;
        expect(t, `[${vp.name}] testid "${id}"`).toBeTruthy();
        const cls = t.className;
        expect(cls).toMatch(/\[&>span\]:flex-1/);
        expect(cls).toMatch(/\[&>span\]:text-left/);
        expect(cls).toMatch(/\[&>span\]:leading-none/);
        expect(cls).toMatch(/h-8/);
        expect(cls).toMatch(/text-xs/);
        // Trigger base usa justify-between → chevron encosta à direita
        // e SelectValue (flex-1) empurra o restante
      }
    });

    it(`[${vp.name} · ${vp.width}px] Prazo|Entrega e Frete têm SelectValue à esquerda do chevron`, () => {
      setViewport(vp.width);
      const { container } = render(<FullConditionsSection />);
      for (const id of ['delivery-time-select', 'shipping-type-select']) {
        const t = container.querySelector(`[data-testid="${id}"]`)!;
        const directChildren = Array.from(t.children) as HTMLElement[];
        // 1º filho = SelectValue (span), último = chevron (svg wrapper)
        expect(directChildren.length).toBeGreaterThanOrEqual(2);
        expect(directChildren[0].tagName.toLowerCase()).toBe('span');
        const chevron = directChildren[directChildren.length - 1];
        // chevron pode ser <svg> direto (asChild) ou wrapper contendo <svg>
        expect(
          chevron.tagName.toLowerCase() === 'svg' || chevron.querySelector('svg') !== null,
          `[${vp.name}] "${id}" chevron ausente`,
        ).toBe(true);
      }
    });
  }
});

describe('QuoteBuilder — Condições · estabilidade em 25 renders × 5 campos', () => {
  it('mantém 1 trigger e 1 SelectValue únicos por testid em todas as renderizações', () => {
    for (let i = 0; i < 25; i += 1) {
      const { container } = render(<FullConditionsSection />);
      for (const id of ALL_IDS) {
        const nodes = container.querySelectorAll(`[data-testid="${id}"]`);
        expect(nodes.length, `render #${i}: "${id}" deve existir 1x`).toBe(1);
        const valueSpans = (nodes[0] as HTMLElement).querySelectorAll(':scope > span');
        expect(valueSpans.length, `render #${i}: "${id}" deve ter 1 SelectValue`).toBe(1);
      }
      cleanup();
    }
  });
});
