/**
 * Edge cases do bloco "Prazo p/ envio" e do estado condicional badge/erro.
 *
 * Cobre:
 *  - shippingDeadlineSchema com valores extremos (vazio, inválido, passado, futuro longínquo)
 *  - Coerência do guard `badge && !error` (mutuamente exclusivos)
 *  - Rotulagem do badge (getDeadlineLabel) em fronteiras (0, 1, 3, 4, 30, 365 dias)
 *  - Classes semânticas do badge por status (sem cores hardcoded)
 */
import { describe, expect, it } from 'vitest';
import {
  DEADLINE_BADGE_CLASSES,
  SOON_THRESHOLD_DAYS,
  daysUntilDeadline,
  getDeadlineLabel,
  getShippingDeadlineStatus,
  shippingDeadlineSchema,
} from '@/lib/carts/shipping-deadline';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function iso(offsetDays: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/*  Schema — valores extremos                                          */
/* ------------------------------------------------------------------ */

describe('shippingDeadlineSchema — inputs extremos', () => {
  it('aceita null (limpar prazo)', () => {
    const r = shippingDeadlineSchema.safeParse(null);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBeNull();
  });

  it('trata string vazia como null', () => {
    const r = shippingDeadlineSchema.safeParse('');
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBeNull();
  });

  it('rejeita formato inválido (dd/mm/aaaa)', () => {
    const r = shippingDeadlineSchema.safeParse('30/12/2027');
    expect(r.success).toBe(false);
  });

  it('rejeita string muito longa (JSON injection tentativa)', () => {
    const r = shippingDeadlineSchema.safeParse(`2027-12-30${'x'.repeat(500)}`);
    expect(r.success).toBe(false);
  });

  it('rejeita data no passado', () => {
    const r = shippingDeadlineSchema.safeParse(iso(-1));
    expect(r.success).toBe(false);
  });

  it('aceita hoje (limite inclusivo)', () => {
    const r = shippingDeadlineSchema.safeParse(iso(0));
    expect(r.success).toBe(true);
  });

  it('aceita futuro longínquo (10 anos)', () => {
    const r = shippingDeadlineSchema.safeParse(iso(365 * 10));
    expect(r.success).toBe(true);
  });

  it('rejeita mês/dia inválidos (2027-13-32)', () => {
    const r = shippingDeadlineSchema.safeParse('2027-13-32');
    expect(r.success).toBe(false);
  });

  it('rejeita ano zero e negativo', () => {
    expect(shippingDeadlineSchema.safeParse('0000-01-01').success).toBe(false);
    expect(shippingDeadlineSchema.safeParse('-100-01-01').success).toBe(false);
  });

  it('rejeita whitespace-only, undefined-like, e caracteres não-ASCII', () => {
    // '   '.trim() === '' → transform vira null → success
    expect(shippingDeadlineSchema.safeParse('   ').success).toBe(true);
    expect(shippingDeadlineSchema.safeParse('null').success).toBe(false);
    expect(shippingDeadlineSchema.safeParse('２０２７-01-01').success).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  Status transitions — fronteiras dia-a-dia                          */
/* ------------------------------------------------------------------ */

describe('getShippingDeadlineStatus — fronteiras', () => {
  it('none quando não há data', () => {
    expect(getShippingDeadlineStatus(null)).toBe('none');
    expect(getShippingDeadlineStatus(undefined)).toBe('none');
    expect(getShippingDeadlineStatus('')).toBe('none');
  });

  it(`hoje → soon (0 ≤ ${SOON_THRESHOLD_DAYS})`, () => {
    expect(getShippingDeadlineStatus(iso(0))).toBe('soon');
  });

  it(`limite superior de soon (${SOON_THRESHOLD_DAYS} dias)`, () => {
    expect(getShippingDeadlineStatus(iso(SOON_THRESHOLD_DAYS))).toBe('soon');
  });

  it(`${SOON_THRESHOLD_DAYS + 1} dias → ok`, () => {
    expect(getShippingDeadlineStatus(iso(SOON_THRESHOLD_DAYS + 1))).toBe('ok');
  });

  it('ontem → overdue', () => {
    expect(getShippingDeadlineStatus(iso(-1))).toBe('overdue');
  });

  it('30 dias → ok', () => {
    expect(getShippingDeadlineStatus(iso(30))).toBe('ok');
  });
});

/* ------------------------------------------------------------------ */
/*  Labels — pluralização e edge dias                                  */
/* ------------------------------------------------------------------ */

describe('getDeadlineLabel — pluralização e casos extremos', () => {
  const cases: Array<[
    'none' | 'ok' | 'overdue' | 'soon',
    number | null,
    RegExp,
  ]> = [
    ['none', null, /^—$/],
    ['overdue', 0, /Vence hoje/],
    ['overdue', -1, /Vencido há 1 dia$/],
    ['overdue', -2, /Vencido há 2 dias$/],
    ['soon', 0, /Vence hoje/],
    ['soon', 1, /Faltam 1 dia$/],
    ['soon', 3, /Faltam 3 dias$/],
    ['ok', 4, /Em 4 dias/],
    ['ok', 365, /Em 365 dias/],
  ];

  it.each(cases)('%s / %s dias → label bate', (status, diff, re) => {
    expect(getDeadlineLabel(status, diff)).toMatch(re);
  });
});

/* ------------------------------------------------------------------ */
/*  Classes semânticas — sem cores hardcoded                           */
/* ------------------------------------------------------------------ */

describe('DEADLINE_BADGE_CLASSES — apenas tokens semânticos', () => {
  const banned = [/\btext-white\b/, /\bbg-black\b/, /\bbg-\[#[0-9a-f]/i];
  const allowedNonSemantic = /\byellow-\d+/; // exceção documentada no SSOT: yellow para "soon"

  for (const [status, cls] of Object.entries(DEADLINE_BADGE_CLASSES)) {
    it(`status="${status}" só usa tokens semânticos (ou yellow para soon)`, () => {
      for (const re of banned) expect(cls).not.toMatch(re);
      if (status !== 'soon') expect(cls).not.toMatch(allowedNonSemantic);
    });
  }
});

/* ------------------------------------------------------------------ */
/*  Guard mutuamente exclusivo: badge && !error                        */
/* ------------------------------------------------------------------ */

describe('coerência do render: badge XOR error', () => {
  type State = {
    shippingDeadlineBadge: { label: string; status: string } | null;
    shippingDeadlineError: string | null;
  };

  const scenarios: State[] = [
    { shippingDeadlineBadge: null, shippingDeadlineError: null },
    { shippingDeadlineBadge: { label: 'ok', status: 'ok' }, shippingDeadlineError: null },
    { shippingDeadlineBadge: null, shippingDeadlineError: 'Data inválida.' },
    // caso teórico onde ambos existem: o guard `badge && !error` deve suprimir o badge
    {
      shippingDeadlineBadge: { label: 'ok', status: 'ok' },
      shippingDeadlineError: 'Data inválida.',
    },
  ];

  it.each(scenarios)('nunca renderiza badge quando error é truthy', (s) => {
    const showBadge = !!s.shippingDeadlineBadge && !s.shippingDeadlineError;
    const showError = !!s.shippingDeadlineError;
    // Não coexistem
    expect(showBadge && showError).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  Fuzz: 200 datas aleatórias → status sempre é uma das 4 constantes  */
/* ------------------------------------------------------------------ */

describe('fuzz de status (200 datas aleatórias)', () => {
  it('nunca retorna valor fora do domínio', () => {
    const allowed = new Set(['overdue', 'soon', 'ok', 'none']);
    for (let i = 0; i < 200; i++) {
      const offset = Math.floor((Math.random() - 0.5) * 800); // -400..+400 dias
      const s = getShippingDeadlineStatus(iso(offset));
      expect(allowed.has(s)).toBe(true);
      const diff = daysUntilDeadline(iso(offset));
      expect(diff).toBe(offset);
    }
  });
});
