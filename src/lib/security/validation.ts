import { z } from 'zod';
import DOMPurify from 'dompurify';

/**
 * Robustly sanitizes HTML strings to prevent XSS.
 * Removes dangerous tags and attributes using DOMPurify.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'u', 'p', 'span', 'br', 'ul', 'ol', 'li', 'strong', 'em'],
    ALLOWED_ATTR: ['class', 'style'],
  });
}

/**
 * Sanitizes a string for safe rendering in text context (fully escaped).
 */
export function sanitizeString(val: string): string {
  if (!val) return '';
  return val
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Standard Zod transformers
 */
export const safeString = z.string().trim().transform(sanitizeString);
export const safeHtml = z.string().trim().transform(sanitizeHtml);

/**
 * Higher-order component/helper for dangerouslySetInnerHTML
 * to ensure only sanitized HTML is used.
 */
export function createSafeHtml(html: string) {
  return { __html: sanitizeHtml(html) };
}

export const uuidSchema = z.string().uuid();
export const emailSchema = z.string().email();

export const userSchema = z.object({
  id: uuidSchema,
  email: emailSchema,
  full_name: z.string().min(1).max(255).optional(),
});
