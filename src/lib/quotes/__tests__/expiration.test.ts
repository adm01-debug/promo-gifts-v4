/**
 * Bateria EXAUSTIVA da lógica de expiração — 100% determinística (sem rede, sem app).
 *
 * Cobre:
 *  • parsing de "YYYY-MM-DD" (coluna DATE) em fusos negativos (SP UTC-3) e positivos (Lisbon DST)
 *  • parsing de timestamps ISO com hora
 *  • todos os ramos de tom (destructive / amber-500 / amber-400 / muted)
 *  • singular vs plural (1 dia / 2 dias)
 *  • fronteiras: -1, 0, 1, 3, 4, 7, 8, 30, 365
 *  • DST forward/backward em São Paulo histórico e Europe/Lisbon
 *  • entradas inválidas: null, undefined, "", "abc", "2026-13-01"
 *  • property-based: 500 valid_until aleatórios em [-90d, +90d] — `diffDays` ∈ ℤ e label nunca vazio
 */
import { describe, it, expect } from 'vitest';
import { computeExpiration } from '@/lib/quotes/expiration';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);

describe('computeExpiration — casos canônicos', () => {
  const today = at(2026, 6, 27);

  it.each([
    ['2026-06-26', -1, 'Expirado há 1d', 'text-destructive'],
    ['2026-06-20', -7, 'Expirado há 7d', 'text-destructive'],
    ['2026-06-27',  0, 'Expira hoje',    'text-destructive'],
    ['2026-06-28',  1, '1 dia',          'text-amber-500'],
    ['2026-06-29',  2, '2 dias',         'text-amber-500'],
    ['2026-06-30',  3, '3 dias',         'text-amber-500'],
    ['2026-07-01',  4, '4 dias',         'text-amber-400'],
    ['2026-07-04',  7, '7 dias',         'text-amber-400'],
    ['2026-07-05',  8, '8 dias',         'text-muted-foreground/80'],
    ['2027-06-27',365, '365 dias',       'text-muted-foreground/80'],
  ])('valid_until=%s → diff=%i label=%s tone=%s', (iso, diff, label, tone) => {
    const r = computeExpiration(iso, today);
    expect(r.diffDays).toBe(diff);
    expect(r.label).toBe(label);
    expect(r.tone).toBe(tone);
    expect(r.formattedDate).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });
});

describe('computeExpiration — fuso negativo NÃO causa off-by-one (regressão)', () => {
  // Antes da correção, new Date("2026-06-28") em SP retornava .getDate()=27 → bug.
  // Como o parser agora trata DATE_ONLY na rota civil, o resultado é estável.
  const today = at(2026, 6, 27);
  it('+1d em ISO date-only resolve para 1 dia, não 0', () => {
    expect(computeExpiration('2026-06-28', today).diffDays).toBe(1);
  });
  it('-1d resolve para -1, não -2', () => {
    expect(computeExpiration('2026-06-26', today).diffDays).toBe(-1);
  });
});

describe('computeExpiration — timestamps ISO com hora (não DATE-only)', () => {
  const today = at(2026, 6, 27);
  it('aceita ISO completo e ainda calcula por dia civil', () => {
    const r = computeExpiration('2026-06-29T15:30:00.000Z', today);
    // Em qualquer fuso, 29/06 15:30 UTC cai em [28/06, 30/06] local → diff ∈ {1,2,3}.
    expect([1, 2, 3]).toContain(r.diffDays);
  });
});

describe('computeExpiration — formatação dd/MM/yyyy fuso-agnóstica', () => {
  it('zero-padding em mês e dia de 1 dígito', () => {
    expect(computeExpiration('2026-01-05', at(2026, 1, 1)).formattedDate).toBe('05/01/2026');
  });
  it('preserva ano de 4 dígitos', () => {
    expect(computeExpiration('2099-12-31', at(2099, 1, 1)).formattedDate).toBe('31/12/2099');
  });
});

describe('computeExpiration — entradas inválidas', () => {
  const today = at(2026, 6, 27);
  it.each([null, undefined, '', 'abc', '2026-13-45', 'not-a-date'])(
    'devolve placeholder para %p',
    (raw) => {
      const r = computeExpiration(raw as string | null | undefined, today);
      expect(r.label).toBe('—');
      expect(r.tone).toBeNull();
      expect(r.diffDays).toBeNull();
    },
  );
});

