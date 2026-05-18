import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock sonner BEFORE importing safeToast so o monkey-patch incide no spy.
const errorSpy = vi.fn();
const warningSpy = vi.fn();
const messageSpy = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    error: errorSpy,
    warning: warningSpy,
    message: messageSpy,
    success: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock devInfraGate para alternar dev/não-dev.
let isDev = false;
vi.mock('@/lib/system/dev-gate/DevInfraGate', () => ({
  devInfraGate: {
    shouldShow: () => isDev,
  },
}));

import {
  installSafeToast,
  setSafeToastRoles,
  __test__,
} from '@/lib/security/safeToast';
import { toast } from 'sonner';

describe('safeToast', () => {
  beforeEach(() => {
    errorSpy.mockClear();
    warningSpy.mockClear();
    messageSpy.mockClear();
    installSafeToast();
    setSafeToastRoles([]);
    isDev = false;
  });

  describe('looksTechnical', () => {
    const { looksTechnical } = __test__;
    it.each([
      ['Error: Failed to fetch'],
      ['TypeError: undefined is not a function'],
      ['UNAUTHORIZED_LEGACY_JWT'],
      ['SUPABASE_EDGE_RUNTIME_ERROR'],
      ['at https://app.lovable.app/assets/main.tsx:42'],
      ['{ "code": "P0001" }'],
      ['permission denied for function is_admin'],
      ['duplicate key value violates unique constraint'],
      ['relation "user_roles" does not exist'],
      ['Failed to fetch'],
    ])('detects %s as technical', (s) => {
      expect(looksTechnical(s)).toBe(true);
    });

    it.each([
      ['Não foi possível salvar o orçamento'],
      ['Selecione pelo menos um produto'],
      ['Empresa sem ID Bitrix24'],
      [''],
      [123],
      [null],
    ])('does not flag %s as technical', (s) => {
      expect(looksTechnical(s)).toBe(false);
    });
  });

  describe('runtime patch — non-dev user', () => {
    it('substitui título técnico por copy genérica', () => {
      toast.error('TypeError: undefined is not a function');
      expect(errorSpy).toHaveBeenCalledWith(__test__.PUBLIC_FALLBACK_TITLE, undefined);
    });

    it('mantém título amigável', () => {
      toast.error('Empresa sem ID Bitrix24');
      expect(errorSpy).toHaveBeenCalledWith('Empresa sem ID Bitrix24', undefined);
    });

    it('strip description técnica preservando título', () => {
      toast.error('Erro ao salvar', { description: 'Failed to fetch' });
      const [, opts] = errorSpy.mock.calls[0];
      expect(opts).toBeDefined();
      expect((opts as { description?: string }).description).toBeUndefined();
    });

    it('preserva description amigável', () => {
      toast.error('Erro ao salvar', { description: 'Verifique os dados informados.' });
      const [, opts] = errorSpy.mock.calls[0];
      expect((opts as { description: string }).description).toBe('Verifique os dados informados.');
    });

    it('aplica também em toast.warning e toast.message', () => {
      toast.warning('Error: stack trace at https://x.com/a.tsx:1');
      toast.message('UNAUTHORIZED_LEGACY_JWT');
      expect(warningSpy).toHaveBeenCalledWith(__test__.PUBLIC_FALLBACK_TITLE, undefined);
      expect(messageSpy).toHaveBeenCalledWith(__test__.PUBLIC_FALLBACK_TITLE, undefined);
    });
  });

  describe('runtime patch — dev user', () => {
    beforeEach(() => {
      isDev = true;
    });

    it('preserva título técnico para devs', () => {
      toast.error('TypeError: undefined is not a function');
      expect(errorSpy).toHaveBeenCalledWith('TypeError: undefined is not a function', undefined);
    });

    it('preserva description técnica para devs', () => {
      toast.error('Erro ao salvar', { description: 'Failed to fetch' });
      const [, opts] = errorSpy.mock.calls[0];
      expect((opts as { description: string }).description).toBe('Failed to fetch');
    });
  });

  it('é idempotente — segunda chamada não dupla-patcha', () => {
    installSafeToast();
    installSafeToast();
    toast.error('Erro normal');
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});
