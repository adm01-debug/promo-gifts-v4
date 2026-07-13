/**
 * Testes de mapRestoreCartError — garante que cada SQLSTATE / erro Supabase
 * conhecido produz uma descrição acionável, e que o fallback delega para
 * `sanitizeError` (sem vazar detalhes sensíveis).
 */
import { describe, it, expect } from 'vitest';
import { mapRestoreCartError } from '../mapRestoreCartError';

describe('mapRestoreCartError', () => {
  it('RLS (SQLSTATE 42501) → "Sem permissão para restaurar."', () => {
    const r = mapRestoreCartError({
      code: '42501',
      message: 'new row violates row-level security policy for table "seller_carts"',
    });
    expect(r.reason).toBe('rls_denied');
    expect(r.title).toBe('Sem permissão para restaurar.');
    expect(r.description).toMatch(/não tem autorização/i);
  });

  it('RLS por status 403 → "Sem permissão para restaurar."', () => {
    const r = mapRestoreCartError({ status: 403, message: 'forbidden' });
    expect(r.reason).toBe('rls_denied');
  });

  it('unique_cart_item_variant (23505) → mensagem específica de item duplicado', () => {
    const r = mapRestoreCartError({
      code: '23505',
      message:
        'duplicate key value violates unique constraint "unique_cart_item_variant"',
      details: 'Key (cart_id, product_id, color_name)=(...) already exists.',
    });
    expect(r.reason).toBe('duplicate_item');
    expect(r.description).toMatch(/mesma cor/i);
  });

  it('unique genérico (23505) → mensagem genérica de duplicidade', () => {
    const r = mapRestoreCartError({
      code: '23505',
      message: 'duplicate key value violates unique constraint "outra_key"',
    });
    expect(r.reason).toBe('duplicate_item');
    expect(r.description).toMatch(/já existe/i);
  });

  it('FK (23503) → produto/empresa inexistente', () => {
    const r = mapRestoreCartError({ code: '23503', message: 'foreign key violation' });
    expect(r.reason).toBe('foreign_key');
    expect(r.description).toMatch(/não existe mais/i);
  });

  it('NOT NULL (23502) → faltam informações obrigatórias', () => {
    const r = mapRestoreCartError({ code: '23502', message: 'null value in column' });
    expect(r.reason).toBe('not_null');
    expect(r.description).toMatch(/informações obrigatórias/i);
  });

  it('CHECK (23514) → regras de validação', () => {
    const r = mapRestoreCartError({ code: '23514', message: 'check constraint failed' });
    expect(r.reason).toBe('check_constraint');
    expect(r.description).toMatch(/regras de validação/i);
  });

  it('string too long (22001) → mensagem específica', () => {
    const r = mapRestoreCartError({ code: '22001', message: 'value too long' });
    expect(r.reason).toBe('string_too_long');
    expect(r.description).toMatch(/longo demais/i);
  });

  it('limite de carrinhos (Error mensagem custom) → título de limite', () => {
    const r = mapRestoreCartError(
      new Error('Você já tem 10 carrinhos ativos. Finalize ou exclua um antes de restaurar.'),
    );
    expect(r.reason).toBe('cart_limit');
    expect(r.title).toBe('Limite de carrinhos ativos atingido.');
  });

  it('não autenticado → título "Sessão expirada."', () => {
    const r = mapRestoreCartError(new Error('Não autenticado'));
    expect(r.reason).toBe('unauthenticated');
    expect(r.title).toBe('Sessão expirada.');
  });

  it('failed to fetch → falha de conexão', () => {
    const r = mapRestoreCartError(new Error('Failed to fetch'));
    expect(r.reason).toBe('network');
    expect(r.title).toBe('Falha de conexão.');
  });

  it('statement timeout (57014) → timeout', () => {
    const r = mapRestoreCartError({ code: '57014', message: 'canceling statement due to statement timeout' });
    expect(r.reason).toBe('timeout');
  });

  it('status 500 → erro de servidor', () => {
    const r = mapRestoreCartError({ status: 500, message: 'internal server error' });
    expect(r.reason).toBe('server');
  });

  it('erro desconhecido → fallback via sanitizeError (não vaza detalhes)', () => {
    const r = mapRestoreCartError({ code: 'XX999', message: 'some obscure detail' });
    expect(r.reason).toBe('unknown');
    // sanitizeError retorna uma das SAFE_MESSAGES — nunca a string bruta
    expect(r.description).not.toContain('obscure detail');
  });

  it('input null/undefined não quebra', () => {
    expect(mapRestoreCartError(null).reason).toBe('unknown');
    expect(mapRestoreCartError(undefined).reason).toBe('unknown');
  });
});
