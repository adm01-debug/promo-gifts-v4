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
      // sanitizeHtml uses a restrictive ALLOWED_TAGS list (b, i, u, p, span,
      // br, ul, ol, li, strong, em). <button> isn't in it, so DOMPurify drops
      // the entire element — only the inner text survives. That's *more*
      // secure than preserving the tag with the onclick stripped; the goal
      // of the test (no executable script path remains) is trivially met.
      const input = '<button onclick="alert(\'XSS\')">Click me</button>';
      const output = sanitizeHtml(input);
      expect(output).toBe('Click me');
      expect(output).not.toContain('onclick');
      expect(output).not.toContain('<button');
    });

    it('should remove javascript: pseudo-protocols', () => {
      // Same rationale: <a> isn't in ALLOWED_TAGS so the entire anchor is
      // dropped — the javascript: URL never reaches the DOM.
      const input = '<a href="javascript:alert(1)">Link</a>';
      const output = sanitizeHtml(input);
      expect(output).toBe('Link');
      expect(output).not.toContain('javascript:');
      expect(output).not.toContain('<a');
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
