/**
 * Node-compatible mirror of supabase/functions/_shared/validation-errors.ts
 * used by:
 *   - frontend (TS) consumers of edge responses
 *   - Vitest contract tests
 *
 * The Edge Function source file is the canonical one; this file MUST stay in
 * sync.  Both files are validated together by tests/edge-functions/
 * validation-error-contract.test.ts which imports schemas from both sides.
 */

import type { ZodError, ZodIssue } from 'zod';

export type ContractVersion = 'v1' | 'v2';

export const VALIDATION_ERROR_STATUS = 422;
export const VALIDATION_ERROR_CODE = 'validation_failed';

export interface FieldError {
  path: string;
  code: string;
  message: string;
}

export interface ValidationErrorV1 {
  error: string;
  details: Record<string, string[]> | string[];
}

export interface ValidationErrorV2 {
  code: string;
  message: string;
  version: 'v2';
  fields: FieldError[];
}

export type ValidationErrorPayload = ValidationErrorV1 | ValidationErrorV2;

export function detectContractVersion(req: { url: string; headers: Headers }): ContractVersion {
  try {
    const url = new URL(req.url);
    const qsVersion = url.searchParams.get('api_version') || url.searchParams.get('version');
    if (qsVersion && /^v?2$/i.test(qsVersion)) return 'v2';
    if (qsVersion && /^v?1$/i.test(qsVersion)) return 'v1';
  } catch {
    /* ignore */
  }
  const headerVersion = req.headers.get('x-api-version');
  if (headerVersion && /^v?2$/i.test(headerVersion)) return 'v2';
  if (headerVersion && /^v?1$/i.test(headerVersion)) return 'v1';

  const accept = req.headers.get('accept') || '';
  if (/vnd\.promogifts\.v2\+json/i.test(accept)) return 'v2';

  return 'v1';
}

export function zodIssuesToFieldErrors(error: ZodError): FieldError[] {
  return error.issues.map((issue: ZodIssue) => ({
    path: issue.path.length > 0 ? issue.path.join('.') : '',
    code: issue.code,
    message: issue.message,
  }));
}

export function buildValidationErrorV1(error: ZodError): ValidationErrorV1 {
  const fieldErrors = error.flatten().fieldErrors;
  const formErrors = error.flatten().formErrors;
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;
  return {
    error: 'Validation failed',
    details: hasFieldErrors ? (fieldErrors as Record<string, string[]>) : formErrors,
  };
}

export function buildValidationErrorV2(error: ZodError, message?: string): ValidationErrorV2 {
  return {
    code: VALIDATION_ERROR_CODE,
    message: message ?? 'Validation failed',
    version: 'v2',
    fields: zodIssuesToFieldErrors(error),
  };
}

/**
 * Build a v2 payload from a manually-constructed fieldErrors dict
 * (Record<path, string[]>).  Use this when business-rule validation runs
 * AFTER Zod has succeeded (e.g., cross-table checks, server-side TTL caps,
 * "full" scope guards) and you want a single canonical response shape.
 *
 * Each entry becomes a FieldError with code="business_rule".
 */
export function buildValidationErrorV2FromFields(
  fields: Record<string, string[]>,
  opts: { message?: string; code?: string } = {},
): ValidationErrorV2 {
  const out: FieldError[] = [];
  for (const [path, msgs] of Object.entries(fields)) {
    for (const msg of msgs) {
      out.push({ path, code: opts.code ?? 'business_rule', message: msg });
    }
  }
  return {
    code: VALIDATION_ERROR_CODE,
    message: opts.message ?? 'Validation failed',
    version: 'v2',
    fields: out,
  };
}

export function buildValidationError(
  error: ZodError,
  version: ContractVersion,
  message?: string,
): ValidationErrorPayload {
  return version === 'v2' ? buildValidationErrorV2(error, message) : buildValidationErrorV1(error);
}

export function isValidationErrorV2(p: unknown): p is ValidationErrorV2 {
  if (!p || typeof p !== 'object') return false;
  const o = p as Record<string, unknown>;
  return (
    o.code === VALIDATION_ERROR_CODE &&
    o.version === 'v2' &&
    typeof o.message === 'string' &&
    Array.isArray(o.fields)
  );
}

export function isValidationErrorV1(p: unknown): p is ValidationErrorV1 {
  if (!p || typeof p !== 'object') return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o.error === 'string' &&
    'details' in o &&
    (typeof o.details === 'object' || Array.isArray(o.details))
  );
}
