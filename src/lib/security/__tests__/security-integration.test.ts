import { describe, it, expect } from 'vitest';
import { sanitizeHtml, sanitizeString } from '../validation';

describe('XSS Prevention & Sanitization', () => {
  describe('sanitizeHtml', () => {
    it('should strip script tags while preserving safe formatting', () => {
      const input = '<p>Hello <b>World</b><script>alert(1)</script></p>';
      const output = sanitizeHtml(input);
      expect(output).toContain('<p>Hello <b>World</b></p>');
      expect(output).not.toContain('<script>');
    });

    it('should remove dangerous attributes like onclick', () => {
      // QA: sanitizeHtml foi endurecido — agora remove TODA a tag quando há
      // atributos perigosos, em vez de só dropar o atributo. Mais seguro
      // contra bypasses via parsing tolerante de browser. O texto interno
      // continua preservado.
      const input = '<button onclick="alert(\'XSS\')">Click me</button>';
      const output = sanitizeHtml(input);
      expect(output).not.toContain('onclick');
      expect(output).not.toContain('alert');
      expect(output).toContain('Click me');
    });

    it('should remove javascript: pseudo-protocols', () => {
      const input = '<a href="javascript:alert(1)">Link</a>';
      const output = sanitizeHtml(input);
      // QA: idem — sanitizeHtml strip toda a tag <a> quando o href é
      // javascript:. Texto preservado, nenhuma capacidade de navegação
      // por pseudo-protocolo restou.
      expect(output).not.toContain('javascript:');
      expect(output).not.toContain('<a ');
      expect(output).toContain('Link');
    });

    it('should handle nested tags and malformed HTML reasonably', () => {
      const input = '<div><scr<script>ipt>alert(1)</script></div>';
      const output = sanitizeHtml(input);
      expect(output).not.toContain('<script>');
    });
  });

  describe('sanitizeString', () => {
    it('should fully escape all HTML special characters', () => {
      const input = '<img src=x onerror="alert(1)"> & "Test"';
      const output = sanitizeString(input);
      expect(output).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &quot;Test&quot;');
    });
  });
});
