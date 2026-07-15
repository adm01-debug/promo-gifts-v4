import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Contrato AST-lite: garante que os três SelectTriggers da seção "Condições"
 * (Validade | Proposta, Forma | Pagamento, Prazo | Pagamento) alinham o texto
 * à esquerda via `[&>span]:flex-1 [&>span]:text-left` e mantêm data-testid
 * estáveis e únicos.
 */
const SOURCE = readFileSync(
  resolve(__dirname, '../QuoteBuilderPage.tsx'),
  'utf8',
);

describe('QuoteBuilder — Condições · alinhamento à esquerda', () => {
  it('SelectTrigger de Validade | Proposta tem text-left no SelectValue', () => {
    const match = /Validade \| Proposta[\s\S]{0,1200}?<SelectTrigger[^>]*className=(?:"([^"]+)"|\{[^}]*"([^"]+)"[^}]*\})/.exec(SOURCE);
    expect(match, 'SelectTrigger de Validade não encontrado').toBeTruthy();
    const cls = (match?.[1] ?? match?.[2] ?? '') as string;
    expect(cls).toMatch(/\[&>span\]:flex-1/);
    expect(cls).toMatch(/\[&>span\]:text-left/);
  });

  it('SelectTrigger de Forma | Pagamento tem text-left no SelectValue', () => {
    const match = /Forma \| Pagamento[\s\S]{0,1600}?data-testid="payment-method-select"[\s\S]{0,400}?className=\{cn\(\s*'([^']+)'/.exec(SOURCE);
    expect(match, 'SelectTrigger de Forma não encontrado').toBeTruthy();
    expect(match![1]).toMatch(/\[&>span\]:flex-1/);
    expect(match![1]).toMatch(/\[&>span\]:text-left/);
  });

  it('SelectTrigger de Prazo | Pagamento tem text-left no SelectValue', () => {
    const match = /Prazo \| Pagamento[\s\S]{0,1600}?data-testid="payment-terms-select"[\s\S]{0,400}?className=\{cn\(\s*'([^']+)'/.exec(SOURCE);
    expect(match, 'SelectTrigger de Prazo não encontrado').toBeTruthy();
    expect(match![1]).toMatch(/\[&>span\]:flex-1/);
    expect(match![1]).toMatch(/\[&>span\]:text-left/);
  });

  it('data-testids dos campos de Condições permanecem estáveis e únicos', () => {
    const ids = [
      'payment-method-select-root',
      'payment-method-select',
      'payment-terms-select-root',
      'payment-terms-select',
    ];
    for (const id of ids) {
      const occurrences = SOURCE.split(`data-testid="${id}"`).length - 1;
      expect(occurrences, `data-testid "${id}" deve aparecer exatamente 1x`).toBe(1);
    }
  });

  it('labels "Validade | Proposta", "Forma | Pagamento" e "Prazo | Pagamento" não estão duplicados', () => {
    expect(SOURCE.split('Validade | Proposta').length - 1).toBeLessThanOrEqual(2);
    expect(SOURCE.split('Forma | Pagamento').length - 1).toBeLessThanOrEqual(2);
    expect(SOURCE.split('Prazo | Pagamento').length - 1).toBeLessThanOrEqual(2);
  });
});
