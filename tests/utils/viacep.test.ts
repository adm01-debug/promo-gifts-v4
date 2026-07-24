import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAddressByCep } from '@/utils/viacep';

describe('fetchAddressByCep', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return null for invalid CEP length', async () => {
    expect(await fetchAddressByCep('123')).toBeNull();
    expect(await fetchAddressByCep('')).toBeNull();
  });

  it('should strip non-digits', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        logradouro: 'Praça da Sé',
        bairro: 'Sé',
        localidade: 'São Paulo',
        uf: 'SP',
      }),
    } as Response);

    await fetchAddressByCep('01001-000');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://viacep.com.br/ws/01001000/json/',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('should return address data on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        logradouro: 'Rua Test',
        bairro: 'Centro',
        localidade: 'São Paulo',
        uf: 'SP',
      }),
    } as Response);

    const result = await fetchAddressByCep('01001000');
    expect(result?.logradouro).toBe('Rua Test');
    expect(result?.uf).toBe('SP');
  });

  it('should return null for API error response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ erro: true }),
    } as Response);

    expect(await fetchAddressByCep('00000000')).toBeNull();
  });

  it('should return null on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));
    expect(await fetchAddressByCep('01001000')).toBeNull();
  });

  it('should return null on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
    } as Response);
    expect(await fetchAddressByCep('01001000')).toBeNull();
  });
});
