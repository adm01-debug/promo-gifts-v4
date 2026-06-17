import { z } from 'zod';

export const quoteFormSchema = z
  .object({
    clientId: z.string().min(1, 'Empresa é obrigatória'),
    contactId: z.string().min(1, 'Contato é obrigatório'),
    paymentMethod: z.string().min(1, 'Forma de pagamento é obrigatória'),
    paymentTerms: z.string().min(1, 'Prazo de pagamento é obrigatório'),
    deliveryTime: z.string().min(1, 'Prazo de entrega é obrigatório'),
    shippingType: z.string().min(1, 'Tipo de frete é obrigatório'),
    shippingCost: z.number().default(0),
    validUntil: z.string().optional(),
    discountType: z.enum(['percent', 'amount']).default('percent'),
    discountValue: z.number().min(0, 'Desconto não pode ser negativo').default(0),
    notes: z.string().max(2000, 'Observações devem ter no máximo 2000 caracteres').optional(),
    internalNotes: z
      .string()
      .max(2000, 'Notas internas devem ter no máximo 2000 caracteres')
      .optional(),
  })
  .refine(
    (data) => {
      // Validação de frete: obrigatório valor se for FOB Valor Pré-negociado
      if (data.shippingType === 'fob_pre') {
        return typeof data.shippingCost === 'number' && data.shippingCost > 0;
      }
      // Se não for FOB pré, o custo DEVE ser 0 (consistência de payload)
      if (data.shippingType !== 'fob_pre' && data.shippingCost !== 0) {
        return false;
      }
      return true;
    },
    {
      message: 'Valor do frete inconsistente com a modalidade selecionada',
      path: ['shippingCost'],
    },
  );

export const quoteItemSchema = z.object({
  product_id: z.string().min(1, 'Produto é obrigatório'),
  product_name: z.string().min(1, 'Nome do produto é obrigatório'),
  product_sku: z.string().optional(),
  product_image_url: z.string().optional(),
  quantity: z.number().int().min(1, 'Quantidade mínima é 1'),
  unit_price: z.number().min(0, 'Preço não pode ser negativo'),
  color_name: z.string().optional(),
  color_hex: z.string().optional(),
});

/**
 * Validates quote form data and returns validation errors as field keys.
 * Used for inline validation in QuoteBuilderPage.
 */
const QUOTE_FIELD_NAMES: Record<string, string> = {
  clientId: 'empresa',
  contactId: 'contato',
  paymentMethod: 'forma_pagamento',
  paymentTerms: 'prazo_pagamento',
  deliveryTime: 'prazo_entrega',
  shippingType: 'frete',
  shippingCost: 'valor_frete',
} as const;

export function validateQuoteForm(data: {
  clientId: string;
  contactId: string;
  paymentMethod: string;
  paymentTerms: string;
  deliveryTime: string;
  shippingType: string;
  shippingCost: number;
  itemsCount: number;
}): string[] {
  const errors: string[] = [];

  const result = quoteFormSchema.safeParse({
    clientId: data.clientId,
    contactId: data.contactId,
    paymentMethod: data.paymentMethod,
    paymentTerms: data.paymentTerms,
    deliveryTime: data.deliveryTime,
    shippingType: data.shippingType,
    shippingCost: data.shippingCost,
  });

  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0] as string;
      const key = QUOTE_FIELD_NAMES[field] || field;
      if (!errors.includes(key)) errors.push(key);
    }
  }

  if (data.itemsCount === 0) {
    errors.push('itens');
  }

  return errors;
}

export const QUOTE_FIELD_LABELS: Record<string, string> = {
  empresa: 'Empresa',
  contato: 'Contato',
  forma_pagamento: 'Forma de Pagamento',
  prazo_pagamento: 'Prazo de Pagamento',
  prazo_entrega: 'Prazo de Entrega',
  frete: 'Frete',
  valor_frete: 'Valor do Frete',
  itens: 'Itens do Orçamento',
};

export type QuoteFormData = z.infer<typeof quoteFormSchema>;
export type QuoteItemData = z.infer<typeof quoteItemSchema>;
