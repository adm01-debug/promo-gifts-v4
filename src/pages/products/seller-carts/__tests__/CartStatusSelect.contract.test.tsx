/**
 * CartStatusSelect — testes de contrato.
 *
 * Garantem que:
 *  1. Todo `CartStatus` suportado pelo tipo tem uma entrada em `STATUS_CONFIG`
 *     com `label` e `color` válidos.
 *  2. `getStatusCfg` NUNCA lança runtime error, mesmo para valores fora do
 *     domínio (null/undefined/string arbitrária/objeto) — sempre cai no
 *     fallback `em_separacao`.
 *  3. O componente renderiza sem crash para qualquer `currentStatus` suportado
 *     e permanece estável quando recebe um valor fora do domínio.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { STATUS_CONFIG, getStatusCfg } from '@/components/cart/CartUtilComponents';
import type { CartStatus } from '@/hooks/products';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/ui/select', () => {
  const Pass = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  const Trigger = (p: React.HTMLAttributes<HTMLButtonElement>) => <button type="button" {...p} />;
  return {
    Select: Pass,
    SelectTrigger: Trigger,
    SelectValue: Pass,
    SelectContent: Pass,
    SelectItem: Pass,
  };
});
vi.mock('@/components/ui/tooltip', () => {
  const P = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  return { Tooltip: P, TooltipTrigger: P, TooltipContent: P };
});

import { CartStatusSelect } from '../../SellerCartsPage';

const SUPPORTED_STATUSES: CartStatus[] = ['em_separacao', 'pronto_orcamento'];

afterEach(() => cleanup());

describe('CartStatusSelect · contrato STATUS_CONFIG × getStatusCfg', () => {
  it('todo CartStatus suportado tem entrada válida em STATUS_CONFIG', () => {
    for (const s of SUPPORTED_STATUSES) {
      const cfg = STATUS_CONFIG[s];
      expect(cfg, `STATUS_CONFIG[${s}] existe`).toBeDefined();
      expect(typeof cfg.label, `label string em ${s}`).toBe('string');
      expect(cfg.label.length, `label não vazio em ${s}`).toBeGreaterThan(0);
      expect(typeof cfg.color, `color string em ${s}`).toBe('string');
      expect(cfg.color.length, `color não vazio em ${s}`).toBeGreaterThan(0);
    }
  });

  it('getStatusCfg retorna a mesma entrada para cada status suportado', () => {
    for (const s of SUPPORTED_STATUSES) {
      expect(getStatusCfg(s)).toBe(STATUS_CONFIG[s]);
    }
  });

  it('getStatusCfg cai no fallback em_separacao para valores fora do domínio', () => {
    const fallback = STATUS_CONFIG.em_separacao;
    const inputs: Array<unknown> = [
      null,
      undefined,
      '',
      'unknown_status',
      'EM_SEPARACAO', // case-sensitive
      'pronto',
      '   ',
      '\n',
      '💥',
      42,
      false,
      {},
      [],
    ];
    for (const v of inputs) {
      expect(
        () => getStatusCfg(v as string | null | undefined),
        `getStatusCfg(${JSON.stringify(v)}) não lança`,
      ).not.toThrow();
      expect(
        getStatusCfg(v as string | null | undefined),
        `fallback para ${JSON.stringify(v)}`,
      ).toBe(fallback);
    }
  });

  it.each(SUPPORTED_STATUSES)('renderiza sem crash para currentStatus=%s', (status) => {
    expect(() =>
      render(<CartStatusSelect currentStatus={status} onChange={() => {}} />),
    ).not.toThrow();
    const trigger = screen.getByTestId('cart-status-select');
    expect(trigger.getAttribute('data-status')).toBe(status);
    expect(trigger.getAttribute('aria-label')).toContain(STATUS_CONFIG[status].label);
  });

  it('não crasha e usa fallback quando currentStatus é um valor fora do domínio', () => {
    // Simulamos um payload corrompido vindo do BD (situação real em migrações).
    const bogus = 'legacy_unknown' as unknown as CartStatus;
    expect(() =>
      render(<CartStatusSelect currentStatus={bogus} onChange={() => {}} />),
    ).not.toThrow();
    const trigger = screen.getByTestId('cart-status-select');
    // aria-label deve refletir o label do fallback (Separação) sem quebrar
    expect(trigger.getAttribute('aria-label')).toContain(STATUS_CONFIG.em_separacao.label);
  });
});
