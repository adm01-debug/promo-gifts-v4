import { z } from 'zod';

const phoneRegex = /^(\+?\d{1,3}[\s-]?)?\(?\d{2,3}\)?[\s-]?\d{4,5}[-]?\d{4}$/;

export const profileSchema = z.object({
  full_name: z
    .string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
  phone: z
    .string()
    .max(20, 'Telefone deve ter no máximo 20 caracteres')
    .refine(
      (val) => !val || phoneRegex.test(val.replace(/\s/g, '')),
      'Formato de telefone inválido. Ex: (11) 99999-9999',
    )
    .optional()
    .or(z.literal('')),
});

export type ProfileFormData = z.infer<typeof profileSchema>;
