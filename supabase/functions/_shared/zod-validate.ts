/**
 * Shared Zod validation utilities for edge functions.
 * Provides type-safe request body parsing with clear error messages.
 *
 * IMPORTANTE — duas APIs coexistem aqui:
 *   - `parseBodyWithSchema`      → @deprecated. Retorna 400 com formato antigo.
 *   - `parseBodyWithSchema422`   → padrão atual. Retorna 422 padronizado
 *                                  ({ code, message, fields[] }) via api-errors.ts.
 *
 * Novas Edge Functions DEVEM usar `parseBodyWithSchema422`. A versão legada
 * fica até migração completa (vide docs/CONTRACT_TESTING.md).
 */

// Using Zod from esm.sh for Deno compatibility
export { z } from "https://esm.sh/zod@3.23.8";
import { z } from "https://esm.sh/zod@3.23.8";
import {
  emptyBodyError400,
  invalidJsonError400,
  validationError422,
} from "./api-errors.ts";

/**
 * @deprecated Use `parseBodyWithSchema422` (formato 422 padronizado).
 *             Será removido após migração de todas as functions existentes.
 *
 * Parse and validate a request body against a Zod schema.
 * Returns parsed data on success, or a 400 Response on failure.
 */
export async function parseBodyWithSchema<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
  corsHeaders: Record<string, string>
): Promise<{ data: z.infer<T> } | { error: Response }> {
  let rawBody: unknown;
  try {
    const text = await req.text();
    if (!text || text.trim() === '') {
      return {
        error: new Response(
          JSON.stringify({ error: 'Request body is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        ),
      };
    }
    rawBody = JSON.parse(text);
  } catch {
    return {
      error: new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      ),
    };
  }

  const result = schema.safeParse(rawBody);
  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    const formErrors = result.error.flatten().formErrors;
    return {
      error: new Response(
        JSON.stringify({
          error: 'Validation failed',
          details: Object.keys(fieldErrors).length > 0 ? fieldErrors : formErrors,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      ),
    };
  }

  return { data: result.data };
}

/**
 * Parse and validate a request body, returning a 422 with standardized
 * `{ code, message, fields[] }` payload on schema failures.
 *
 * Behavior:
 *   - Body vazio       → 400 EMPTY_BODY
 *   - JSON malformado  → 400 INVALID_JSON
 *   - Schema falha     → 422 VALIDATION_FAILED + fields[] com path/message/code
 *   - Sucesso          → { data }
 *
 * Diferente de `parseBodyWithSchema` (legado), este helper:
 *   1. Separa parse-error (400) de schema-error (422), seguindo semântica HTTP.
 *   2. Retorna lista plana e estável de campos (caminhos com dot-notation),
 *      ideal para testes de contrato e exibição em UI.
 *   3. Aceita `apiVersion` para anotar a resposta com a versão resolvida.
 */
export async function parseBodyWithSchema422<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
  opts: { corsHeaders: Record<string, string>; apiVersion?: string }
): Promise<{ data: z.infer<T> } | { error: Response }> {
  let rawBody: unknown;
  try {
    const text = await req.text();
    if (!text || text.trim() === '') {
      return { error: emptyBodyError400(opts) };
    }
    rawBody = JSON.parse(text);
  } catch {
    return { error: invalidJsonError400(opts) };
  }

  const result = schema.safeParse(rawBody);
  if (!result.success) {
    return { error: validationError422(result.error, opts) };
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
