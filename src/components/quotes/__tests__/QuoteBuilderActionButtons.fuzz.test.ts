/**
 * Fuzz/simulação exaustiva (300 cenários) das invariantes usadas pelos
 * Playwright specs do par de botões Criar/Rascunho:
 *
 *  1. Geometria "lado a lado": tops alinhados ±4px, alturas ±2px, Criar à
 *     esquerda, larguras ±8px.
 *  2. Detecção de baseline visual ausente (regex usada no spec visual).
 *
 * Roda em vitest — não precisa de browser. Garante que as tolerâncias não
 * estão nem frouxas demais (deixariam regressão passar) nem rígidas demais
 * (falso positivo por sub-pixel rendering).
 */
import { describe, it, expect } from 'vitest';

interface Box { x: number; y: number; width: number; height: number }

/** Espelha exatamente assertSideBySide() das specs. */
function isSideBySide(c: Box, r: Box): { ok: boolean; reason?: string } {
  if (Math.abs(c.y - r.y) > 4) return { ok: false, reason: 'tops' };
  if (Math.abs(c.height - r.height) > 2) return { ok: false, reason: 'heights' };
  if (c.x >= r.x) return { ok: false, reason: 'order' };
  if (Math.abs(c.width - r.width) > 8) return { ok: false, reason: 'widths' };
  return { ok: true };
}

/** Espelha o regex do detector de baseline ausente no spec visual. */
const BASELINE_MISSING_RE = /snapshot.*(doesn't|does not) exist|missing/i;

// PRNG determinístico (mulberry32) para reproducibilidade dos 300 casos.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('Quote Summary action buttons — invariantes geométricas (fuzz 300x)', () => {
  const rand = rng(20260624);

  it('300 layouts VÁLIDOS gerados aleatoriamente passam em isSideBySide', () => {
    const failures: Array<{ i: number; c: Box; r: Box; reason?: string }> = [];
    for (let i = 0; i < 300; i++) {
      const baseY = Math.floor(rand() * 2000);
      const baseH = 36 + Math.floor(rand() * 24); // 36–60px (sm/lg buttons)
      const baseW = 80 + Math.floor(rand() * 220); // 80–300px (~ metade do col)
      // jitters dentro da tolerância
      const dy = (rand() - 0.5) * 8;      // ±4
      const dh = (rand() - 0.5) * 4;      // ±2
      const dw = (rand() - 0.5) * 16;     // ±8
      const gap = 4 + Math.floor(rand() * 12); // 4–16px

      const c: Box = { x: 100, y: baseY, width: baseW, height: baseH };
      const r: Box = {
        x: 100 + baseW + gap,
        y: baseY + dy,
        width: baseW + dw,
        height: baseH + dh,
      };
      const res = isSideBySide(c, r);
      if (!res.ok) failures.push({ i, c, r, reason: res.reason });
    }
    expect(failures, JSON.stringify(failures.slice(0, 3))).toHaveLength(0);
  });

  it('300 layouts INVÁLIDOS gerados aleatoriamente falham em isSideBySide', () => {
    const passed: number[] = [];
    for (let i = 0; i < 300; i++) {
      const baseY = 500;
      const baseH = 48;
      const baseW = 200;
      // Força UMA quebra aleatória.
      const kind = i % 4;
      let c: Box = { x: 100, y: baseY, width: baseW, height: baseH };
      let r: Box = { x: 320, y: baseY, width: baseW, height: baseH };
      if (kind === 0) r.y = baseY + 30;                  // tops desalinhados
      if (kind === 1) r.height = baseH + 20;             // alturas diferentes
      if (kind === 2) r.x = 50;                          // Criar não está à esquerda
      if (kind === 3) r.width = baseW + 60;              // larguras desbalanceadas
      const res = isSideBySide(c, r);
      if (res.ok) passed.push(i);
    }
    expect(passed).toHaveLength(0);
  });

  it('borda da tolerância: ±4px y, ±2px h, ±8px w aceitos; +1 unidade rejeita', () => {
    const c: Box = { x: 0, y: 100, width: 200, height: 48 };
    // Limites aceitos
    expect(isSideBySide(c, { x: 210, y: 104, width: 208, height: 50 }).ok).toBe(true);
    expect(isSideBySide(c, { x: 210, y: 96,  width: 192, height: 46 }).ok).toBe(true);
    // +1 unidade além → rejeita
    expect(isSideBySide(c, { x: 210, y: 105, width: 200, height: 48 }).ok).toBe(false);
    expect(isSideBySide(c, { x: 210, y: 100, width: 200, height: 51 }).ok).toBe(false);
    expect(isSideBySide(c, { x: 210, y: 100, width: 209, height: 48 }).ok).toBe(false);
    // Mesmo x (empilhados) rejeita
    expect(isSideBySide(c, { x: 0,   y: 100, width: 200, height: 48 }).ok).toBe(false);
  });
});

describe('Detector de baseline visual ausente — regex', () => {
  const POSITIVE = [
    `Error: A snapshot doesn't exist at /foo/summary-action-buttons-mobile-375.png`,
    `snapshot does not exist`,
    `Error: missing snapshot`,
    `SNAPSHOT DOESN'T EXIST`,
  ];
  const NEGATIVE = [
    `Screenshot comparison failed: 142 pixels (ratio 0.03) are different`,
    `Timeout 5000ms exceeded`,
    `expect(received).toHaveScreenshot(expected)`,
    `Error: locator.click: Target closed`,
    ``,
  ];

  it.each(POSITIVE)('detecta como baseline ausente: %s', (msg) => {
    expect(BASELINE_MISSING_RE.test(msg)).toBe(true);
  });

  it.each(NEGATIVE)('NÃO detecta como baseline ausente: %s', (msg) => {
    expect(BASELINE_MISSING_RE.test(msg)).toBe(false);
  });

  it('100 mensagens fuzz: nenhuma falsa identificação contendo apenas "diff"/"pixel"', () => {
    const rand = rng(42);
    const tokens = ['diff', 'pixel', 'ratio', 'timeout', 'click', 'visible', 'attached'];
    for (let i = 0; i < 100; i++) {
      const parts = Array.from({ length: 3 + Math.floor(rand() * 4) },
        () => tokens[Math.floor(rand() * tokens.length)]);
      const msg = `Error: ${parts.join(' ')} ${Math.floor(rand() * 9999)}`;
      expect(BASELINE_MISSING_RE.test(msg)).toBe(false);
    }
  });
});
