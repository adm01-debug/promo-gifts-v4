/**
 * Unified validation error response builder.
 *
 * Provides a single canonical error format for 422 Unprocessable Entity
 * responses across every Edge Function and webhook.  Supports two contract
 * versions:
 *
 *   v1 (legacy, default for backwards compatibility):
 *     { "error": "Validation failed", "details": { "field": ["msg", ...] } }
 *
 *   v2 (canonical, recommended):
 *     {
 *       "code": "validation_failed",
 *       "message": "Validation failed",
 *       "version": "v2",
 *       "fields": [{ "path": "a.b", "code": "invalid_type", "message": "..." }]
 *     }
 *
 * Version negotiation order (first match wins):
 *   1. ?api_version=v2 query string
 *   2. X-API-Version: v2 header
 *   3. Accept: application/vnd.promogifts.v2+json
 *   4. Default: v1
 *
 * Both shapes always carry the same semantic content; the v2 shape is a
 * superset so clients can migrate at their own pace without breaking
 * existing integrations (n8n, Bitrix, internal jobs).
 */

import type { ZodError, ZodIssue } from "https://esm.sh/zod@3.23.8";

export type ContractVersion = "v1" | "v2";

export const VALIDATION_ERROR_STATUS = 422;
export const VALIDATION_ERROR_CODE = "validation_failed";

export interface FieldError {
  /** Dotted path to the offending field, e.g. "product.images.0" */
  path: string;
  /** Stable machine-readable code (Zod issue code or custom) */
  code: string;
  /** Human-readable message (PT-BR or EN, depending on schema) */
  message: string;
}

export interface ValidationErrorV1 {
  error: string;
  details: Record<string, string[]> | string[];
}

export interface ValidationErrorV2 {
  code: string;
  message: string;
  version: "v2";
  fields: FieldError[];
}

export type ValidationErrorPayload = ValidationErrorV1 | ValidationErrorV2;

/**
 * Detect the contract version requested by the client.  Defaults to v1 to
 * preserve compatibility with existing callers that have not been updated.
 */
export function detectContractVersion(req: Request): ContractVersion {
  try {
    const url = new URL(req.url);
    const qsVersion = url.searchParams.get("api_version") || url.searchParams.get("version");
    if (qsVersion && /^v?2$/i.test(qsVersion)) return "v2";
    if (qsVersion && /^v?1$/i.test(qsVersion)) return "v1";
  } catch {
    /* ignore malformed URL */
  }
  const headerVersion = req.headers.get("x-api-version") || req.headers.get("X-Api-Version");
  if (headerVersion && /^v?2$/i.test(headerVersion)) return "v2";
  if (headerVersion && /^v?1$/i.test(headerVersion)) return "v1";

  const accept = req.headers.get("accept") || "";
  if (/vnd\.promogifts\.v2\+json/i.test(accept)) return "v2";

  return "v1";
}

/** Flatten a ZodError into [{path, code, message}, ...] for v2 responses. */
export function zodIssuesToFieldErrors(error: ZodError): FieldError[] {
  return error.issues.map((issue: ZodIssue) => ({
    path: issue.path.length > 0 ? issue.path.join(".") : "",
    code: issue.code,
    message: issue.message,
  }));
}

/** Build the v1 (legacy) shape: { error, details: { field: [msg...] } } */
export function buildValidationErrorV1(error: ZodError): ValidationErrorV1 {
  const fieldErrors = error.flatten().fieldErrors;
  const formErrors = error.flatten().formErrors;
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;
  return {
    error: "Validation failed",
    details: hasFieldErrors
      ? (fieldErrors as Record<string, string[]>)
      : formErrors,
  };
}

/** Build the v2 (canonical) shape: { code, message, version, fields[] } */
export function buildValidationErrorV2(error: ZodError, message?: string): ValidationErrorV2 {
  return {
    code: VALIDATION_ERROR_CODE,
    message: message ?? "Validation failed",
    version: "v2",
    fields: zodIssuesToFieldErrors(error),
  };
}

/** Build either v1 or v2 according to the negotiated contract version. */
export function buildValidationError(
  error: ZodError,
  version: ContractVersion,
  message?: string,
): ValidationErrorPayload {
  return version === "v2" ? buildValidationErrorV2(error, message) : buildValidationErrorV1(error);
}

/** Build a complete 422 Response from a ZodError + the original Request. */
export function buildValidationErrorResponse(
  error: ZodError,
  req: Request,
  corsHeaders: Record<string, string>,
  opts: { message?: string; status?: number } = {},
): Response {
  const version = detectContractVersion(req);
  const body = buildValidationError(error, version, opts.message);
  return new Response(JSON.stringify(body), {
    status: opts.status ?? VALIDATION_ERROR_STATUS,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "X-API-Version": version,
    },
  });
}

/** Generic non-Zod error helpers — keep the same shape for symmetry. */
export function buildGenericError(
  code: string,
  message: string,
  version: ContractVersion,
  fields: FieldError[] = [],
): ValidationErrorPayload {
  if (version === "v2") {
    return { code, message, version: "v2", fields };
  }
  return {
    error: message,
    details: fields.length > 0
      ? fields.reduce<Record<string, string[]>>((acc, f) => {
          const k = f.path || "_form";
          (acc[k] = acc[k] || []).push(f.message);
          return acc;
        }, {})
      : [],
  };
}

export function buildErrorResponse(
  code: string,
  message: string,
  req: Request,
  corsHeaders: Record<string, string>,
  opts: { status?: number; fields?: FieldError[] } = {},
): Response {
  const version = detectContractVersion(req);
  const body = buildGenericError(code, message, version, opts.fields ?? []);
  return new Response(JSON.stringify(body), {
    status: opts.status ?? 400,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "X-API-Version": version,
    },
  });
}
