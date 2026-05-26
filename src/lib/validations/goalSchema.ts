import { z } from 'zod';

export const salesGoalSchema = z
  .object({
    title: z
      .string()
      .min(2, 'Título deve ter pelo menos 2 caracteres')
      .max(100, 'Título deve ter no máximo 100 caracteres'),
    target_value: z
      .number()
      .positive('Meta deve ser um valor positivo')
      .max(999999999, 'Valor máximo excedido'),
    goal_type: z.enum(['revenue', 'quotes', 'orders', 'conversion'], {
      required_error: 'Tipo de meta é obrigatório',
    }),
    period: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly'], {
      required_error: 'Período é obrigatório',
    }),
    start_date: z.string().min(1, 'Data de início é obrigatória'),
    end_date: z.string().min(1, 'Data de fim é obrigatória'),
    notes: z
      .string()
      .max(500, 'Notas devem ter no máximo 500 caracteres')
      .optional()
      .or(z.literal('')),
  })
  .refine((data) => new Date(data.end_date) > new Date(data.start_date), {
    message: 'Data de fim deve ser posterior à data de início',
    path: ['end_date'],
  });

export type SalesGoalFormData = z.infer<typeof salesGoalSchema>;
