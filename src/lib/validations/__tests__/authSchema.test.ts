import { describe, it, expect } from 'vitest';
import { loginSchema } from '../authSchema';

describe('loginSchema Email Normalization', () => {
  it('should normalize email to lowercase', () => {
    const data = {
      email: 'User@Example.COM',
      password: 'password123',
    };

    const result = loginSchema.parse(data);
    expect(result.email).toBe('user@example.com');
  });

  it('should validate invalid email', () => {
    const data = {
      email: 'not-an-email',
      password: 'password123',
    };

    const result = loginSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});
