/**
 * Unit tests for src/lib/date-utils.ts
 *
 * formatDate, formatDateTime, formatTime, formatDateRelative,
 * formatDateRelativeFull, formatDateCompact, formatDateLong,
 * formatWeekday, formatMonthYear, isToday, isYesterday, isTomorrow,
 * formatDateSmart
 */
import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatTime,
  formatDateRelative,
  formatDateRelativeFull,
  formatDateCompact,
  formatDateLong,
  formatWeekday,
  formatMonthYear,
  isToday,
  isYesterday,
  isTomorrow,
  formatDateSmart,
} from '@/lib/date-utils';

// Fixed reference: 2025-12-25 14:30 (Christmas Day, São Paulo local time)
// Dec 25, 2025 = Thursday (quinta-feira)
const XMAS = new Date('2025-12-25T14:30:00');
const XMAS_ISO = '2025-12-25T17:30:00.000Z'; // same instant in UTC (BRT = UTC-3)
const XMAS_TS = XMAS.getTime();

// Fixed base for relative tests (noon on Christmas)
const BASE = new Date('2025-12-25T12:00:00');

// ============================================
// formatDate
// ============================================

describe('formatDate', () => {
  it('formats Date object with default pattern dd/MM/yyyy', () => {
    expect(formatDate(XMAS)).toBe('25/12/2025');
  });

  it('formats ISO string with default pattern', () => {
    // 2025-06-15T03:00:00Z = 2025-06-15T00:00:00 BRT
    expect(formatDate('2025-06-15T03:00:00.000Z')).toBe('15/06/2025');
  });

  it('formats numeric timestamp with default pattern', () => {
    // 2025-01-01T03:00:00Z = 2025-01-01T00:00:00 BRT
    const ts = new Date('2025-01-01T03:00:00.000Z').getTime();
    expect(formatDate(ts)).toBe('01/01/2025');
  });

  it('respects custom pattern', () => {
    expect(formatDate(XMAS, 'yyyy/MM/dd')).toBe('2025/12/25');
  });

  it('custom pattern HH:mm extracts time from Date', () => {
    expect(formatDate(XMAS, 'HH:mm')).toBe('14:30');
  });

  it('returns single-digit days zero-padded', () => {
    expect(formatDate(new Date('2025-06-01T03:00:00.000Z'))).toBe('01/06/2025');
  });
});

// ============================================
// formatDateTime
// ============================================

describe('formatDateTime', () => {
  it('returns dd/MM/yyyy HH:mm for Date object', () => {
    expect(formatDateTime(XMAS)).toBe('25/12/2025 14:30');
  });

  it('returns dd/MM/yyyy HH:mm for ISO string (UTC)', () => {
    // 2025-06-15T15:45:00Z = 2025-06-15T12:45:00 BRT
    expect(formatDateTime('2025-06-15T15:45:00.000Z')).toBe('15/06/2025 12:45');
  });

  it('returns dd/MM/yyyy HH:mm for timestamp', () => {
    expect(formatDateTime(XMAS_TS)).toBe('25/12/2025 14:30');
  });
});

// ============================================
// formatTime
// ============================================

describe('formatTime', () => {
  it('returns HH:mm for Date object', () => {
    expect(formatTime(XMAS)).toBe('14:30');
  });

  it('returns HH:mm for ISO string', () => {
    // 2025-03-10T13:05:00Z = 2025-03-10T10:05:00 BRT
    expect(formatTime('2025-03-10T13:05:00.000Z')).toBe('10:05');
  });

  it('returns HH:mm for timestamp', () => {
    expect(formatTime(XMAS_TS)).toBe('14:30');
  });

  it('zero-pads hours and minutes', () => {
    // 2025-01-01T05:05:00Z = 2025-01-01T02:05:00 BRT
    expect(formatTime('2025-01-01T05:05:00.000Z')).toBe('02:05');
  });
});

// ============================================
// formatDateRelative
// ============================================

