/**
 * Regras de validação por step do editor de Magazine.
 * Cada step reporta bloqueios (impedem avançar) e avisos (permitem avançar).
 *
 * PhD-level null safety:
 * - All field accesses use optional chaining / nullish coalescing
 * - Handles legacy schemas where branding or content may be null
 */

import type { Magazine } from '@/types/magazine';

export type StepId = 'content' | 'design' | 'identity' | 'layout' | 'products';

export interface StepValidation {
  blocks: string[];
  warnings: string[];
}

export function validateStep(step: StepId, m: Magazine): StepValidation {
  const blocks: string[] = [];
  const warnings: string[] = [];

  if (step === 'identity') {
    // FIX: null-safe title access — legacy rows may have null title
    const title = (m.title ?? '').trim();
    if (!title) blocks.push('Defina um título para a revista.');

    // FIX: optional chaining on branding — schema migration may leave branding null
    const logoUrl = m.branding?.clientLogoUrl;
    if (logoUrl && !/^https?:\/\//.test(logoUrl)) {
      warnings.push('URL do logo do cliente parece inválida.');
    }
  }

  if (step === 'products') {
    // FIX: null-safe items access
    const itemCount = (m.items ?? []).length;
    if (itemCount === 0) blocks.push('Adicione ao menos um produto.');
    if (itemCount === 1) warnings.push('Revistas com um só produto viram uma one-pager.');
  }

  if (step === 'design' || step === 'layout') {
    // FIX: null-safe items access
    if ((m.items ?? []).length === 0) blocks.push('Adicione produtos antes de escolher o design.');
  }

  return { blocks, warnings };
}

export function canPublish(m: Magazine): boolean {
  // FIX: null-safe title + items — prevents crash when magazine is partially hydrated
  const hasTitle = (m.title ?? '').trim().length > 0;
  const hasProducts = (m.items ?? []).length > 0;
  return hasTitle && hasProducts;
}

/**
 * getCompletionPercentage — step completion as 0–100.
 * Used for progress indicators.
 */
export function getCompletionPercentage(m: Magazine): number {
  let completed = 0;
  const total = 5;

  const hasTitle = (m.title ?? '').trim().length > 0;
  const itemsCount = (m.items ?? []).length;

  if (hasTitle) completed++;
  if (itemsCount > 0) completed++;
  if (m.content?.introText || m.content?.closingText) completed++;
  // templateId só conta se a revista já tem título — evita 20% para revista vazia
  if (m.templateId && hasTitle) completed++;
  if (itemsCount >= 2) completed++;

  return Math.round((completed / total) * 100);
}
