/**
 * Shared Zod validation utilities for edge functions.
 * Provides type-safe request body parsing with clear error messages.
 */

// Using Zod from esm.sh for Deno compatibility
export { z } from "./contracts/_zod.ts";
import { z } from "./contracts/_zod.ts";

/**
 * Unified validation error response shape used by every Edge Function and webhook.
 * Stable contract — clients (n8n, Bitrix, internal web app) depend on this shape.
 *
 *   {
 *     "code": "VALIDATION_FAILED",
 *     "message": "Validation failed",
 *     "fields": [
 *       { "path": "product.sku", "code": "too_small", "message": "Cannot be empty" },
 *       { "path": "action",      "code": "invalid_enum_value", "message": "Invalid enum value" }
 *     ]
 *   }
 */
export interface ValidationFieldError {
  path: string;
  code: string;
  message: string;
}

export interface ValidationErrorBody {
  code: string;
  message: string;
  fields: ValidationFieldError[];
}

/** Canonical error codes returned by the validation layer. */
export const ERROR_CODES = {
  VALIDATION_FAILED: "VALIDATION_FAILED",
  INVALID_JSON: "INVALID_JSON",
  EMPTY_BODY: "EMPTY_BODY",
  UNSUPPORTED_VERSION: "UNSUPPORTED_VERSION",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** Build the canonical validation error body. */
export function buildValidationErrorBody(
  code: ErrorCode,
  message: string,
  fields: ValidationFieldError[] = []
): ValidationErrorBody {
  return { code, message, fields };
}

/** Convert a ZodError into the canonical list of field errors. */
export function zodErrorToFields(error: z.ZodError): ValidationFieldError[] {
  return error.issues.map((issue) => ({
    path: issue.path.length ? issue.path.join(".") : "(root)",
    code: issue.code,
    message: issue.message,
  }));
}

/** Build a JSON response with the unified validation error envelope.
 *
 * NOTE on backwards-compat: clients written before the 422 migration parse
 * `data.error` (literal string). We include `error: message` as an alias so
 * those clients keep reading something sensible during the deprecation
 * window. The canonical fields are `code`, `message`, `fields[]`.
 */
export function validationErrorResponse(
  body: ValidationErrorBody,
  corsHeaders: Record<string, string>,
  status = 422
): Response {
  return new Response(
    JSON.stringify({ ...body, error: body.message }),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "X-Error-Code": body.code,
      },
    }
  );
}

/**
 * Parse and validate a request body against a Zod schema.
 * Returns parsed data on success, or a 422 Response with the unified error envelope on failure.
 *
 * NOTE: 422 (Unprocessable Entity) is the canonical status for schema/validation
 * failures. Reserve 400 for malformed JSON / empty body cases.
 */
export async function parseBodyWithSchema<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
  corsHeaders: Record<string, string>
): Promise<{ data: z.infer<T> } | { error: Response }> {
  let rawBody: unknown;
  try {
    const text = await req.text();
    if (!text || text.trim() === "") {
      return {
        error: validationErrorResponse(
          buildValidationErrorBody(ERROR_CODES.EMPTY_BODY, "Request body is required"),
          corsHeaders,
          400
        ),
      };
    }
    rawBody = JSON.parse(text);
  } catch {
    return {
      error: validationErrorResponse(
        buildValidationErrorBody(ERROR_CODES.INVALID_JSON, "Invalid JSON in request body"),
        corsHeaders,
        400
      ),
    };
  }

  const result = schema.safeParse(rawBody);
  if (!result.success) {
    return {
      error: validationErrorResponse(
        buildValidationErrorBody(
          ERROR_CODES.VALIDATION_FAILED,
          "Validation failed",
          zodErrorToFields(result.error)
        ),
        corsHeaders,
        422
      ),
    };
  }

  return { data: result.data };
}

// ========== Common reusable schemas ==========

/** UUID v4 string */
export const uuidSchema = z.string().uuid();

