/**
 * supabase/functions/_shared/contracts/errors.ts
 *
 * Formato único de erro para falhas de validação (HTTP 422) e demais erros
 * estruturados retornados pelas Edge Functions.
 *
 * Inspirado em RFC 7807 (Problem Details), simplificado para uso interno.
 *
 * Forma canônica:
 *   {
 *     code:    "validation_failed" | "invalid_json" | "missing_body" | "unsupported_version" | ...
 *     message: string  // mensagem legível por humano
 *     fields:  FieldIssue[]  // sempre presente; [] quando não aplicável
 *     // opcionais (não-quebrantes):
 *     version?: string         // versão de contrato resolvida
 *     request_id?: string
 *   }
 *
 * Status HTTP de validação semântica = 422.
 * Status HTTP de payload sintaticamente inválido (JSON quebrado) = 400.
 * Status HTTP de versão de contrato não suportada = 406.
 *
 * Toda Edge Function que aceita body externo DEVE responder erros nesse formato.
 */

import { z } from "https://esm.sh/zod@3.23.8";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type ContractErrorCode =
  | "missing_body"
  | "invalid_json"
  | "validation_failed"
  | "unsupported_version"
  | "version_negotiation_failed";

export interface FieldIssue {
  /** Caminho do campo no JSON. Ex.: "product.sku", "items[0].price". */
  path: string;
  /** Mensagem específica do campo. */
  message: string;
  /** Código machine-readable do Zod (ex: "invalid_type", "too_small"). */
  code?: string;
  /** Valor recebido (útil em debug; nunca contém dados sensíveis pois schemas restringem o que entra). */
  received?: unknown;
}

export interface ContractError {
  code: ContractErrorCode;
  message: string;
  fields: FieldIssue[];
  version?: string;
  request_id?: string;
}

// ---------------------------------------------------------------------------
// Conversores
// ---------------------------------------------------------------------------

/**
 * Converte um `ZodError` num array `FieldIssue[]` plano.
 * Preserva paths aninhados (ex.: `product.images[2]`).
 */
export function zodErrorToFieldIssues(err: z.ZodError): FieldIssue[] {
  return err.issues.map((issue) => ({
    path: pathToDotNotation(issue.path),
    message: issue.message,
    code: issue.code,
  }));
}

function pathToDotNotation(path: (string | number)[]): string {
  if (path.length === 0) return "$";
  let out = "";
  for (const seg of path) {
    if (typeof seg === "number") {
      out += `[${seg}]`;
    } else {
      out += out === "" ? seg : `.${seg}`;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Builders de Response
// ---------------------------------------------------------------------------

interface ResponseOptions {
  corsHeaders?: Record<string, string>;
  version?: string;
  requestId?: string;
  extraHeaders?: Record<string, string>;
}

function buildResponse(
  status: number,
  body: ContractError,
  opts: ResponseOptions = {},
): Response {
  const headers: Record<string, string> = {
    ...(opts.corsHeaders ?? {}),
    ...(opts.extraHeaders ?? {}),
    "Content-Type": "application/json",
  };
  if (opts.version) headers["x-contract-version"] = opts.version;
  if (opts.requestId) headers["x-request-id"] = opts.requestId;
  return new Response(JSON.stringify(body), { status, headers });
}

/** HTTP 400 — body ausente. */
export function missingBodyResponse(opts: ResponseOptions = {}): Response {
  return buildResponse(400, {
    code: "missing_body",
    message: "Request body is required.",
    fields: [],
    version: opts.version,
    request_id: opts.requestId,
  }, opts);
}

/** HTTP 400 — JSON sintaticamente inválido. */
export function invalidJsonResponse(opts: ResponseOptions = {}): Response {
  return buildResponse(400, {
    code: "invalid_json",
    message: "Request body is not valid JSON.",
    fields: [],
    version: opts.version,
    request_id: opts.requestId,
  }, opts);
}

/** HTTP 422 — payload bem-formado mas inválido segundo o schema. */
export function validationErrorResponse(
  fields: FieldIssue[],
  opts: ResponseOptions = {},
): Response {
  return buildResponse(422, {
    code: "validation_failed",
    message: "One or more fields are invalid.",
    fields,
    version: opts.version,
    request_id: opts.requestId,
  }, opts);
}

/** HTTP 422 — atalho direto a partir de `ZodError`. */
export function zodValidationErrorResponse(
  err: z.ZodError,
  opts: ResponseOptions = {},
): Response {
  return validationErrorResponse(zodErrorToFieldIssues(err), opts);
}

/** HTTP 406 — versão de contrato solicitada não é suportada. */
export function unsupportedVersionResponse(
  requested: string,
  supported: string[],
  opts: ResponseOptions = {},
): Response {
  return buildResponse(406, {
    code: "unsupported_version",
    message:
      `Contract version "${requested}" is not supported. Supported versions: ${supported.join(", ")}.`,
    fields: [],
    version: opts.version,
    request_id: opts.requestId,
  }, opts);
}
