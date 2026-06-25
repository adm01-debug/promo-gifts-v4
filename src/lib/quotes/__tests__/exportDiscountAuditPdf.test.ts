import { describe, it, expect } from 'vitest';
import {
  buildDiscountAuditPdfPlan,
  type AuditRowForPdf,
  type DiscountAuditPdfContext,
} from '../exportDiscountAuditPdf';

const rows: AuditRowForPdf[] = [
  {
    event: 'requested',
    actor_role: 'seller',
    actor_name: 'Maria Vendedora',
    actor_email: 'maria@promo.com',
    requested_discount_percent: 18,
    max_allowed_percent: 10,
    real_discount_percent: 18,
    seller_notes: 'Cliente recorrente fechando 3 pedidos.',
    admin_notes: null,
    created_at: '2026-06-20T13:45:00.000Z',
  },
  {
    event: 'approved',
    actor_role: 'admin',
    actor_name: 'Gestor Comercial',
    actor_email: 'gestor@promo.com',
    requested_discount_percent: 18,
    max_allowed_percent: 10,
    real_discount_percent: 18,
    seller_notes: null,
    admin_notes: 'Aprovado mediante volume.',
    created_at: '2026-06-20T14:10:00.000Z',
  },
];

const ctx: DiscountAuditPdfContext = {
  requestId: 'req-1234-5678',
  quoteNumber: 'ORC-2026-0042',
  clientName: 'ACME Ltda',
  sellerName: 'Maria Vendedora',
  rows,
};

describe('buildDiscountAuditPdfPlan', () => {
  const plan = buildDiscountAuditPdfPlan(ctx);
  const flat = [
    plan.title,
    ...plan.header,
    ...plan.events.flatMap((e) => [
      e.title,
      e.timestamp,
      e.actor,
      e.metrics,
      e.sellerNotes ?? '',
      e.adminNotes ?? '',
    ]),
  ].join('\n');

  it('inclui vendedor, cliente e orçamento no cabeçalho', () => {
    expect(flat).toContain('Maria Vendedora');
    expect(flat).toContain('ACME Ltda');
    expect(flat).toContain('ORC-2026-0042');
  });

  it('inclui percentual solicitado e maxAllowedPercent em cada evento', () => {
    plan.events.forEach((e) => {
      expect(e.metrics).toMatch(/Solicitado:\s*18,00%/);
      expect(e.metrics).toMatch(/Limite:\s*10,00%/);
    });
  });

  it('inclui seller_notes quando presente', () => {
    expect(flat).toContain('Cliente recorrente fechando 3 pedidos.');
  });

  it('inclui lista de decisões (requested + approved) com timestamps', () => {
    expect(plan.events).toHaveLength(2);
    expect(plan.events[0].title).toBe('Solicitado pelo vendedor');
    expect(plan.events[1].title).toBe('Aprovado');
    plan.events.forEach((e) => {
      // timestamp em pt-BR (dd/mm/yyyy ...)
      expect(e.timestamp).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });
  });

  it('nomeia o arquivo com o número do orçamento', () => {
    expect(plan.fileName).toBe('historico-desconto-ORC-2026-0042.pdf');
  });
});
