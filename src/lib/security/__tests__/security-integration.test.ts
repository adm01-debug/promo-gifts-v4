import { describe, it, expect } from "vitest";
import { sanitizeHtml, sanitizeString } from "../validation";

describe("XSS Prevention & Sanitization", () => {
  describe("sanitizeHtml", () => {
    it("should strip script tags while preserving safe formatting", () => {
      const input = "<p>Hello <b>World</b><script>alert(1)</script></p>";
      const output = sanitizeHtml(input);
      expect(output).toContain("<p>Hello <b>World</b></p>");
      expect(output).not.toContain("<script>");
    });

    it("should remove dangerous attributes like onclick", () => {
      // sanitizeHtml usa allowlist DOMPurify sem <button>: a tag inteira é
      // removida (mais seguro), preservando só o texto. O onclick desaparece.
      const input = '<button onclick="alert(\'XSS\')">Click me</button>';
      const output = sanitizeHtml(input);
      expect(output).toBe('Click me');
      expect(output).not.toContain('onclick');
    });

    it("should remove javascript: pseudo-protocols", () => {
      // <a> também não está na allowlist → removida, eliminando o href javascript:.
      const input = '<a href="javascript:alert(1)">Link</a>';
      const output = sanitizeHtml(input);
      expect(output).toBe('Link');
      expect(output).not.toContain('javascript:');
    });

    it("should handle nested tags and malformed HTML reasonably", () => {
      const input = "<div><scr<script>ipt>alert(1)</script></div>";
      const output = sanitizeHtml(input);
      expect(output).not.toContain("<script>");
    });
  });

  describe("sanitizeString", () => {
    it("should fully escape all HTML special characters", () => {
      const input = '<img src=x onerror="alert(1)"> & "Test"';
      const output = sanitizeString(input);
      expect(output).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &quot;Test&quot;');
    });
  });
});
