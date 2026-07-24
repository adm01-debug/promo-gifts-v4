/**
 * webhook-events-catalog — Onda 12 #6
 * SSOT do catálogo conhecido de eventos para webhooks de saída.
 * Mantenha sincronizado com os triggers do código (quote/order/discount/kit).
 */

export interface WebhookEvent {
  key: string;
  label: string;
  description: string;
}

export interface WebhookEventGroup {
  category: string;
  label: string;
  events: WebhookEvent[];
}

export const WEBHOOK_EVENTS_CATALOG: WebhookEventGroup[] = [
  {
    category: 'quote',
    label: 'Orçamentos',
    events: [
      { key: 'quote.created', label: 'Criado', description: 'Novo orçamento gerado pelo vendedor' },
      {
        key: 'quote.updated',
        label: 'Atualizado',
        description: 'Itens, descontos ou notas alterados',
      },
      { key: 'quote.sent', label: 'Enviado', description: 'Link público enviado ao cliente' },
      { key: 'quote.approved', label: 'Aprovado', description: 'Cliente aprovou o orçamento' },
      { key: 'quote.rejected', label: 'Rejeitado', description: 'Cliente rejeitou o orçamento' },
      { key: 'quote.expired', label: 'Expirado', description: 'Prazo de validade venceu' },
    ],
  },
  {
    category: 'order',
    label: 'Pedidos',
    events: [
      {
        key: 'order.created',
        label: 'Criado',
        description: 'Pedido gerado a partir de orçamento aprovado',
      },
      { key: 'order.approved', label: 'Aprovado', description: 'Aprovado por gestor/admin' },
      { key: 'order.fulfilled', label: 'Concluído', description: 'Entregue / faturado' },
      { key: 'order.cancelled', label: 'Cancelado', description: 'Cancelamento do pedido' },
    ],
  },
  {
    category: 'discount',
    label: 'Descontos',
    events: [
      {
        key: 'discount.requested',
        label: 'Solicitado',
        description: 'Vendedor pediu aprovação de desconto acima da alçada',
      },
      { key: 'discount.approved', label: 'Aprovado', description: 'Admin aprovou o desconto' },
      { key: 'discount.rejected', label: 'Rejeitado', description: 'Admin rejeitou o desconto' },
    ],
  },
  {
    category: 'kit',
    label: 'Kits',
    events: [
      { key: 'kit.created', label: 'Criado', description: 'Novo kit personalizado salvo' },
      {
        key: 'kit.shared',
        label: 'Compartilhado',
        description: 'Link público gerado para cliente',
      },
      {
        key: 'kit.viewed',
        label: 'Visualizado',
        description: 'Cliente abriu o link compartilhado',
      },
    ],
  },
];

export const ALL_KNOWN_EVENTS = WEBHOOK_EVENTS_CATALOG.flatMap((g) => g.events.map((e) => e.key));

export function isLegacyEvent(key: string): boolean {
  return !ALL_KNOWN_EVENTS.includes(key);
}

export function findEventMeta(key: string): WebhookEvent | undefined {
  for (const g of WEBHOOK_EVENTS_CATALOG) {
    const found = g.events.find((e) => e.key === key);
    if (found) return found;
  }
  return undefined;
}
