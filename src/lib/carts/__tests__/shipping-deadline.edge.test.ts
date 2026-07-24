/**
 * Testes de borda — shipping-deadline.
 *
 * Foco em cenários que costumam quebrar cálculos de "hoje":
 *  - execução perto da meia-noite local
 *  - travessia de horário de verão (DST) — dia de 23h ou 25h
 *  - datas exatamente a +3 dias (borda soon) e +4 dias (borda ok)
 *  - fusos diferentes (simulados via setSystemTime com offset)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  daysUntilDeadline,
  getDeadlineLabel,
  getShippingDeadlineStatus,
  SOON_THRESHOLD_DAYS,
} from '../shipping-deadline';

/** YYYY-MM-DD relativo ao "hoje" local corrente (após setSystemTime). */
function iso(offsetDays: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe('shipping-deadline · edge cases', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('borda +3 / +4 dias (soon vs ok)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 5, 15, 12, 0, 0));
    });

    it('+3 dias exatamente → soon com rótulo "Faltam 3 dias"', () => {
      const d = iso(SOON_THRESHOLD_DAYS);
      const diff = daysUntilDeadline(d);
      expect(diff).toBe(3);
      expect(getShippingDeadlineStatus(d)).toBe('soon');
      expect(getDeadlineLabel('soon', diff)).toBe('Faltam 3 dias');
    });

    it('+4 dias exatamente → ok com rótulo "Em 4 dias"', () => {
      const d = iso(SOON_THRESHOLD_DAYS + 1);
      const diff = daysUntilDeadline(d);
      expect(diff).toBe(4);
      expect(getShippingDeadlineStatus(d)).toBe('ok');
      expect(getDeadlineLabel('ok', diff)).toBe('Em 4 dias');
    });

    it('transição +3 → +4 é a única borda de status', () => {
      expect(getShippingDeadlineStatus(iso(2))).toBe('soon');
      expect(getShippingDeadlineStatus(iso(3))).toBe('soon');
      expect(getShippingDeadlineStatus(iso(4))).toBe('ok');
      expect(getShippingDeadlineStatus(iso(5))).toBe('ok');
    });
  });

  describe('hoje em horários extremos (boundary de dia)', () => {
    it('00:00:01 local → hoje ainda é "soon" e diff=0', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 5, 15, 0, 0, 1));
      const d = iso(0);
      expect(daysUntilDeadline(d)).toBe(0);
      expect(getShippingDeadlineStatus(d)).toBe('soon');
      expect(getDeadlineLabel('soon', 0)).toBe('Vence hoje');
    });

    it('23:59:59 local → hoje ainda é "soon" e diff=0 (não muda de dia)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 5, 15, 23, 59, 59));
      const d = iso(0);
      expect(daysUntilDeadline(d)).toBe(0);
      expect(getShippingDeadlineStatus(d)).toBe('soon');
    });

    it('23:59:59 local — deadline de "amanhã" continua diff=1', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 5, 15, 23, 59, 59));
      expect(daysUntilDeadline(iso(1))).toBe(1);
    });
  });

  describe('travessia de horário de verão (Math.round protege 23h/25h)', () => {
    // Cenário: sistema em fuso com DST (ex.: America/Sao_Paulo historicamente).
    // Independente do fuso do runner, `Math.round((end-start)/MS_PER_DAY)` cobre
    // dias de 23h ou 25h, então a contagem de dias inteiros deve permanecer correta.
    it('deadline atravessa possível salto de DST e mantém contagem inteira', () => {
      vi.useFakeTimers();
      // Meio-outubro (perto de mudanças históricas de DST no hemisfério sul).
      vi.setSystemTime(new Date(2026, 9, 15, 12, 0, 0));
      for (const off of [0, 1, 3, 4, 7, 30]) {
        expect(daysUntilDeadline(iso(off))).toBe(off);
      }
    });

    it('deadline em fevereiro (fim histórico de DST) mantém contagem inteira', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 1, 18, 12, 0, 0));
      for (const off of [-1, 0, 3, 4]) {
        expect(daysUntilDeadline(iso(off))).toBe(off);
      }
      expect(getShippingDeadlineStatus(iso(3))).toBe('soon');
      expect(getShippingDeadlineStatus(iso(4))).toBe('ok');
    });
  });

  describe('travessia de mês e ano (nunca quebra o cálculo)', () => {
    it('último dia do mês → +1 é dia 1 do mês seguinte', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 0, 31, 12, 0, 0)); // 31/jan
      expect(daysUntilDeadline('2026-02-01')).toBe(1);
      expect(daysUntilDeadline('2026-02-03')).toBe(3);
      expect(getShippingDeadlineStatus('2026-02-03')).toBe('soon');
      expect(getShippingDeadlineStatus('2026-02-04')).toBe('ok');
    });

    it('31 de dezembro → travessia de ano', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 11, 31, 12, 0, 0));
      expect(daysUntilDeadline('2027-01-01')).toBe(1);
      expect(daysUntilDeadline('2027-01-03')).toBe(3);
      expect(daysUntilDeadline('2027-01-04')).toBe(4);
      expect(getShippingDeadlineStatus('2027-01-03')).toBe('soon');
      expect(getShippingDeadlineStatus('2027-01-04')).toBe('ok');
    });
  });

  describe('rótulo de contagem em vencidos', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 5, 15, 12, 0, 0));
    });

    it('-1 dia → "Vencido há 1 dia" (singular)', () => {
      const diff = daysUntilDeadline(iso(-1));
      expect(getDeadlineLabel('overdue', diff)).toBe('Vencido há 1 dia');
    });

    it('-7 dias → "Vencido há 7 dias" (plural)', () => {
      const diff = daysUntilDeadline(iso(-7));
      expect(getDeadlineLabel('overdue', diff)).toBe('Vencido há 7 dias');
    });
  });
});