describe('formatDateRelative', () => {
  it('returns "há X dias" for a past date', () => {
    const twoDaysBefore = new Date('2025-12-23T12:00:00');
    const result = formatDateRelative(twoDaysBefore, BASE);
    expect(result).toContain('2 dias');
    expect(result).toContain('há');
  });

  it('returns "em X dias" for a future date', () => {
    const twoDaysAfter = new Date('2025-12-27T12:00:00');
    const result = formatDateRelative(twoDaysAfter, BASE);
    expect(result).toContain('2 dias');
    expect(result).toContain('em');
  });

  it('uses current time as baseDate by default (result is a string)', () => {
    const result = formatDateRelative(XMAS);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('accepts ISO string as date input', () => {
    const result = formatDateRelative('2025-12-23T12:00:00', BASE);
    expect(result).toContain('dias');
  });

  it('returns "há 1 dia" for 1 day in the past', () => {
    const oneDayBefore = new Date('2025-12-24T12:00:00');
    const result = formatDateRelative(oneDayBefore, BASE);
    expect(result).toContain('1 dia');
  });

  it('returns "em 1 dia" for 1 day in the future', () => {
    const oneDayAfter = new Date('2025-12-26T12:00:00');
    const result = formatDateRelative(oneDayAfter, BASE);
    expect(result).toContain('1 dia');
    expect(result).toContain('em');
  });

  it('returns minutes-based text for very small interval', () => {
    const fiveMinutesBefore = new Date(BASE.getTime() - 5 * 60 * 1000);
    const result = formatDateRelative(fiveMinutesBefore, BASE);
    expect(result).toContain('minuto');
  });
});

// ============================================
// formatDateRelativeFull
// ============================================

describe('formatDateRelativeFull', () => {
  it('contains "ontem" for yesterday', () => {
    const yesterday = new Date('2025-12-24T10:00:00');
    const result = formatDateRelativeFull(yesterday, BASE);
    expect(result).toContain('ontem');
  });

  it('contains "hoje" for same day earlier time', () => {
    const todayEarlier = new Date('2025-12-25T09:00:00');
    const result = formatDateRelativeFull(todayEarlier, BASE);
    expect(result).toContain('hoje');
  });

  it('contains "amanhã" for tomorrow', () => {
    const tomorrow = new Date('2025-12-26T14:00:00');
    const result = formatDateRelativeFull(tomorrow, BASE);
    expect(result).toContain('amanhã');
  });

  it('returns a non-empty string for any date', () => {
    const result = formatDateRelativeFull(XMAS, BASE);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('uses current time as baseDate by default', () => {
    const result = formatDateRelativeFull(XMAS);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

// ============================================
// formatDateCompact
// ============================================

describe('formatDateCompact', () => {
  it('returns "dd MMM yyyy, HH:mm" for Christmas', () => {
    const result = formatDateCompact(XMAS);
    expect(result).toContain('25');
    expect(result).toContain('dez');
    expect(result).toContain('2025');
    expect(result).toContain('14:30');
  });

  it('includes abbreviated month in PT-BR', () => {
    // June = "jun." in PT-BR
    const june = new Date('2025-06-15T09:00:00');
    expect(formatDateCompact(june)).toContain('jun');
  });

  it('accepts ISO string', () => {
    const result = formatDateCompact(XMAS_ISO);
    expect(result).toContain('2025');
  });

  it('accepts timestamp', () => {
    const result = formatDateCompact(XMAS_TS);
    expect(result).toContain('14:30');
  });
});

// ============================================
// formatDateLong
// ============================================

describe('formatDateLong', () => {
  it('returns "25 de dezembro de 2025" for Christmas', () => {
    expect(formatDateLong(XMAS)).toBe('25 de dezembro de 2025');
  });

  it('returns correct PT-BR month name for June', () => {
    const june = new Date('2025-06-15T03:00:00.000Z'); // midnight BRT
    expect(formatDateLong(june)).toBe('15 de junho de 2025');
  });

  it('accepts ISO string input', () => {
    // noon UTC Jan 1 = 9am BRT
    const result = formatDateLong('2025-01-01T12:00:00.000Z');
    expect(result).toBe('01 de janeiro de 2025');
  });

  it('accepts timestamp input', () => {
    expect(formatDateLong(XMAS_TS)).toBe('25 de dezembro de 2025');
  });
});

// ============================================
// formatWeekday
// ============================================

describe('formatWeekday', () => {
  it('returns "quinta-feira" for Dec 25 2025 (Thursday)', () => {
    expect(formatWeekday(XMAS)).toBe('quinta-feira');
  });

  it('returns "quarta-feira" for Dec 24 2025 (Wednesday)', () => {
    const wed = new Date('2025-12-24T12:00:00');
    expect(formatWeekday(wed)).toBe('quarta-feira');
  });

  it('returns "segunda-feira" for Dec 22 2025 (Monday)', () => {
    const mon = new Date('2025-12-22T12:00:00');
    expect(formatWeekday(mon)).toBe('segunda-feira');
  });

  it('returns "sábado" for Dec 27 2025 (Saturday)', () => {
    const sat = new Date('2025-12-27T12:00:00');
    expect(formatWeekday(sat)).toBe('sábado');
  });

  it('accepts timestamp', () => {
    expect(formatWeekday(XMAS_TS)).toBe('quinta-feira');
  });
});

// ============================================
// formatMonthYear
// ============================================

describe('formatMonthYear', () => {
  it('returns "dezembro de 2025" for Christmas', () => {
    expect(formatMonthYear(XMAS)).toBe('dezembro de 2025');
  });

  it('returns "junho de 2025" for June', () => {
    const june = new Date('2025-06-15T12:00:00');
    expect(formatMonthYear(june)).toBe('junho de 2025');
  });

  it('returns "janeiro de 2025" for January', () => {
    const jan = new Date('2025-01-01T12:00:00');
    expect(formatMonthYear(jan)).toBe('janeiro de 2025');
  });

  it('accepts ISO string', () => {
    // 2025-03-10T15:00:00Z = 2025-03-10T12:00:00 BRT
    const result = formatMonthYear('2025-03-10T15:00:00.000Z');
    expect(result).toBe('março de 2025');
  });
});

// ============================================
// isToday
// ============================================

describe('isToday', () => {
  it('returns true for new Date()', () => {
    expect(isToday(new Date())).toBe(true);
  });

  it('returns true for a Date object with today date (different time)', () => {
    const todayNoon = new Date();
    todayNoon.setHours(12, 0, 0, 0);
    expect(isToday(todayNoon)).toBe(true);
  });

  it('returns false for yesterday', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(isToday(yesterday)).toBe(false);
  });

  it('returns false for tomorrow', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(isToday(tomorrow)).toBe(false);
  });

  it('returns false for a fixed past date (Christmas 2025)', () => {
    expect(isToday(XMAS)).toBe(false);
  });

  it('accepts a timestamp', () => {
    expect(isToday(Date.now())).toBe(true);
  });
});

// ============================================
// isYesterday
// ============================================

describe('isYesterday', () => {
  const makeYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d;
  };

  it('returns true for yesterday', () => {
    expect(isYesterday(makeYesterday())).toBe(true);
  });

  it('returns false for today', () => {
    expect(isYesterday(new Date())).toBe(false);
  });

  it('returns false for 2 days ago', () => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    expect(isYesterday(twoDaysAgo)).toBe(false);
  });

  it('returns false for tomorrow', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(isYesterday(tomorrow)).toBe(false);
  });
});

// ============================================
// isTomorrow
// ============================================

describe('isTomorrow', () => {
  const makeTomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  };

  it('returns true for tomorrow', () => {
    expect(isTomorrow(makeTomorrow())).toBe(true);
  });

  it('returns false for today', () => {
    expect(isTomorrow(new Date())).toBe(false);
  });

  it('returns false for 2 days from now', () => {
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
    expect(isTomorrow(twoDaysFromNow)).toBe(false);
  });

  it('returns false for yesterday', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(isTomorrow(yesterday)).toBe(false);
  });
});

// ============================================
// formatDateSmart
// ============================================

describe('formatDateSmart', () => {
  it('returns "Hoje" for today', () => {
    expect(formatDateSmart(new Date())).toBe('Hoje');
  });

  it('returns "Ontem" for yesterday', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(formatDateSmart(yesterday)).toBe('Ontem');
  });

  it('returns "Amanhã" for tomorrow', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(formatDateSmart(tomorrow)).toBe('Amanhã');
  });

  it('returns formatted date string for past dates (not today/yesterday/tomorrow)', () => {
    const result = formatDateSmart(XMAS);
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it('formats Christmas 2025 as dd/MM/yyyy', () => {
    expect(formatDateSmart(XMAS)).toBe('25/12/2025');
  });

  it('accepts timestamp for today', () => {
    expect(formatDateSmart(Date.now())).toBe('Hoje');
  });
});
