import { describe, expect, it } from 'vitest';
import { signupSchema } from '@/lib/validations/authSchema';

describe('signupSchema', () => {
  const validPayload = {
    fullName: 'João Silva',
    email: 'joao@exemplo.com',
    password: 'Forte@123',
    confirmPassword: 'Forte@123',
  };

  it('aceita dados válidos', () => {
    const parsed = signupSchema.safeParse(validPayload);
    expect(parsed.success).toBe(true);
  });

  it('rejeita campos obrigatórios vazios', () => {
    const parsed = signupSchema.safeParse({
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const messages = parsed.error.issues.map((issue) => issue.message);
      expect(messages).toContain('Nome deve ter pelo menos 2 caracteres');
      expect(messages).toContain('Email é obrigatório');
      expect(messages).toContain('Senha deve ter pelo menos 8 caracteres');
    }
  });

  it('rejeita e-mail em formato inválido', () => {
    const parsed = signupSchema.safeParse({ ...validPayload, email: 'email-invalido' });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.message === 'Email inválido')).toBe(true);
    }
  });

  it('rejeita senha fraca', () => {
    const parsed = signupSchema.safeParse({
      ...validPayload,
      password: '12345678',
      confirmPassword: '12345678',
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const messages = parsed.error.issues.map((issue) => issue.message);
      expect(messages).toContain('Senha deve conter letra maiúscula');
      expect(messages).toContain('Senha deve conter letra minúscula');
      expect(messages).toContain('Senha deve conter caractere especial');
    }
  });
});
