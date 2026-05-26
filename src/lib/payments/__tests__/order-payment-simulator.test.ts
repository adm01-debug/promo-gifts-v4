import { describe, expect, it } from 'vitest';
import { simulateOrderPayment, type OrderPaymentState } from '../order-payment-simulator';

const baseOrder = (): OrderPaymentState => ({
  orderId: 'order-123',
  status: 'pending',
  processedAttemptIds: [],
});

describe('simulateOrderPayment', () => {
  it('simula pagamento aprovado e confirma o pedido com mensagem correta', () => {
    const result = simulateOrderPayment(baseOrder(), { attemptId: 'a-1', status: 'approved' });

    expect(result.order.status).toBe('confirmed');
    expect(result.userMessage).toContain('Pagamento aprovado');
    expect(result.wasDuplicateAttempt).toBe(false);
  });

  it('simula pagamento recusado e cancela o pedido com mensagem correta', () => {
    const result = simulateOrderPayment(baseOrder(), { attemptId: 'a-2', status: 'rejected' });

    expect(result.order.status).toBe('cancelled');
    expect(result.userMessage).toContain('Pagamento recusado');
    expect(result.wasDuplicateAttempt).toBe(false);
  });

  it('simula pagamento pendente e mantém pedido pendente com mensagem correta', () => {
    const result = simulateOrderPayment(baseOrder(), { attemptId: 'a-3', status: 'pending' });

    expect(result.order.status).toBe('pending');
    expect(result.userMessage).toContain('Pagamento pendente');
    expect(result.wasDuplicateAttempt).toBe(false);
  });

  it('é idempotente em tentativas repetidas (mesmo attemptId)', () => {
    const first = simulateOrderPayment(baseOrder(), { attemptId: 'dup-1', status: 'approved' });
    const second = simulateOrderPayment(first.order, { attemptId: 'dup-1', status: 'approved' });

    expect(second.wasDuplicateAttempt).toBe(true);
    expect(second.order).toEqual(first.order);
    expect(second.order.processedAttemptIds).toEqual(['dup-1']);
  });
});
