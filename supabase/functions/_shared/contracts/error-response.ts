/**
 * Padronização de respostas de erro de contrato.
 *
 * Toda Edge Function que recebe payload JSON deve usar `validationErrorResponse`
 * (para falhas de validação semântica, 422) ou os helpers `invalidJsonResponse` /
 * `missingBodyResponse` (para input malformado, 400).
 *
 * Shape único:
 *   { code, message, fields: [{ path, code, message }] }
 *
 * - `code`: enum estável (snake_case UPPER) que clientes podem branchear.
 * - `message`: humano, em português, descrevendo o problema agregado.
 * - `fields`: lista de issues por path. Vazia para erros não-de-validação
 *   (INVALID_JSON, UNSUPPORTED_VERSION, etc.) para preservar shape.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export const ERROR_CODES = {
  VALIDATION_FAILED: "VALIDATION_FAILED",
  INVALID_JSON: "INVALID_JSON",
  MISSING_BODY: "MISSING_BODY",
  UNSUPPORTED_VERSION: "UNSUPPORTED_VERSION",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export interface FieldIssue {
  /** Dot-path do campo (ex.: "products.0.sku"). */
  path: string;
  /** Código Zod normalizado (invalid_type, too_small, required, etc.). */
  code: string;
  /** Mensagem amigável. */
  message: string;
}

export interface ErrorResponseBody {
  code: ErrorCode;
  message: string;
  fields: FieldIssue[];
}

// ---------------------------------------------------------------------------
// Conversão ZodError → FieldIssue[]
// ---------------------------------------------------------------------------

/**
 * Normaliza issues do Zod para o shape público `FieldIssue`.
 * - `path: []` (erro de nível raiz) vira `path: ""`.
 * - `invalid_type` com `received: 'undefined'` é remapeado para `required`
 *   (faz mais sentido para consumidores).
 */
export function zodErrorToFields(error: z.ZodError): FieldIssue[] {
  return error.issues.map((issue) => {
    const path = issue.path.map(String).join(".");
    let code: string = issue.code;
    if (
      issue.code === "invalid_type" &&
      (issue as { received?: string }).received === "undefined"
    ) {
      code = "required";
    }
    return { path, code, message: issue.message };
  });
}

// ---------------------------------------------------------------------------
// Helpers de Response
// ---------------------------------------------------------------------------

function jsonResponse(
  body: ErrorResponseBody,
  status: number,
  corsHeaders: Record<string, string>,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      ...extraHeaders,
      "Content-Type": "application/json",
    },
  });
}

/**
 * Resposta 422 para falha de validação semântica (Zod).
 * Use sempre que `schema.safeParse(body).success === false`.
 */
export function validationErrorResponse(
  error: z.ZodError,
  corsHeaders: Record<string, string>,
  extraHeaders: Record<string, string> = {},
): Response {
  const body: ErrorResponseBody = {
    code: ERROR_CODES.VALIDATION_FAILED,
    message: "Request body failed schema validation",
    fields: zodErrorToFields(error),
  };
  return jsonResponse(body, 422, corsHeaders, extraHeaders);
}

/** Resposta 400 para JSON malformado (sintaticamente inválido). */
export function invalidJsonResponse(
  corsHeaders: Record<string, string>,
): Response {
  const body: ErrorResponseBody = {
    code: ERROR_CODES.INVALID_JSON,
    message: "Invalid JSON in request body",
    fields: [],
  };
  return jsonResponse(body, 400, corsHeaders);
}

/** Resposta 400 para body ausente ou vazio. */
export function missingBodyResponse(
  corsHeaders: Record<string, string>,
): Response {
  const body: ErrorResponseBody = {
    code: ERROR_CODES.MISSING_BODY,
    message: "Request body is required",
    fields: [],
  };
  return jsonResponse(body, 400, corsHeaders);
}

/** Resposta 400 para versão de contrato desconhecida. */
export function unsupportedVersionResponse(
  requestedVersion: string,
  supportedVersions: readonly string[],
  corsHeaders: Record<string, string>,
): Response {
  const body: ErrorResponseBody = {
    code: ERROR_CODES.UNSUPPORTED_VERSION,
    message: `Contract version "${requestedVersion}" is not supported. Supported: ${supportedVersions.join(", ")}`,
    fields: [],
  };
  return jsonResponse(body, 400, corsHeaders);
}
