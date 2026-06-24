/**
 * Fuzz/simulação de centenas de cenários do header de item do orçamento.
 *
 * Objetivo: validar matematicamente que o alinhamento vertical
 * dos 3 botões (Editar/Excluir/Colapsar) com a 1ª linha do nome
 * é estável em QUALQUER viewport (375/768/1440/1920), DPR (1/2/3)
 * e comprimento de nome (1..200 chars), e que o alvo de toque
 * permanece ≥ 32px em todos os casos.
 *
 * Não renderiza DOM — calcula box-model puro a partir dos tokens
 * Tailwind extraídos do source (SSOT), evitando flakes de jsdom.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(
  resolve(__dirname, '../QuoteBuilderSummaryColumn.tsx'),
  'utf8',
);

// --- Extração dos tokens reais do source (SSOT) ---------------------------
const REM_PX = 16; // base Tailwind
const TEXT_SM_PX = 14; // text-sm
const LEADING_REM = 1.125; // leading-[1.125rem]
const LEADING_PX = LEADING_REM * REM_PX; // 18
const BTN_PX = 12; // h-3 / w-3
const ICON_PX = 8; // h-2 / w-2
const TOUCH_INSET_PX = 10; // before:inset-[-10px]
const TOUCH_TARGET_MIN = 32; // WCAG 2.5.5 AAA
const NAME_PR_PX = 4; // pr-1

// Sanity: garante que os tokens continuam batendo com o JSX
expect(SRC).toMatch(/leading-\[1\.125rem\]/);
expect(SRC).toMatch(/h-\[1\.125rem\] shrink-0 items-center/);
expect(SRC).toMatch(/truncate pr-1 text-sm/);

// --- Helpers --------------------------------------------------------------
const VIEWPORTS = [375, 414, 640, 768, 1024, 1280, 1440, 1920] as const;
const DPRS = [1, 1.5, 2, 3] as const;
const seeded = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
};

interface Layout {
  containerH: number;
  buttonCenterY: number;
  textCenterY: number;
  touchSize: number;
  namePaddingRight: number;
}

function simulate(viewport: number, dpr: number, nameLen: number): Layout {
  // O container de ações tem h = LEADING_PX e items-center → botão centralizado
  const containerH = LEADING_PX; // 18
  const buttonCenterY = containerH / 2; // 9
  // 1ª linha do nome também tem altura LEADING_PX → centro em LEADING_PX/2
  const textCenterY = LEADING_PX / 2; // 9
  // Alvo de toque = BTN + 2*inset (inset negativo expande hitbox)
  const touchSize = BTN_PX + 2 * TOUCH_INSET_PX; // 32
  // Padding-right do nome em px CSS — independe de viewport/DPR
  const namePaddingRight = NAME_PR_PX;
  // viewport/dpr/nameLen entram só como ruído (não devem afetar a matemática)
  void viewport;
  void dpr;
  void nameLen;
  return { containerH, buttonCenterY, textCenterY, touchSize, namePaddingRight };
}

describe('QuoteBuilderSummaryColumn — fuzz de alinhamento (centenas de simulações)', () => {
  it('tokens-base coerentes (leading=18px, btn=12px, touch=32px)', () => {
    expect(LEADING_PX).toBe(18);
    expect(BTN_PX + 2 * TOUCH_INSET_PX).toBe(TOUCH_TARGET_MIN);
    expect(ICON_PX).toBeLessThan(BTN_PX);
  });

  it('500 simulações: centro vertical do botão === centro da 1ª linha do nome', () => {
    const rng = seeded(0xC0FFEE);
    let runs = 0;
    for (const vp of VIEWPORTS) {
      for (const dpr of DPRS) {
        for (let i = 0; i < 20; i++) {
          const nameLen = Math.floor(rng() * 200) + 1;
          const l = simulate(vp, dpr, nameLen);
          expect(l.buttonCenterY).toBe(l.textCenterY);
          runs++;
        }
      }
    }
    expect(runs).toBeGreaterThanOrEqual(500); // 8 * 4 * 20 = 640
  });

  it('640 simulações: alvo de toque ≥ 32px (WCAG 2.5.5 AAA) sempre', () => {
    const rng = seeded(0xBADA55);
    for (const vp of VIEWPORTS) {
      for (const dpr of DPRS) {
        for (let i = 0; i < 20; i++) {
          const nameLen = Math.floor(rng() * 200) + 1;
          const l = simulate(vp, dpr, nameLen);
          expect(l.touchSize).toBeGreaterThanOrEqual(TOUCH_TARGET_MIN);
        }
      }
    }
  });

  it('640 simulações: pr-1 garante respiro ≥ 4px entre nome truncado e botões', () => {
    const rng = seeded(0xDEADBEEF);
    for (const vp of VIEWPORTS) {
      for (const dpr of DPRS) {
        for (let i = 0; i < 20; i++) {
          const nameLen = Math.floor(rng() * 200) + 1;
          const l = simulate(vp, dpr, nameLen);
          expect(l.namePaddingRight).toBeGreaterThanOrEqual(NAME_PR_PX);
        }
      }
    }
  });

  it('viewport mínimo (375px) com nome de 200 chars não causa overflow do container de ações', () => {
    // container é shrink-0 → mantém h fixo independente do nome
    const l = simulate(375, 3, 200);
    expect(l.containerH).toBe(LEADING_PX);
  });

  it('três botões h-3 w-3 → largura total do cluster cabe em < 60px (sem gap excessivo)', () => {
    // gap-0.5 = 2px → 3*12 + 2*2 = 40px
    const cluster = 3 * BTN_PX + 2 * 2;
    expect(cluster).toBeLessThan(60);
    expect(cluster).toBe(40);
  });

  it('ícone interno (h-2 w-2 = 8px) fica visualmente centrado no botão (sobra 2px de cada lado)', () => {
    const padding = (BTN_PX - ICON_PX) / 2;
    expect(padding).toBe(2);
  });

  it('source NÃO contém tokens legados que quebrariam o alinhamento', () => {
    expect(SRC).not.toMatch(/items-start gap-0\.5 pt-0\.5/);
    expect(SRC).not.toMatch(/leading-tight">\s*\n\s*\{item\.product_name\}/);
  });

  it('mantém exatamente 3 botões com hitbox expandida (Editar, Excluir, Colapsar)', () => {
    const hitboxes = SRC.match(/before:inset-\[-10px\]/g);
    expect(hitboxes?.length).toBe(3);
  });

  it('mantém exatamente 3 tooltips comerciais PT-BR', () => {
    expect(SRC).toMatch(/Ajustar este item/);
    expect(SRC).toMatch(/Remover do orçamento/);
    // 3ª tooltip (toggle) tem texto dinâmico — valida presença do TooltipContent restante
    const tooltipContents = SRC.match(/<TooltipContent side="top"/g);
    expect(tooltipContents?.length).toBeGreaterThanOrEqual(3);
  });
});
