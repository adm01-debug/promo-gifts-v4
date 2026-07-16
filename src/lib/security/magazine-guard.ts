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
  branding: Partial<MagazineClientBranding> | null | undefined,
): ValidationResult {
  if (!branding || typeof branding !== 'object') {
    return { isValid: false, errors: ['Configuração de branding inválida'], sanitized: {} };
  }

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

  // colors: each must be a valid CSS hex color
  if (branding.colors !== undefined) {
    const hexPattern = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    const defaults = { primary: '#000000', secondary: '#000000', text: '#000000' };
    const validatedColors = { ...defaults, ...branding.colors };

    for (const key of ['primary', 'secondary', 'text'] as const) {
      const value = validatedColors[key];
      if (!value || !hexPattern.test(value)) {
        errors.push(`Cor '${key}' deve ser um hex válido (ex: #FF0000)`);
        validatedColors[key] = '#000000';
      }
    }

    // Only emit known keys — prevents prototype pollution via extra color fields.
    sanitized.colors = {
      primary: validatedColors.primary,
      secondary: validatedColors.secondary,
      text: validatedColors.text,
    };
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
