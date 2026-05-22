/**
 * Validação Zod compartilhada para Edge Functions.
 *
 * Política de status codes (versão 2026-05):
 *   - 400 INVALID_JSON  → body sintaticamente quebrado (não é JSON).
 *   - 400 MISSING_BODY  → body ausente ou string vazia.
 *   - 422 VALIDATION_FAILED → body é JSON válido mas falha o schema Zod.
 *   - 400 UNSUPPORTED_VERSION → header X-Contract-Version desconhecido.
 *
 * Shape único de erro (ver _shared/contracts/error-response.ts):
 *   { code, message, fields: [{ path, code, message }] }
 *
 * Helpers:
 *   - parseBodyWithSchema → caminho simples (single schema, sem versão).
 *   - parseRequestWithContract → caminho versionado (registry v1/v2/...).
 */

export { z } from "https://esm.sh/zod@3.23.8";
import { z } from "https://esm.sh/zod@3.23.8";

import {
  invalidJsonResponse,
  missingBodyResponse,
  validationErrorResponse,
} from "./contracts/error-response.ts";
import {
  resolveContractVersion,
  type ContractRegistry,
} from "./contracts/versioning.ts";

// ---------------------------------------------------------------------------
// parseBodyWithSchema (legacy entrypoint, agora 422 + shape novo)
// ---------------------------------------------------------------------------

/**
 * Lê o body como JSON e valida contra `schema`. Retorna `{ data }` em caso
 * de sucesso ou `{ error: Response }` (400/422) caso contrário.
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
      return { error: missingBodyResponse(corsHeaders) };
    }
    rawBody = JSON.parse(text);
  } catch {
    return { error: invalidJsonResponse(corsHeaders) };
  }

  const result = schema.safeParse(rawBody);
  if (!result.success) {
    return { error: validationErrorResponse(result.error, corsHeaders) };
  }
  return { data: result.data };
}

// ---------------------------------------------------------------------------
// parseRequestWithContract (versionado)
// ---------------------------------------------------------------------------

export interface ContractParseSuccess<TKey extends string, TData> {
  data: TData;
  version: TKey;
  /** Headers a propagar na resposta de sucesso (X-Contract-Version + deprecation). */
  responseHeaders: Record<string, string>;
}

/**
 * Resolve a versão do contrato e valida o body contra o schema correspondente.
 *
 *   const result = await parseRequestWithContract(req, contracts, corsHeaders);
 *   if ('error' in result) return result.error;
 *   const { data, version, responseHeaders } = result;
 *
 * Ecoar `responseHeaders` no Response final permite que clientes detectem qual
 * versão foi aplicada e respeitem Sunset/Deprecation quando relevante.
 */
export async function parseRequestWithContract<TKey extends string>(
  req: Request,
  registry: ContractRegistry<TKey>,
  corsHeaders: Record<string, string>,
): Promise<
  | ContractParseSuccess<TKey, unknown>
  | { error: Response }
> {
  const resolved = resolveContractVersion(req, registry, corsHeaders);
  if (!resolved.ok) return { error: resolved.response };

  const { version, entry, responseHeaders } = resolved.result;

  let rawBody: unknown;
  try {
    const text = await req.text();
    if (!text || text.trim() === "") {
      return { error: missingBodyResponse(corsHeaders) };
    }
    rawBody = JSON.parse(text);
  } catch {
    return { error: invalidJsonResponse(corsHeaders) };
  }

  const result = entry.schema.safeParse(rawBody);
  if (!result.success) {
    return {
      error: validationErrorResponse(result.error, corsHeaders, responseHeaders),
    };
  }
  return { data: result.data, version, responseHeaders };
}

// ---------------------------------------------------------------------------
// Schemas reutilizáveis
// ---------------------------------------------------------------------------

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
export const tokenSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/, "Invalid token format");

/** Base64 or URL image */
export const imageInputSchema = z.string().min(10).max(10_000_000);

/** Pagination */
export const paginationSchema = z
  .object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(500).default(50),
  })
  .partial();