/** Non-empty trimmed string */
export const nonEmptyString = z.string().trim().min(1, 'Cannot be empty');

/** Positive integer */
export const positiveInt = z.number().int().positive();

/** Non-negative number (for prices, quantities) */
export const nonNegativeNumber = z.number().nonnegative();

/** Email */
export const emailSchema = z.string().email().max(255);

/** Token (hex string, 64 chars) */
export const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/, 'Invalid token format');

/** Base64 or URL image */
export const imageInputSchema = z.string().min(10).max(10_000_000);

/** Pagination */
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(500).default(50),
}).partial();

// ========== Contract versioning ==========

/**
 * Map of contract version → schema. Use with `parseVersionedBody`
 * to support multiple payload shapes simultaneously.
 *
 * Convention:
 *   - The payload may include an explicit `version` field ("v1" | "v2" | ...).
 *   - If absent, the request header `X-Contract-Version` is honored.
 *   - If still absent, the `defaultVersion` from the map is used.
 *   - A 422 `UNSUPPORTED_VERSION` error is returned when the requested
 *     version is not in the map (e.g. a deprecated version that was removed).
 */
export interface VersionedSchemas<V extends string> {
  versions: Record<V, z.ZodTypeAny>;
  defaultVersion: V;
  /** Versions accepted at the wire but marked as deprecated (still parsed). */
  deprecatedVersions?: V[];
}

export function resolveContractVersion<V extends string>(
  req: Request,
  rawBody: unknown,
  schemas: VersionedSchemas<V>
): V | { error: ValidationErrorBody } {
  const headerVersion = req.headers.get("X-Contract-Version") || undefined;
  const bodyVersion =
    rawBody && typeof rawBody === "object" && "version" in rawBody
      ? String((rawBody as Record<string, unknown>).version)
      : undefined;
  const requested = (bodyVersion || headerVersion || schemas.defaultVersion) as V;
  if (!(requested in schemas.versions)) {
    return {
      error: buildValidationErrorBody(
        ERROR_CODES.UNSUPPORTED_VERSION,
        `Unsupported contract version: ${requested}`,
        [
          {
            path: "version",
            code: "invalid_version",
            message: `Supported versions: ${Object.keys(schemas.versions).join(", ")}`,
          },
        ]
      ),
    };
  }
  return requested;
}

/**
 * Parse a request body against a versioned schema map.
 * Returns { data, version } on success or { error: Response } on failure.
 */
export async function parseVersionedBody<V extends string>(
  req: Request,
  schemas: VersionedSchemas<V>,
  corsHeaders: Record<string, string>
): Promise<{ data: unknown; version: V } | { error: Response }> {
  let rawBody: unknown;
  try {
    const text = await req.text();
    if (!text || text.trim() === "") {
      return {
        error: validationErrorResponse(
          buildValidationErrorBody(ERROR_CODES.EMPTY_BODY, "Request body is required"),
          corsHeaders,
          400
        ),
      };
    }
    rawBody = JSON.parse(text);
  } catch {
    return {
      error: validationErrorResponse(
        buildValidationErrorBody(ERROR_CODES.INVALID_JSON, "Invalid JSON in request body"),
        corsHeaders,
        400
      ),
    };
  }

  const versionResult = resolveContractVersion(req, rawBody, schemas);
  if (typeof versionResult === "object") {
    return { error: validationErrorResponse(versionResult.error, corsHeaders, 422) };
  }
  const version = versionResult;
  const schema = schemas.versions[version];

  const parsed = schema.safeParse(rawBody);
  if (!parsed.success) {
    const body = buildValidationErrorBody(
      ERROR_CODES.VALIDATION_FAILED,
      "Validation failed",
      zodErrorToFields(parsed.error)
    );
    return {
      error: new Response(JSON.stringify(body), {
        status: 422,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "X-Error-Code": body.code,
          "X-Contract-Version": version,
        },
      }),
    };
  }

  return { data: parsed.data, version };
}
