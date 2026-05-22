/**
 * Shared Zod validation utilities for edge functions.
 * Provides type-safe request body parsing with clear error messages.
 *
 * Error responses go through the unified builder in `./validation-errors.ts`,
 * so every Edge Function returns the same shape:
 *   - v1 (default): { error, details }
 *   - v2 (negotiated): { code, message, version, fields[] }
 *
 * Status code for schema-level failures is 422 Unprocessable Entity.
 * Status code for malformed / empty JSON body is 400 Bad Request.
 */

// Using Zod from esm.sh for Deno compatibility
export { z } from "https://esm.sh/zod@3.23.8";
import { z } from "https://esm.sh/zod@3.23.8";

import {
  buildErrorResponse,
  buildValidationErrorResponse,
  detectContractVersion,
} from "./validation-errors.ts";

/**
 * Parse and validate a request body against a Zod schema.
 * Returns parsed data on success, or a Response with the unified error shape
 * on failure (400 for malformed JSON, 422 for schema validation).
 */
export async function parseBodyWithSchema<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
  corsHeaders: Record<string, string>,
): Promise<{ data: z.infer<T> } | { error: Response }> {
  let rawBody: unknown;
  try {
    const text = await req.text();
    if (!text || text.trim() === "") {
      return {
        error: buildErrorResponse(
          "empty_body",
          "Request body is required",
          req,
          corsHeaders,
          { status: 400 },
        ),
      };
    }
    rawBody = JSON.parse(text);
  } catch {
    return {
      error: buildErrorResponse(
        "invalid_json",
        "Invalid JSON in request body",
        req,
        corsHeaders,
        { status: 400 },
      ),
    };
  }

  const result = schema.safeParse(rawBody);
  if (!result.success) {
    return {
      error: buildValidationErrorResponse(result.error, req, corsHeaders),
    };
  }

  return { data: result.data };
}

/**
 * Variant that accepts a parsed object (e.g., already-parsed JSON or query
 * params).  Useful for GET endpoints validating query strings.
 */
export function parseObjectWithSchema<T extends z.ZodTypeAny>(
  obj: unknown,
  schema: T,
  req: Request,
  corsHeaders: Record<string, string>,
): { data: z.infer<T> } | { error: Response } {
  const result = schema.safeParse(obj);
  if (!result.success) {
    return { error: buildValidationErrorResponse(result.error, req, corsHeaders) };
  }
  return { data: result.data };
}

// Re-export for convenience
export { detectContractVersion };
export type { ContractVersion } from "./validation-errors.ts";

// ========== Common reusable schemas ==========

/** UUID v4 string */
export const uuidSchema = z.string().uuid();

/** Non-empty trimmed string */
export const nonEmptyString = z.string().trim().min(1, "Cannot be empty");

/** Positive integer */
export const positiveInt = z.number().int().positive();

/** Non-negative number (for prices, quantities) */
export const nonNegativeNumber = z.number().nonnegative();

/** Email */
export const emailSchema = z.string().email().max(255);

/** Token (hex string, 64 chars) */
export const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/, "Invalid token format");

/** Base64 or URL image */
export const imageInputSchema = z.string().min(10).max(10_000_000);

/** Pagination */
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(500).default(50),
}).partial();
