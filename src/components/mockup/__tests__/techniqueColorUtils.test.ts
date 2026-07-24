/**
 * Testes unitários — techniqueColorUtils
 *
 * Cobre:
 *   - classifyTechnique: detecção de laser, laser UV (→ digital), serigrafia,
 *     digital, other; baseado em nome, código ou ambos; valores edge-case.
 *   - techniqueNeedsColorConfig: laser e serigrafia precisam de config de cor,
 *     digital e other não.
 */
import { describe, it, expect } from 'vitest';
import { classifyTechnique, techniqueNeedsColorConfig } from '../techniqueColorUtils';

// ── classifyTechnique ─────────────────────────────────────────────────────────
describe('classifyTechnique', () => {
  // ── laser ─────────────────────────────────────────────────────────────────
  it('detecta "laser" pelo nome', () => {
    expect(classifyTechnique('Laser Fibra')).toBe('laser');
  });

  it('detecta "fibra" pelo nome', () => {
    expect(classifyTechnique('Gravação por Fibra')).toBe('laser');
  });

  it('detecta "co2" pelo código', () => {
    expect(classifyTechnique(undefined, 'CO2-001')).toBe('laser');
  });

  it('detecta "laser" case-insensitive', () => {
    expect(classifyTechnique('LASER YTTI')).toBe('laser');
  });

  // ── laser UV → digital (exceção explícita) ────────────────────────────────
  it('Laser UV é classificado como digital (não laser)', () => {
    expect(classifyTechnique('Laser UV Colorido')).toBe('digital');
  });

  it('UV Laser (ordem invertida) também é digital', () => {
    expect(classifyTechnique('UV Laser Print')).toBe('digital');
  });

  // ── serigrafia ────────────────────────────────────────────────────────────
  it('detecta "serigrafia" pelo nome', () => {
    expect(classifyTechnique('Serigrafia 4 cores')).toBe('serigrafia');
  });

  it('detecta "silk" pelo código', () => {
    expect(classifyTechnique(undefined, 'SILK-2')).toBe('serigrafia');
  });

  it('detecta "tampografia"', () => {
    expect(classifyTechnique('Tampografia Monocor')).toBe('serigrafia');
  });

  // ── digital ───────────────────────────────────────────────────────────────
  it('detecta "digital" pelo nome', () => {
    expect(classifyTechnique('Impressão Digital Direta')).toBe('digital');
  });

  it('detecta "uv" genérico (sem laser) como digital', () => {
    expect(classifyTechnique('Impressão UV')).toBe('digital');
  });

  it('detecta "sublima" (sublimação)', () => {
    expect(classifyTechnique('Sublimação Têxtil')).toBe('digital');
  });

  it('detecta "dtf"', () => {
    expect(classifyTechnique('DTF Transfer')).toBe('digital');
  });

  it('detecta "transfer"', () => {
    expect(classifyTechnique('Transfer Digital')).toBe('digital');
  });

  // ── other ─────────────────────────────────────────────────────────────────
  it('retorna other quando nome e código são undefined', () => {
    expect(classifyTechnique(undefined, undefined)).toBe('other');
  });

  it('retorna other quando string vazia', () => {
    expect(classifyTechnique('')).toBe('other');
  });

  it('retorna other para técnica não reconhecida', () => {
    expect(classifyTechnique('Bordado')).toBe('other');
  });

  it('retorna other para "Gravação a Fogo"', () => {
    expect(classifyTechnique('Gravação a Fogo')).toBe('other');
  });

  // ── combinação nome + código ──────────────────────────────────────────────
  it('combina nome e código na detecção', () => {
    // código diz "SER" mas nome bate com serigrafia via nome
    expect(classifyTechnique('Serigrafia', 'SER-01')).toBe('serigrafia');
  });

  it('código domina quando nome não tem informação', () => {
    expect(classifyTechnique('Técnica Especial', 'DTF-03')).toBe('digital');
  });
});

// ── techniqueNeedsColorConfig ─────────────────────────────────────────────────
describe('techniqueNeedsColorConfig', () => {
  it('laser precisa de config de cor', () => {
    expect(techniqueNeedsColorConfig('Laser CO2')).toBe(true);
  });

  it('serigrafia precisa de config de cor', () => {
    expect(techniqueNeedsColorConfig('Serigrafia')).toBe(true);
  });

  it('digital NÃO precisa de config de cor', () => {
    expect(techniqueNeedsColorConfig('Impressão Digital')).toBe(false);
  });

  it('other NÃO precisa de config de cor', () => {
    expect(techniqueNeedsColorConfig('Bordado')).toBe(false);
  });

  it('undefined/undefined NÃO precisa de config de cor', () => {
    expect(techniqueNeedsColorConfig()).toBe(false);
  });

  it('Laser UV NÃO precisa (→ digital)', () => {
    expect(techniqueNeedsColorConfig('Laser UV')).toBe(false);
  });
});
