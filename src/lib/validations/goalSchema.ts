import { z } from 'zod';

const isValidCalendarDate = (val: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return false;
  const [y, m, d] = val.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() + 1 === m && date.getDate() === d;
};

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
    start_date: z
      .string()
      .min(1, 'Data de início é obrigatória')
      .refine(isValidCalendarDate, 'Data de início inválida'),
    end_date: z
      .string()
      .min(1, 'Data de fim é obrigatória')
      .refine(isValidCalendarDate, 'Data de fim inválida'),
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
