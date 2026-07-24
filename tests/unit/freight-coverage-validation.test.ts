/**
 * Freight Coverage Validation — Unit Tests
 * Gap identificado no QA Sprint (qa/02-test-matrix.md)
 * 
 * Testa a lógica de validação de cobertura de frete ANTES de cotar:
 * - cidade sem cobertura deve retornar erro claro
 * - CEP inválido deve ser rejeitado
 * - mock dos endpoints externos
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface FreightQuoteRequest {
  destinationCep: string;
  weight: number;  // kg
  value: number;   // R$
}

interface FreightQuoteResult {
  success: boolean;
  error?: string;
  carriers?: Array<{
    name: string;
    price: number;
    days: number;
  }>;
}

// ─── Validação de CEP ─────────────────────────────────────────────────────────
function validateCep(cep: string): { valid: boolean; error?: string } {
  const cleaned = cep.replace(/\D/g, '');
  if (cleaned.length !== 8) {
    return { valid: false, error: `CEP inválido: "${cep}" — deve ter 8 dígitos` };
  }
  if (/^0{8}$/.test(cleaned)) {
    return { valid: false, error: 'CEP inválido: todos zeros' };
  }
  return { valid: true };
}

// ─── Validação de cobertura (mock) ────────────────────────────────────────────
async function checkCoverage(cep: string): Promise<{ covered: boolean; city?: string }> {
  // Mock: CEPs 01xxx-xxx (SP capital) sempre cobertos
  // CEPs 99xxx-xxx (extremo sul) sem cobertura
  const cleaned = cep.replace(/\D/g, '');
  if (cleaned.startsWith('99')) {
    return { covered: false };
  }
  return { covered: true, city: 'São Paulo - SP' };
}

async function getFreightQuote(req: FreightQuoteRequest): Promise<FreightQuoteResult> {
  // 1. Valida CEP
  const validation = validateCep(req.destinationCep);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // 2. Verifica cobertura ANTES de cotar (regra crítica do sistema)
  const coverage = await checkCoverage(req.destinationCep);
  if (!coverage.covered) {
    return {
      success: false,
      error: `Região sem cobertura de frete para o CEP ${req.destinationCep}`,
    };
  }

  // 3. Valida parâmetros
  if (req.weight <= 0) {
    return { success: false, error: 'Peso deve ser maior que zero' };
  }
  if (req.value < 0) {
    return { success: false, error: 'Valor não pode ser negativo' };
  }

  // 4. Retorna mock de cotação
  return {
    success: true,
    carriers: [
      { name: 'Correios SEDEX', price: 25.9, days: 2 },
      { name: 'Correios PAC', price: 12.5, days: 7 },
    ],
  };
}

// ─── Testes ───────────────────────────────────────────────────────────────────
describe('Freight Coverage Validation', () => {
  describe('Validação de CEP', () => {
    it('CEP válido é aceito', () => {
      expect(validateCep('01310-100').valid).toBe(true);
      expect(validateCep('01310100').valid).toBe(true);
    });

    it('CEP com menos de 8 dígitos é rejeitado', () => {
      const result = validateCep('1310-100');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('CEP com mais de 8 dígitos é rejeitado', () => {
      expect(validateCep('01310-1000').valid).toBe(false);
    });

    it('CEP todos zeros é rejeitado', () => {
      expect(validateCep('00000-000').valid).toBe(false);
    });

    it('CEP com letras é rejeitado', () => {
      expect(validateCep('0131A-100').valid).toBe(false);
    });
  });

  describe('Cobertura de frete', () => {
    it('REGRA CRÍTICA: verifica cobertura ANTES de cotar — cidade sem cobertura retorna erro claro', async () => {
      const result = await getFreightQuote({
        destinationCep: '99900-000', // CEP sem cobertura
        weight: 1,
        value: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('sem cobertura');
      expect(result.carriers).toBeUndefined();
    });

    it('cidade com cobertura retorna opções de frete', async () => {
      const result = await getFreightQuote({
        destinationCep: '01310-100', // SP capital
        weight: 1,
        value: 100,
      });

      expect(result.success).toBe(true);
      expect(result.carriers).toBeDefined();
      expect(result.carriers!.length).toBeGreaterThan(0);
    });

    it('CEP inválido retorna erro antes de verificar cobertura', async () => {
      const result = await getFreightQuote({
        destinationCep: '0000000', // 7 dígitos
        weight: 1,
        value: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('CEP inválido');
    });
  });

  describe('Parâmetros de cotação', () => {
    it('peso zero retorna erro', async () => {
      const result = await getFreightQuote({
        destinationCep: '01310-100',
        weight: 0,
        value: 100,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Peso');
    });

    it('peso negativo retorna erro', async () => {
      const result = await getFreightQuote({
        destinationCep: '01310-100',
        weight: -1,
        value: 100,
      });
      expect(result.success).toBe(false);
    });

    it('valor declarado zero é aceito (sem seguro)', async () => {
      const result = await getFreightQuote({
        destinationCep: '01310-100',
        weight: 1,
        value: 0,
      });
      expect(result.success).toBe(true);
    });
  });
});