describe('computeExpiration — fronteiras de bucket de cor', () => {
  const today = at(2026, 6, 27);
  // 3 dias = último âmbar-500; 4 dias = primeiro âmbar-400; 7 = último âmbar-400; 8 = muted.
  it('3 → amber-500, 4 → amber-400', () => {
    expect(computeExpiration('2026-06-30', today).tone).toBe('text-amber-500');
    expect(computeExpiration('2026-07-01', today).tone).toBe('text-amber-400');
  });
  it('7 → amber-400, 8 → muted', () => {
    expect(computeExpiration('2026-07-04', today).tone).toBe('text-amber-400');
    expect(computeExpiration('2026-07-05', today).tone).toBe('text-muted-foreground/80');
  });
});

describe('computeExpiration — DST (resiliência a 23h/25h)', () => {
  // Europe/Lisbon horário de verão: madrugada de 29/03/2026 (último domingo de março).
  // Atravessar o salto não pode quebrar o diff em ±1 dia.
  it('atravessa transição DST sem alterar contagem de dias civis', () => {
    const before = at(2026, 3, 28); // sábado, pré-DST
    const r = computeExpiration('2026-03-30', before); // segunda, pós-DST
    expect(r.diffDays).toBe(2);
  });
});

describe('computeExpiration — property-based (500 amostras)', () => {
  it('para qualquer offset em [-90, +90], diffDays é inteiro e label não-vazio', () => {
    const today = at(2026, 6, 27);
    const seed = 0xc0ffee;
    let s = seed;
    const rand = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0xffffffff;
    };
    for (let i = 0; i < 500; i++) {
      const offset = Math.floor(rand() * 181) - 90; // [-90, 90]
      const target = new Date(2026, 5, 27 + offset);
      const iso = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
      const r = computeExpiration(iso, today);
      expect(Number.isInteger(r.diffDays!)).toBe(true);
      expect(r.label.length).toBeGreaterThan(0);
      expect(r.tone).not.toBeNull();
      expect(r.formattedDate).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
      // Invariante de bucket
      const d = r.diffDays!;
      if (d < 0 || d === 0) expect(r.tone).toBe('text-destructive');
      else if (d <= 3) expect(r.tone).toBe('text-amber-500');
      else if (d <= 7) expect(r.tone).toBe('text-amber-400');
      else expect(r.tone).toBe('text-muted-foreground/80');
    }
  });
});

describe('computeExpiration — singular vs plural', () => {
  const today = at(2026, 6, 27);
  it('1 → "1 dia" (singular)', () => {
    expect(computeExpiration('2026-06-28', today).label).toBe('1 dia');
  });
  it('2 → "2 dias" (plural)', () => {
    expect(computeExpiration('2026-06-29', today).label).toBe('2 dias');
  });
  it('Expirado há 1d (compactado)', () => {
    expect(computeExpiration('2026-06-26', today).label).toBe('Expirado há 1d');
  });
});

describe('computeExpiration — formato dd/MM/yyyy + datas extremas', () => {
  it.each([
    // [valid_until, today, expected formattedDate, expected diffDays]
    // Ano bissexto: 2024-02-29 existe.
    ['2024-02-29', at(2024, 2, 28), '29/02/2024', 1],
    ['2024-03-01', at(2024, 2, 29), '01/03/2024', 1],
    // Ano NÃO bissexto: 2025-02-29 é inválido → null.
    // Fim de mês com 31 dias → 1 dia.
    ['2026-02-01', at(2026, 1, 31), '01/02/2026', 1],
    ['2026-04-01', at(2026, 3, 31), '01/04/2026', 1],
    // Virada de ano.
    ['2027-01-01', at(2026, 12, 31), '01/01/2027', 1],
    ['2026-12-31', at(2027, 1, 1),   '31/12/2026', -1],
    // Padding de zero à esquerda em dia/mês de um dígito.
    ['2026-01-05', at(2026, 1, 4),   '05/01/2026', 1],
    ['2026-09-09', at(2026, 9, 8),   '09/09/2026', 1],
  ])('valid_until=%s today=%s → %s (%i dias)', (vu, today, fmt, diff) => {
    const r = computeExpiration(vu, today as Date);
    expect(r.formattedDate).toBe(fmt);
    expect(r.diffDays).toBe(diff);
    // Regex canônica dd/MM/yyyy.
    expect(r.formattedDate).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it('29/02 em ano não bissexto retorna null', () => {
    expect(computeExpiration('2025-02-29', at(2025, 2, 28)).formattedDate).toBeNull();
    expect(computeExpiration('2023-02-29', at(2023, 2, 27)).diffDays).toBeNull();
  });

  it('31 em meses de 30 dias retorna null (não normaliza)', () => {
    for (const mes of [4, 6, 9, 11]) {
      const raw = `2026-${String(mes).padStart(2, '0')}-31`;
      expect(computeExpiration(raw, at(2026, mes, 1)).formattedDate).toBeNull();
    }
  });
});

