/**
 * Resolução de versão de contrato para Edge Functions.
 *
 * Estratégia:
 *   1. Header `X-Contract-Version` (preferido). Case-insensitive.
 *   2. Query string `?v=` (fallback útil para WebSockets / clientes simples).
 *   3. Default = primeira chave do registry (geralmente "v1").
 *
 * Em caso de versão desconhecida, retorna Response 400 com code
 * `UNSUPPORTED_VERSION` (vide error-response.ts).
 *
 * Versões marcadas como `deprecated` recebem headers padrão de descontinuação:
 *   - Deprecation: true
 *   - Sunset: <ISO date>
 * (RFC 8594 / draft-ietf-httpapi-deprecation-header).
 *
 * Por design, o registry NUNCA remove uma versão silenciosamente — quando uma
 * versão é descontinuada, ela permanece no registry com `status: 'deprecated'`
 * + `sunset` por pelo menos uma janela de aviso. Remover é uma decisão
 * deliberada e quebra clientes — testes em `tests/contract/edge-functions/`
 * (matriz negativa de UNSUPPORTED_VERSION) protegem contra remoções acidentais.
 */

import { z } from "zod";
import { unsupportedVersionResponse } from "./error-response.ts";

export type ContractStatus = "stable" | "deprecated";

export interface ContractEntry<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  schema: TSchema;
  status: ContractStatus;
  /** ISO date (`2026-08-22`). Obrigatório quando `status: 'deprecated'`. */
  sunset?: string;
  /** Payloads de exemplo — fonte única usada por testes e docs. */
  examples?: {
    valid: unknown[];
    invalid: Array<{ payload: unknown; expectedPath?: string }>;
  };
}

export type ContractRegistry<TKey extends string = string> = Record<
  TKey,
  ContractEntry
>;

export interface ResolveResult<TKey extends string> {
  version: TKey;
  entry: ContractEntry;
  /** Headers a ECOAR na resposta (X-Contract-Version + Deprecation/Sunset). */
  responseHeaders: Record<string, string>;
}

/** Lê header X-Contract-Version (ou ?v=) e devolve o nome cru, sem validar. */
export function readRequestedVersion(req: Request): string | null {
  const headerValue = req.headers.get("x-contract-version");
  if (headerValue) return headerValue.trim().toLowerCase();
  try {
    const url = new URL(req.url);
    const queryValue = url.searchParams.get("v");
    if (queryValue) return queryValue.trim().toLowerCase();
  } catch {
    // URL não-parseável — ignora silenciosamente.
  }
  return null;
}

/**
 * Resolve versão do contrato. Retorna `{ ok: true, ... }` com a entrada
 * resolvida ou `{ ok: false, response }` com a Response 400 pronta.
 *
 * Quando nenhuma versão é solicitada, usa a primeira chave do registry —
 * convencionalmente "v1", que deve sempre existir.
 */
export function resolveContractVersion<TKey extends string>(
  req: Request,
  registry: ContractRegistry<TKey>,
  corsHeaders: Record<string, string>,
):
  | { ok: true; result: ResolveResult<TKey> }
  | { ok: false; response: Response } {
  const supportedVersions = Object.keys(registry) as TKey[];
  if (supportedVersions.length === 0) {
    throw new Error("Contract registry is empty");
  }

  const requested = readRequestedVersion(req);
  const version = (requested ?? supportedVersions[0]) as TKey;

  if (!(version in registry)) {
    return {
      ok: false,
      response: unsupportedVersionResponse(
        version,
        supportedVersions,
        corsHeaders,
      ),
    };
  }

  const entry = registry[version];
  const responseHeaders: Record<string, string> = {
    "X-Contract-Version": version,
  };
  if (entry.status === "deprecated") {
    responseHeaders["Deprecation"] = "true";
    if (entry.sunset) responseHeaders["Sunset"] = entry.sunset;
  }

  return { ok: true, result: { version, entry, responseHeaders } };
}
