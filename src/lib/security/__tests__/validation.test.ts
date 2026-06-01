import { describe, it, expect } from 'vitest';
import { sanitizeString } from '../validation';

describe('Security Sanitization', () => {
  it('should escape HTML tags to prevent XSS', () => {
    const malicious = '<script>alert("xss")</script>';
    const sanitized = sanitizeString(malicious);
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('should escape quotes and special characters', () => {
    const malicious = '"><img src=x onerror=alert(1)>';
    const sanitized = sanitizeString(malicious);
    expect(sanitized).toBe('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;');
  });
});
