import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mocks com factory inline. Guardamos referência estável aos spies em
// `globalThis` para conseguir observar chamadas mesmo após `installSafeToast`
// substituir `toast.error/warning/message` por wrappers.
vi.mock('sonner', () => {
  const error = vi.fn();
  const warning = vi.fn();
  const message = vi.fn();
  const fns = { error, warning, message, success: vi.fn(), info: vi.fn() };
  // Guardamos referência aos spies originais — installSafeToast troca
  // fns.error/warning/message por wrappers, mas o wrapper chama o original.
  (globalThis as unknown as { __sonnerOriginals: { error: typeof error; warning: typeof warning; message: typeof message } }).__sonnerOriginals = { error, warning, message };
  return { toast: fns };
});

const gateState = { isDev: false };
vi.mock('@/lib/system/dev-gate/DevInfraGate', () => ({
  devInfraGate: {
    shouldShow: () => gateState.isDev,
  },
}));

import {
  installSafeToast,
  setSafeToastRoles,
  __test__,
} from '@/lib/security/safeToast';
import { toast } from 'sonner';

const sonner = () =>
  (globalThis as unknown as {
    __sonnerOriginals: {
      error: ReturnType<typeof vi.fn>;
      warning: ReturnType<typeof vi.fn>;
      message: ReturnType<typeof vi.fn>;
    };
  }).__sonnerOriginals;

describe('safeToast', () => {
  beforeEach(() => {
    sonner().error.mockClear();
    sonner().warning.mockClear();
    sonner().message.mockClear();
    installSafeToast();
    setSafeToastRoles([]);
    gateState.isDev = false;
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
      expect(looksTechnical(s as unknown)).toBe(false);
    });
  });

  describe('runtime patch — non-dev user', () => {
    it('substitui título técnico por copy genérica', () => {
      toast.error('TypeError: undefined is not a function');
      expect(sonner().error).toHaveBeenCalledWith(__test__.PUBLIC_FALLBACK_TITLE, undefined);
    });

    it('mantém título amigável', () => {
      toast.error('Empresa sem ID Bitrix24');
      expect(sonner().error).toHaveBeenCalledWith('Empresa sem ID Bitrix24', undefined);
    });

    it('strip description técnica preservando título', () => {
      toast.error('Erro ao salvar', { description: 'Failed to fetch' });
      const [, opts] = sonner().error.mock.calls[0];
      expect((opts as { description?: string }).description).toBeUndefined();
    });

    it('preserva description amigável', () => {
      toast.error('Erro ao salvar', { description: 'Verifique os dados informados.' });
      const [, opts] = sonner().error.mock.calls[0];
      expect((opts as { description: string }).description).toBe('Verifique os dados informados.');
    });

    it('aplica também em toast.warning e toast.message', () => {
      toast.warning('Error: stack trace at https://x.com/a.tsx:1');
      toast.message('UNAUTHORIZED_LEGACY_JWT');
      expect(sonner().warning).toHaveBeenCalledWith(__test__.PUBLIC_FALLBACK_TITLE, undefined);
      expect(sonner().message).toHaveBeenCalledWith(__test__.PUBLIC_FALLBACK_TITLE, undefined);
    });
  });

  describe('runtime patch — dev user', () => {
    beforeEach(() => {
      gateState.isDev = true;
    });

    it('preserva título técnico para devs', () => {
      toast.error('TypeError: undefined is not a function');
      expect(sonner().error).toHaveBeenCalledWith(
        'TypeError: undefined is not a function',
        undefined,
      );
    });

    it('preserva description técnica para devs', () => {
      toast.error('Erro ao salvar', { description: 'Failed to fetch' });
      const [, opts] = sonner().error.mock.calls[0];
      expect((opts as { description: string }).description).toBe('Failed to fetch');
    });
  });

  it('é idempotente — segunda chamada não dupla-patcha', () => {
    installSafeToast();
    installSafeToast();
    toast.error('Erro normal');
    expect(sonner().error).toHaveBeenCalledTimes(1);
  });
});
