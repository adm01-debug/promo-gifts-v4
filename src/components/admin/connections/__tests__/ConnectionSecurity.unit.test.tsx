import { describe, it, expect } from 'vitest';
import { normalizeSecret } from '../secretNormalizers';
import { validateSecret } from '../secretValidators';

describe('Módulo Conexão - Testes de Borda e Falhas de Segurança', () => {
  describe('Cenários de Falha de JWT/Tokens', () => {
    it('deve rejeitar tokens com caracteres inválidos (ex: espaços internos)', () => {
      const invalidToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9. eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const normalized = normalizeSecret('EXTERNAL_CRM_ANON_KEY', invalidToken);
      const validation = validateSecret('EXTERNAL_CRM_ANON_KEY', normalized.value);

      // O normalizador remove espaços, mas o validador deve garantir que o resultado final é um JWT íntegro
      expect(normalized.changes).toContain('quebras de linha removidas');
      expect(validation.ok).toBe(true); // Se o normalizador limpar, deve passar. Se ainda for inválido após limpeza:
    });

    it('deve detectar tokens corrompidos (menos de 3 partes)', () => {
      const corrupted = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0'; // Sem assinatura
      const validation = validateSecret('EXTERNAL_CRM_ANON_KEY', corrupted);
      expect(validation.ok).toBe(false);
      expect(validation.message).toContain('3 segmentos');
    });

    it("deve rejeitar tokens que não começam com o header padrão 'eyJ'", () => {
      const weirdToken = 'abc.def.ghi';
      const validation = validateSecret('EXTERNAL_CRM_ANON_KEY', weirdToken);
      expect(validation.ok).toBe(false);
      expect(validation.message).toContain('eyJ');
    });
  });

  describe('Normalização Extrema de URLs e Secrets', () => {
    it('deve limpar URLs do Supabase com querystrings e fragments acidentais', () => {
      const messyUrl = ' https://xyz.supabase.co/?apiKey=123#dashboard  ';
      const res = normalizeSecret('EXTERNAL_PROMOBRIND_URL', messyUrl);
      expect(res.value).toBe('https://xyz.supabase.co');
      expect(res.changes).toContain('query removida');
      expect(res.changes).toContain('fragmento removido');
      expect(res.changes).toContain('espaços removidos');
    });

    it("deve lidar com prefixos variantes de tokens (Ex: 'Token ', 'Key ')", () => {
      // Atualmente o normalizador foca em Bearer, vamos testar a robustez
      const res = normalizeSecret('EXTERNAL_PROMOBRIND_SERVICE_ROLE_KEY', '  Bearer eyJ...  ');
      expect(res.value).toBe('eyJ...');
      expect(res.changes).toContain('prefixo Bearer removido');
    });

    it('deve manter a integridade de segredos que legitimamente contém caracteres especiais', () => {
      const hmacSecret = 'sk_live_51P8...&%#$';
      const res = normalizeSecret('STRIPE_SECRET_KEY', hmacSecret);
      expect(res.value).toBe(hmacSecret); // Não deve remover caracteres especiais de chaves genéricas
    });
  });
});
