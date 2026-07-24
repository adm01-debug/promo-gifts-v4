import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email é obrigatório')
    .email('Email inválido')
    .transform((val) => val.toLowerCase()),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

export const signupSchema = z
  .object({
    fullName: z
      .string()
      .min(2, 'Nome deve ter pelo menos 2 caracteres')
      .max(100, 'Nome deve ter no máximo 100 caracteres'),
    email: z.string().min(1, 'Email é obrigatório').email('Email inválido'),
    password: z
      .string()
      .min(8, 'Senha deve ter pelo menos 8 caracteres')
      .regex(/[A-Z]/, 'Senha deve conter letra maiúscula')
      .regex(/[a-z]/, 'Senha deve conter letra minúscula')
      .regex(/[0-9]/, 'Senha deve conter número')
      .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Senha deve conter caractere especial'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Senhas não conferem',
    path: ['confirmPassword'],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Email é obrigatório').email('Email inválido'),
});

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Senha deve ter pelo menos 8 caracteres')
      .regex(/[A-Z]/, 'Senha deve conter letra maiúscula')
      .regex(/[a-z]/, 'Senha deve conter letra minúscula')
      .regex(/[0-9]/, 'Senha deve conter número')
      .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Senha deve conter caractere especial'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Senhas não conferem',
    path: ['confirmPassword'],
  });

export type LoginFormData = z.infer<typeof loginSchema>;
export type SignupFormData = z.infer<typeof signupSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
