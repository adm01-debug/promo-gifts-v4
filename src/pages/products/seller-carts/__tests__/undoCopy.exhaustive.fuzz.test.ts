/**
 * Fuzz exaustivo (property-based) do SSOT de copy do fluxo "Desfazer".
 *
 * Roda ~6.500 cenários randômicos cobrindo:
 *   • `bulkRestoreSummary(attempted, restored)` — invariantes de tom, msg e clamp
 *   • `deletedToastTitle` / `deleteConfirmDialogTitle` / `confirmDialogConfirmLabel`
 *   • `itemRemovedToastTitle` — sanitização de nome
 *
 * Invariantes (sempre verdadeiros, para QUALQUER entrada — inclusive adversarial):
 *   I1) Nenhuma copy visível pode conter as substrings tóxicas
 *       "NaN", "undefined", "Infinity", "null" ou ponto flutuante ("1.5").
 *   I2) `tone` de `bulkRestoreSummary` é consistente:
 *        - 'success' ⇔ restored===attempted && attempted>0 (após clamp)
 *        - 'warning' ⇔ 0 < restored < attempted (após clamp)
 *        - 'error'   ⇔ restored===0
 *   I3) Singular/plural coerente com o count normalizado (n<=1 vs n>1).
 *   I4) `itemRemovedToastTitle` sempre termina com " removido" e nunca é apenas " removido".
 *
 * Se qualquer invariante quebrar, o teste imprime o shrinking mínimo — Ph.D. debug.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { bulkRestoreSummary } from '../bulkRestoreSummary';
import {
  deletedToastTitle,
  deleteConfirmDialogTitle,
  deleteConfirmDialogDescription,
  confirmDialogConfirmLabel,
  itemRemovedToastTitle,
} from '../undoCopy';

const TOXIC = /(NaN|undefined|Infinity|\bnull\b)/;
const HAS_DECIMAL_NUMBER = /\d+\.\d+/;

/** Arbitrary que gera contagens realistas + adversariais (NaN, Infinity, negativos, fracionários, gigantes). */
const adversarialCount = fc.oneof(
  { arbitrary: fc.integer({ min: 0, max: 500 }), weight: 6 },
  { arbitrary: fc.integer({ min: -100, max: -1 }), weight: 1 },
  { arbitrary: fc.double({ min: -10, max: 500, noNaN: false }), weight: 2 },
  { arbitrary: fc.constantFrom(NaN, Infinity, -Infinity, 0, 1, 2), weight: 2 },
);

function normalize(v: number): number {
  if (!Number.isFinite(v)) return 0;
  const n = Math.floor(v);
  return n < 0 ? 0 : n;
}

describe('undoCopy — Fuzz exaustivo (1500× por propriedade)', () => {
  it('I1) copy nunca contém tokens tóxicos (NaN/undefined/Infinity/null/decimal)', () => {
    fc.assert(
      fc.property(adversarialCount, (c) => {
        const outs = [
          deletedToastTitle(c),
          deleteConfirmDialogTitle(c),
          deleteConfirmDialogDescription(c),
          confirmDialogConfirmLabel(c),
        ];
        for (const s of outs) {
          expect(typeof s).toBe('string');
          expect(s, `copy=${s} count=${c}`).not.toMatch(TOXIC);
          expect(s, `copy=${s} count=${c}`).not.toMatch(HAS_DECIMAL_NUMBER);
        }
      }),
      { numRuns: 1500, seed: 0xDEADBEEF },
    );
  });

  it('I3) singular/plural coerente com o count normalizado', () => {
    fc.assert(
      fc.property(adversarialCount, (c) => {
        const n = normalize(c);
        const t = deletedToastTitle(c);
        if (n <= 1) {
          expect(t).toBe('Carrinho excluído');
        } else {
          expect(t).toBe(`${n} carrinhos excluídos`);
        }
        const dlg = deleteConfirmDialogTitle(c);
        if (n <= 1) expect(dlg).toBe('Excluir carrinho?');
        else expect(dlg).toBe(`Excluir ${n} carrinhos?`);
      }),
      { numRuns: 1500, seed: 0xDEADBEEF + 1 },
    );
  });
});

describe('bulkRestoreSummary — Fuzz exaustivo (2000× × 2 propriedades)', () => {
  it('I1+I2) tom coerente + copy sem tokens tóxicos, para qualquer par (attempted, restored)', () => {
    fc.assert(
      fc.property(adversarialCount, adversarialCount, (attempted, restored) => {
        const s = bulkRestoreSummary(attempted, restored);
        // Copy sanitizada
        expect(s.message).not.toMatch(TOXIC);
        expect(s.message).not.toMatch(HAS_DECIMAL_NUMBER);

        // Tom coerente com os valores normalizados
        const a = normalize(attempted);
        const r = Math.min(normalize(restored), a);
        if (a === 0 || r === 0) {
          expect(s.tone, `a=${a} r=${r}`).toBe('error');
        } else if (r === a) {
          expect(s.tone, `a=${a} r=${r}`).toBe('success');
        } else {
          expect(s.tone, `a=${a} r=${r}`).toBe('warning');
        }
      }),
      { numRuns: 2000, seed: 0xC0FFEE },
    );
  });

  it('clamp defensivo: restored > attempted nunca produz mensagem inconsistente', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 0, max: 500 }),
        (attempted, restored) => {
          // Força cenário over-restore (restored >= attempted)
          const s = bulkRestoreSummary(attempted, Math.max(restored, attempted));
          if (attempted === 0) {
            expect(s.tone).toBe('error');
          } else {
            // clamp faz restored <= attempted → sempre 'success' quando attempted>0
            expect(s.tone).toBe('success');
            expect(s.message).not.toMatch(/falhou/);
          }
        },
      ),
      { numRuns: 1000, seed: 0xC0FFEE + 1 },
    );
  });
});

describe('itemRemovedToastTitle — Fuzz adversarial (500×)', () => {
  it('I4) sempre termina com " removido" e sanitiza nomes vazios/whitespace', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 200 }), (name) => {
        const out = itemRemovedToastTitle(name);
        expect(out.endsWith(' removido')).toBe(true);
        // Nunca "  removido" (dois espaços) e nunca começa com espaço
        expect(out.startsWith(' ')).toBe(false);
        // Se nome era só whitespace/vazio, fallback é "Item"
        if (!name.trim()) {
          expect(out).toBe('Item removido');
        } else {
          expect(out).toBe(`${name.trim()} removido`);
        }
      }),
      { numRuns: 500, seed: 0xBADC0DE },
    );
  });

  it('lida com Unicode/emoji/RTL/NBSP sem quebrar', () => {
    const adversarial = fc
      .array(
        fc.constantFrom(
          'a', 'Ç', '💥', '\u00A0', '\u200B', '\u202E', '中', '𝕏', '\n', '\t',
        ),
        { maxLength: 20 },
      )
      .map((arr) => arr.join(''));
    fc.assert(
      fc.property(adversarial, (name) => {
        const out = itemRemovedToastTitle(name);
        expect(out).toMatch(/removido$/);
        expect(out).not.toMatch(TOXIC);
      }),
      { numRuns: 300, seed: 0xBADC0DE + 1 },
    );
  });
});
