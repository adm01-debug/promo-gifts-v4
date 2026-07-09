/**
 * Testes — shipping-deadline (SSOT do prazo de envio).
 *
 * Cobre: hoje, +3 dias (borda soon), +4 dias (borda ok), datas vencidas,
 * schema Zod, matchesDeadlineFilter, DEADLINE_BADGE_CLASSES.
 *
 * Usa `vi.setSystemTime` fixando meio-dia local para evitar oscilações
 * entre fusos e horário de verão que afetariam o cálculo de "hoje".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEADLINE_BADGE_CLASSES,
  daysUntilDeadline,
  getDeadlineLabel,
  getShippingDeadlineStatus,
  matchesDeadlineFilter,
  shippingDeadlineSchema,
  SOON_THRESHOLD_DAYS,
} from '../shipping-deadline';

/** Retorna YYYY-MM-DD para hoje + offset em dias (baseado no horário local). */
function iso(offsetDays: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe('shipping-deadline', () => {
  beforeEach(() => {
    // Fixa a data em 2026-06-15 12:00 local — meio-dia evita boundary de dia.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('daysUntilDeadline', () => {
    it('retorna 0 para hoje', () => {
      expect(daysUntilDeadline(iso(0))).toBe(0);
    });
    it('retorna 3 para +3 dias', () => {
      expect(daysUntilDeadline(iso(3))).toBe(3);
    });
    it('retorna 4 para +4 dias', () => {
      expect(daysUntilDeadline(iso(4))).toBe(4);
    });
    it('retorna valor negativo para datas vencidas', () => {
      expect(daysUntilDeadline(iso(-1))).toBe(-1);
      expect(daysUntilDeadline(iso(-10))).toBe(-10);
    });
    it('retorna null para entrada inválida ou vazia', () => {
      expect(daysUntilDeadline(null)).toBeNull();
      expect(daysUntilDeadline(undefined)).toBeNull();
      expect(daysUntilDeadline('')).toBeNull();
      expect(daysUntilDeadline('2026/06/15')).toBeNull();
      expect(daysUntilDeadline('nao-e-data')).toBeNull();
    });
  });

  describe('getShippingDeadlineStatus', () => {
    it('hoje → soon (0 ≤ threshold=3)', () => {
      expect(getShippingDeadlineStatus(iso(0))).toBe('soon');
    });
    it('+3 dias → soon (borda inclusiva do threshold)', () => {
      expect(getShippingDeadlineStatus(iso(SOON_THRESHOLD_DAYS))).toBe('soon');
    });
    it('+4 dias → ok (primeira posição fora do threshold)', () => {
      expect(getShippingDeadlineStatus(iso(SOON_THRESHOLD_DAYS + 1))).toBe('ok');
    });
    it('data no passado → overdue', () => {
      expect(getShippingDeadlineStatus(iso(-1))).toBe('overdue');
      expect(getShippingDeadlineStatus(iso(-30))).toBe('overdue');
    });
    it('sem data → none', () => {
      expect(getShippingDeadlineStatus(null)).toBe('none');
      expect(getShippingDeadlineStatus(undefined)).toBe('none');
    });
  });

  describe('getDeadlineLabel', () => {
    it('overdue: "Vence hoje" quando diff=0 e status=overdue (defensivo)', () => {
      expect(getDeadlineLabel('overdue', 0)).toBe('Vence hoje');
    });
    it('overdue: singular "1 dia"', () => {
      expect(getDeadlineLabel('overdue', -1)).toBe('Vencido há 1 dia');
    });
    it('overdue: plural "N dias"', () => {
      expect(getDeadlineLabel('overdue', -5)).toBe('Vencido há 5 dias');
    });
    it('soon: hoje mostra "Vence hoje"', () => {
      expect(getDeadlineLabel('soon', 0)).toBe('Vence hoje');
    });
    it('soon: singular "Faltam 1 dia"', () => {
      expect(getDeadlineLabel('soon', 1)).toBe('Faltam 1 dia');
    });
    it('soon: plural "Faltam N dias"', () => {
      expect(getDeadlineLabel('soon', 3)).toBe('Faltam 3 dias');
    });
    it('ok: "Em N dias"', () => {
      expect(getDeadlineLabel('ok', 4)).toBe('Em 4 dias');
      expect(getDeadlineLabel('ok', 30)).toBe('Em 30 dias');
    });
    it('none: retorna traço', () => {
      expect(getDeadlineLabel('none', null)).toBe('—');
      expect(getDeadlineLabel('ok', null)).toBe('—');
    });
  });

  describe('matchesDeadlineFilter', () => {
    it('filter=all aceita qualquer valor (inclusive null)', () => {
      expect(matchesDeadlineFilter(null, 'all')).toBe(true);
      expect(matchesDeadlineFilter(iso(0), 'all')).toBe(true);
      expect(matchesDeadlineFilter(iso(-10), 'all')).toBe(true);
    });
    it('filter=none só aceita sem prazo', () => {
      expect(matchesDeadlineFilter(null, 'none')).toBe(true);
      expect(matchesDeadlineFilter(iso(0), 'none')).toBe(false);
    });
    it('filter=overdue só aceita datas no passado', () => {
      expect(matchesDeadlineFilter(iso(-1), 'overdue')).toBe(true);
      expect(matchesDeadlineFilter(iso(0), 'overdue')).toBe(false);
      expect(matchesDeadlineFilter(iso(5), 'overdue')).toBe(false);
      expect(matchesDeadlineFilter(null, 'overdue')).toBe(false);
    });
    it('filter=soon aceita 0..3 dias', () => {
      expect(matchesDeadlineFilter(iso(0), 'soon')).toBe(true);
      expect(matchesDeadlineFilter(iso(3), 'soon')).toBe(true);
      expect(matchesDeadlineFilter(iso(4), 'soon')).toBe(false);
      expect(matchesDeadlineFilter(iso(-1), 'soon')).toBe(false);
    });
    it('filter=week aceita 0..7 dias', () => {
      expect(matchesDeadlineFilter(iso(7), 'week')).toBe(true);
      expect(matchesDeadlineFilter(iso(8), 'week')).toBe(false);
    });
    it('filter=month aceita 0..30 dias', () => {
      expect(matchesDeadlineFilter(iso(30), 'month')).toBe(true);
      expect(matchesDeadlineFilter(iso(31), 'month')).toBe(false);
    });
  });

  describe('DEADLINE_BADGE_CLASSES', () => {
    it('tem uma classe para cada status', () => {
      expect(DEADLINE_BADGE_CLASSES.overdue).toBeTruthy();
      expect(DEADLINE_BADGE_CLASSES.soon).toBeTruthy();
      expect(DEADLINE_BADGE_CLASSES.ok).toBeTruthy();
      expect(DEADLINE_BADGE_CLASSES.none).toBeTruthy();
    });
    it('overdue usa token destructive (não hardcoded)', () => {
      expect(DEADLINE_BADGE_CLASSES.overdue).toMatch(/destructive/);
    });
    it('soon usa amarelo com fallback dark:', () => {
      expect(DEADLINE_BADGE_CLASSES.soon).toMatch(/yellow/);
      expect(DEADLINE_BADGE_CLASSES.soon).toMatch(/dark:/);
    });
  });

  describe('shippingDeadlineSchema (Zod)', () => {
    it('aceita null (limpar prazo)', () => {
      expect(shippingDeadlineSchema.parse(null)).toBeNull();
    });
    it('aceita string vazia (normaliza para null)', () => {
      expect(shippingDeadlineSchema.parse('')).toBeNull();
    });
    it('aceita data ISO válida (hoje e futuro)', () => {
      expect(shippingDeadlineSchema.parse(iso(0))).toBe(iso(0));
      expect(shippingDeadlineSchema.parse(iso(30))).toBe(iso(30));
    });
    it('rejeita data no passado', () => {
      const r = shippingDeadlineSchema.safeParse(iso(-1));
      expect(r.success).toBe(false);
    });
    it('rejeita formato inválido', () => {
      expect(shippingDeadlineSchema.safeParse('15/06/2026').success).toBe(false);
      expect(shippingDeadlineSchema.safeParse('2026-6-1').success).toBe(false);
      expect(shippingDeadlineSchema.safeParse('nao-e-data').success).toBe(false);
    });
  });
});
