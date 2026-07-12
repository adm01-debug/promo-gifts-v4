/**
 * Magazine Field Guards — Input Validation
 *
 * Runtime type guards and validators for magazine fields.
 * Prevents invalid/malicious data from entering the system.
 *
 * Applied at:
 * - validateStep() — before step transition
 * - canPublish() — before publication
 * - setBranding() — before saving branding data
 */

import { sanitizeUrl, sanitizeText } from './sanitize';
import type { MagazineClientBranding } from '@/types/magazine';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitized?: Partial<MagazineClientBranding>;
}

/**
 * validateBranding — validate and sanitize branding fields.
 * Returns sanitized values for safe persistence.
 */
export function validateBranding(
  branding: Partial<MagazineClientBranding>,
): ValidationResult {
  const errors: string[] = [];
  const sanitized: Partial<MagazineClientBranding> = {};

  // clientLogoUrl: must be https:// URL or null
  if (branding.clientLogoUrl !== undefined) {
    const safe = sanitizeUrl(branding.clientLogoUrl, { httpsOnly: true });
    if (branding.clientLogoUrl && !safe) {
      errors.push('URL do logo deve ser https://');
      sanitized.clientLogoUrl = null; // reject unsafe URL
    } else {
      sanitized.clientLogoUrl = safe;
    }
  }

  // primaryColor: must be valid CSS hex color
  if (branding.primaryColor !== undefined) {
    const hexPattern = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (branding.primaryColor && !hexPattern.test(branding.primaryColor)) {
      errors.push('Cor principal deve ser um hex válido (ex: #FF0000)');
      sanitized.primaryColor = '#000000'; // safe fallback
    } else {
      sanitized.primaryColor = branding.primaryColor;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
}

/**
 * validateTitle — validate magazine title.
 */
export function validateTitle(title: string | null | undefined): {
  isValid: boolean;
  sanitized: string;
  error?: string;
} {
  const raw = title ?? '';
  const sanitized = sanitizeText(raw); // strips any HTML tags

  if (!sanitized.trim()) {
    return { isValid: false, sanitized: '', error: 'Título não pode ser vazio' };
  }

  if (sanitized.length > 200) {
    return {
      isValid: false,
      sanitized: sanitized.slice(0, 200),
      error: 'Título muito longo (máx 200 caracteres)',
    };
  }

  return { isValid: true, sanitized };
}

/**
 * guardLogoUrl — convenience function for the stepValidation.ts warning.
 * Returns null (safe) if URL is dangerous; otherwise the URL.
 */
export function guardLogoUrl(url: string | null | undefined): string | null {
  return sanitizeUrl(url, { httpsOnly: false });
}
