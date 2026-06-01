import { describe, it, expect } from 'vitest';
import { validateSecret } from '../secretValidators';
import { normalizeSecret } from '../secretNormalizers';
import { resolveSupabaseConnectionStatus } from '../connectionStatus';

describe('Módulo Conexão - Testes de Lógica e Sanidade', () => {
  describe('Normalização de Secrets (Pre-Flight)', () => {
    it('deve remover aspas envolventes de URLs e tokens', () => {
      const res = normalizeSecret('BITRIX24_WEBHOOK_URL', '"https://test.bitrix24.com/rest/"');
      expect(res.value).toBe('https://test.bitrix24.com/rest/');
      expect(res.changes).toContain('aspas envolventes removidas');
    });

    it("deve remover prefixo 'Bearer ' de tokens JWT", () => {
      const res = normalizeSecret(
        'EXTERNAL_CRM_ANON_KEY',
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      );
      expect(res.value).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
      expect(res.changes).toContain('prefixo Bearer removido');
    });

    it('deve remover barra final de URLs do Supabase', () => {
      const res = normalizeSecret('EXTERNAL_PROMOBRIND_URL', 'https://xyz.supabase.co/');
      expect(res.value).toBe('https://xyz.supabase.co');
      expect(res.changes).toContain('barra final removida');
    });

    it('deve forçar barra final em Webhooks do Bitrix24', () => {
      const res = normalizeSecret('BITRIX24_WEBHOOK_URL', 'https://test.bitrix24.com/rest/1/abc');
      expect(res.value).toBe('https://test.bitrix24.com/rest/1/abc/');
      expect(res.changes).toContain('barra final adicionada');
    });
  });

  describe('Validação de Formato (Security Check)', () => {
    it('deve rejeitar URLs do Supabase sem protocolo HTTPS', () => {
      const res = validateSecret('EXTERNAL_PROMOBRIND_URL', 'http://xyz.supabase.co');
      expect(res.ok).toBe(false);
      expect(res.message).toContain('começar com https://');
    });

    it('deve rejeitar tokens JWT muito curtos (proteção contra truncamento)', () => {
      const res = validateSecret('EXTERNAL_CRM_ANON_KEY', 'eyJhbGciOiJIUzI1NiJ9');
      expect(res.ok).toBe(false);
      expect(res.message).toContain('JWT válido');
    });

    it('deve validar URLs n8n sem caminhos adicionais', () => {
      const res = validateSecret('N8N_BASE_URL', 'https://n8n.empresa.com/workflow');
      expect(res.ok).toBe(false);
      expect(res.message).toContain('sem caminho');
    });
  });

  describe('Resolução de Status de Conexão', () => {
    it("deve marcar como 'unconfigured' se faltar URL ou Key", () => {
      const status = resolveSupabaseConnectionStatus({
        readOnly: false,
        url: { has_value: true },
        service: { has_value: false },
      });
      expect(status).toBe('unconfigured');
    });

    it("deve marcar como 'error' se credenciais existem mas último teste falhou", () => {
      const status = resolveSupabaseConnectionStatus({
        readOnly: false,
        url: { has_value: true },
        service: { has_value: true },
        last: { ok: false },
      });
      expect(status).toBe('error');
    });

    it("deve marcar como 'active' se for read-only (local)", () => {
      const status = resolveSupabaseConnectionStatus({
        readOnly: true,
      });
      expect(status).toBe('active');
    });
  });
});
