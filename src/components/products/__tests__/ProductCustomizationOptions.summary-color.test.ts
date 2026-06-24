/**
 * Regressão visual estática: garante que o card "Resumo das Configurações"
 * use os tokens semânticos do design system (verde / `success`) e não volte
 * para `primary` (azul) em mudanças futuras.
 *
 * Snapshot via leitura do source — evita custo de DOM/Playwright e mantém
 * o gate barato no CI.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FILE = resolve(__dirname, '../ProductCustomizationOptions.tsx');
const source = readFileSync(FILE, 'utf8');

// Janela do bloco "Resumo das Configurações"
const start = source.indexOf('Resumo das Configurações');
const block = source.slice(start - 400, start + 2000);

describe('ProductCustomizationOptions — Resumo das Configurações (cor verde)', () => {
  it('usa tokens success (bullet, borda, fundo, label e total)', () => {
    expect(block).toContain('bg-success');
    expect(block).toContain('border-success/20');
    expect(block).toContain('bg-success/5');
    expect(block).toContain('text-success');
    // Pelo menos 2 ocorrências de text-success (label do local + valor total)
    expect((block.match(/text-success\b/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('não regrediu para tokens primary (azul) no bloco do resumo', () => {
    expect(block).not.toMatch(/border-primary\/10\b/);
    expect(block).not.toMatch(/bg-primary\/5\b/);
    // Bullet do header e total devem ser success, não primary
    expect(block).not.toMatch(/<div className="h-1\.5 w-1\.5 rounded-full bg-primary"/);
  });
});
