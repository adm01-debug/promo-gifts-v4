/**
 * Testes unitários — `correlationId` util.
 *
 * Cobertura:
 *   - `isValidCorrelationId` — aceita apenas string não-vazia após `trim()`.
 *   - `normalizeCorrelationId` — reutiliza strings válidas; gera UUID v4
 *     canônico para qualquer entrada inválida (empty, whitespace, tipos
 *     inesperados).
 *   - `isUuidV4` — regex canônica.
 *   - Isolamento: cada chamada gera UM CID novo (sem cache/estado global).
 */
import { describe, expect, it } from 'vitest';
import {
  isUuidV4,
  isValidCorrelationId,
  normalizeCorrelationId,
  UUID_V4_REGEX,
} from '@/lib/telemetry/correlationId';

describe('correlationId — isValidCorrelationId', () => {
  it.each([
    ['string simples', 'abc', true],
    ['UUID', '11111111-2222-4333-8444-555555555555', true],
    ['string com whitespace nas bordas', '  cid  ', true],
    ['string vazia', '', false],
    ['só espaços', '   ', false],
    ['só tabs/newlines', '\t\n ', false],
    ['undefined', undefined, false],
    ['null', null, false],
    ['number', 42, false],
    ['boolean', true, false],
    ['objeto', { id: 'x' }, false],
    ['array', ['x'], false],
    ['NaN', Number.NaN, false],
  ])('%s → %s', (_label, input, expected) => {
    expect(isValidCorrelationId(input)).toBe(expected);
  });
});

describe('correlationId — isUuidV4', () => {
  it('aceita UUID v4 canônico (minúsculo e MAIÚSCULO)', () => {
    expect(isUuidV4('11111111-2222-4333-8444-555555555555')).toBe(true);
    expect(isUuidV4('11111111-2222-4333-8444-555555555555'.toUpperCase())).toBe(true);
  });
  it.each([
    ['sem hífens', '11111111222243338444555555555555'],
    ['versão errada (v1)', '11111111-2222-1333-8444-555555555555'],
    ['variant errada (c)', '11111111-2222-4333-c444-555555555555'],
    ['string vazia', ''],
    ['prefix + UUID', 'x-11111111-2222-4333-8444-555555555555'],
  ])('%s → false', (_label, input) => {
    expect(isUuidV4(input)).toBe(false);
  });
});

describe('correlationId — normalizeCorrelationId', () => {
  it('reutiliza string válida verbatim (sem trim)', () => {
    expect(normalizeCorrelationId('cid-legado')).toBe('cid-legado');
    expect(normalizeCorrelationId('  cid  ')).toBe('  cid  ');
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['string vazia', ''],
    ['só whitespace', '   '],
    ['\\t\\n misto', '\t\n '],
    ['number', 42],
    ['boolean', false],
    ['objeto', { id: 'x' }],
    ['array', []],
  ])('%s → gera UUID v4 canônico', (_label, input) => {
    const out = normalizeCorrelationId(input);
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
    expect(UUID_V4_REGEX.test(out)).toBe(true);
  });

  it('gera CIDs únicos em chamadas consecutivas (sem cache global)', () => {
    const cids = new Set<string>();
    for (let i = 0; i < 100; i++) cids.add(normalizeCorrelationId(undefined));
    // Pelo menos 99/100 devem ser únicos — colisão de UUID v4 é astronômica.
    expect(cids.size).toBeGreaterThanOrEqual(99);
  });
});
