export type PaymentGatewayStatus = 'approved' | 'pending' | 'rejected';

export type OrderFinalStatus = 'cancelled' | 'confirmed' | 'pending';

export interface PaymentAttempt {
  attemptId: string;
  status: PaymentGatewayStatus;
}

export interface OrderPaymentState {
  orderId: string;
  status: OrderFinalStatus;
  processedAttemptIds: string[];
}

export interface PaymentSimulationResult {
  order: OrderPaymentState;
  userMessage: string;
  wasDuplicateAttempt: boolean;
}

const USER_MESSAGES: Record<PaymentGatewayStatus, string> = {
  approved: 'Pagamento aprovado! Seu pedido foi confirmado.',
  rejected: 'Pagamento recusado. Tente novamente ou use outro método de pagamento.',
  pending: 'Pagamento pendente. Estamos aguardando a confirmação da operadora.',
};

const FINAL_STATUS_BY_PAYMENT: Record<PaymentGatewayStatus, OrderFinalStatus> = {
  approved: 'confirmed',
  rejected: 'cancelled',
  pending: 'pending',
};

export function simulateOrderPayment(
  current: OrderPaymentState,
  attempt: PaymentAttempt,
): PaymentSimulationResult {
  const alreadyProcessed = current.processedAttemptIds.includes(attempt.attemptId);

  if (alreadyProcessed) {
    return {
      order: current,
      userMessage: USER_MESSAGES[attempt.status],
      wasDuplicateAttempt: true,
    };
  }

  return {
    order: {
      ...current,
      status: FINAL_STATUS_BY_PAYMENT[attempt.status],
      processedAttemptIds: [...current.processedAttemptIds, attempt.attemptId],
    },
    userMessage: USER_MESSAGES[attempt.status],
    wasDuplicateAttempt: false,
  };
}
