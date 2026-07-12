/**
 * Regras de validação por step do editor de Magazine.
 * Cada step reporta bloqueios (impedem avançar) e avisos (permitem avançar).
 */

import type { Magazine } from '@/types/magazine';

export type StepId = 'identity' | 'products' | 'content' | 'design' | 'layout';

export interface StepValidation {
  blocks: string[];
  warnings: string[];
}

export function validateStep(step: StepId, m: Magazine): StepValidation {
  const blocks: string[] = [];
  const warnings: string[] = [];

  if (step === 'identity') {
    if (!m.title.trim()) blocks.push('Defina um título para a revista.');
    if (m.branding.clientLogoUrl && !/^https?:\/\//.test(m.branding.clientLogoUrl)) {
      warnings.push('URL do logo do cliente parece inválida.');
    }
  }

  if (step === 'products') {
    if (m.items.length === 0) blocks.push('Adicione ao menos um produto.');
    if (m.items.length === 1) warnings.push('Revistas com um só produto viram uma one-pager.');
  }

  if (step === 'design' || step === 'layout') {
    if (m.items.length === 0) blocks.push('Adicione produtos antes de escolher o design.');
  }

  return { blocks, warnings };
}

export function canPublish(m: Magazine): boolean {
  return m.title.trim().length > 0 && m.items.length > 0;
}
