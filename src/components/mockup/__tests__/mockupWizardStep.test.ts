/**
 * Testes unitários — getMockupWizardStep
 *
 * Cobre todos os 6 passos do wizard de geração de mockup:
 *   Passo 1 — estado inicial (nada selecionado)
 *   Passo 2 — cliente selecionado
 *   Passo 3 — produto selecionado
 *   Passo 4 — técnica selecionada
 *   Passo 5 — logo adicionado (mas não posicionado)
 *   Passo 6 — logo posicionado (ou mockup gerado)
 *
 * Invariantes:
 *   - hasGenerated sempre retorna 6 independente do resto
 *   - hasLogo + hasPositioned retorna 6 (ready to generate)
 *   - hasLogo sem hasPositioned retorna 5
 */
import { describe, it, expect } from 'vitest';
import { getMockupWizardStep, type MockupWizardStepState } from '../mockupWizardStep';

const BASE: MockupWizardStepState = {
  hasClient: false,
  hasProduct: false,
  hasTechnique: false,
  hasLogo: false,
  hasPositioned: false,
  hasGenerated: false,
};

describe('getMockupWizardStep', () => {
  it('passo 1 — estado inicial vazio', () => {
    expect(getMockupWizardStep(BASE)).toBe(1);
  });

  it('passo 2 — cliente presente', () => {
    expect(getMockupWizardStep({ ...BASE, hasClient: true })).toBe(2);
  });

  it('passo 3 — produto presente (cliente implícito)', () => {
    expect(getMockupWizardStep({ ...BASE, hasClient: true, hasProduct: true })).toBe(3);
  });

  it('passo 3 — produto sem cliente (ainda é passo 3 — produto domina)', () => {
    expect(getMockupWizardStep({ ...BASE, hasProduct: true })).toBe(3);
  });

  it('passo 4 — técnica presente', () => {
    expect(
      getMockupWizardStep({ ...BASE, hasClient: true, hasProduct: true, hasTechnique: true }),
    ).toBe(4);
  });

  it('passo 5 — logo adicionado sem posicionamento', () => {
    expect(
      getMockupWizardStep({
        ...BASE,
        hasClient: true,
        hasProduct: true,
        hasTechnique: true,
        hasLogo: true,
      }),
    ).toBe(5);
  });

  it('passo 6 — logo posicionado (pronto para gerar)', () => {
    expect(
      getMockupWizardStep({
        ...BASE,
        hasClient: true,
        hasProduct: true,
        hasTechnique: true,
        hasLogo: true,
        hasPositioned: true,
      }),
    ).toBe(6);
  });

  it('passo 6 — hasGenerated=true sobrepõe tudo (estado pós-geração)', () => {
    expect(getMockupWizardStep({ ...BASE, hasGenerated: true })).toBe(6);
  });

  it('hasGenerated=true mesmo com tudo false retorna 6', () => {
    expect(getMockupWizardStep({ ...BASE, hasGenerated: true })).toBe(6);
  });

  it('hasPositioned sem hasLogo não avança além do esperado (logo domina)', () => {
    // hasPositioned sozinho não conta — logo ainda não foi adicionado
    expect(
      getMockupWizardStep({
        ...BASE,
        hasClient: true,
        hasProduct: true,
        hasTechnique: true,
        hasPositioned: true,
      }),
    ).toBe(4);
  });
});
