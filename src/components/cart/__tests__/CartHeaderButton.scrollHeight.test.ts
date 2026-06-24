/**
 * Unit · valida o cálculo da altura do ScrollArea do popover de carrinhos:
 *   h-[min(352px,calc(80vh-9rem),calc(100dvh-9rem))]
 *
 * 9rem = 144px (rem=16). O ScrollArea NUNCA pode ultrapassar nem o teto de
 * 352px (desktop), nem 80vh-144px, nem 100dvh-144px. E nunca deve ser <= 0.
 */
import { describe, it, expect } from 'vitest';

const REM = 16;
const HARD_CAP_PX = 352;
const RESERVED_REM = 9; // header + footer + paddings reservados
const RESERVED_PX = RESERVED_REM * REM; // 144

function scrollAreaHeight(vhPx: number, dvhPx: number): number {
  const c1 = HARD_CAP_PX;
  const c2 = 0.8 * vhPx - RESERVED_PX;
  const c3 = dvhPx - RESERVED_PX;
  return Math.min(c1, c2, c3);
}

describe('CartHeaderButton · ScrollArea height formula', () => {
  it('desktop alto (1080) usa o teto de 352px', () => {
    expect(scrollAreaHeight(1080, 1080)).toBe(352);
  });

  it('mobile 812 (iPhone) limita por 80vh-9rem', () => {
    // 0.8*812 - 144 = 649.6 - 144 = 505.6 → ainda > 352 → cap 352
    expect(scrollAreaHeight(812, 812)).toBe(352);
  });

  it('viewport curto 560 ainda preserva área útil', () => {
    // 0.8*560 - 144 = 448 - 144 = 304
    expect(scrollAreaHeight(560, 560)).toBe(304);
  });

  it('viewport curtíssimo 400 reduz para caber footer', () => {
    // 0.8*400 - 144 = 320 - 144 = 176
    expect(scrollAreaHeight(400, 400)).toBe(176);
  });

  it('dvh menor que vh (teclado virtual aberto) prevalece', () => {
    // vh=812, dvh=500 → 500-144=356 vs 0.8*812-144=505.6 vs 352 → min=352
    expect(scrollAreaHeight(812, 500)).toBe(352);
    // dvh ainda menor força corte por dvh
    // vh=812, dvh=280 → 280-144=136 vence
    expect(scrollAreaHeight(812, 280)).toBe(136);
  });

  it('nunca excede o teto absoluto de 352px em nenhum tamanho', () => {
    for (let v = 400; v <= 2160; v += 40) {
      for (const dvh of [v, v - 100, v - 200]) {
        const h = scrollAreaHeight(v, Math.max(200, dvh));
        expect(h).toBeLessThanOrEqual(352);
      }
    }
  });

  it('matriz exaustiva: resultado sempre = min dos 3 termos', () => {
    for (let vh = 320; vh <= 1600; vh += 80) {
      for (let dvh = 240; dvh <= vh; dvh += 80) {
        const h = scrollAreaHeight(vh, dvh);
        const expected = Math.min(352, 0.8 * vh - 144, dvh - 144);
        expect(h).toBeCloseTo(expected, 5);
      }
    }
  });

  it('garante que com viewport >= 405px o ScrollArea fica > 0', () => {
    // 0.8*405 - 144 = 324 - 144 = 180 > 0
    for (let vh = 405; vh <= 2000; vh += 25) {
      expect(scrollAreaHeight(vh, vh)).toBeGreaterThan(0);
    }
  });
});
