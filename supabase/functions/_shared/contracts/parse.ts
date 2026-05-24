/**
 * supabase/functions/_shared/contracts/parse.ts
 *
 * Helper canônico para parsear + validar + versionar payloads de Edge Functions.
 *
 * Uso típico:
 *
 *   import { parseContract } from "../_shared/contracts/index.ts";
 *   import { ProductWebhookSchemas } from "../_shared/contracts/schemas/product-webhook.ts";
 *
 *   const result = await parseContract(req, ProductWebhookSchemas, {
 *     corsHeaders,
 *     requestId,
 *   });
 *   if (!result.ok) return result.response;
 *
 *   const { version, data } = result;
 *   // data tem o tipo da versão resolvida; `version` indica qual.
 *
 * Convenção: o objeto `schemas` é um `Record<version, ZodSchema>`. As versões
 * disponíveis viram automaticamente `supported`. `default` e `deprecated` são
 * configurados no `VersionConfig`.
 */

import { z } from "https://esm.sh/zod@3.23.8";
import {
  invalidJsonResponse,
  missingBodyResponse,
  zodValidationErrorResponse,
} from "./errors.ts";
import {
  resolveContractVersion,
  type VersionConfig,
} from "./versioning.ts";

export interface ContractSchemas<
  V extends string = string,
  S extends Record<V, z.ZodTypeAny> = Record<V, z.ZodTypeAny>,
> {
  /** Map versão → schema Zod. As chaves viram a lista de versões suportadas. */
  versions: S;
  /** Versão default quando o client não pedir nenhuma. */
  defaultVersion: V;
  /** Lista de versões em depreciação com data de sunset. */
  deprecated?: VersionConfig["deprecated"];
  /** Identificador legível do contrato (usado em logs). */
  name?: string;
}

export interface ParseOptions {
  corsHeaders?: Record<string, string>;
  requestId?: string;
  /** Permite passar um body já lido (útil quando a função precisa do raw para HMAC). */
  prereadBody?: string;
}

export type ParseResult<V extends string, S extends Record<V, z.ZodTypeAny>> =
  | {
    ok: true;
    version: V;
    /** Dados parseados; o tipo casa com o schema da versão resolvida. */
    data: { [K in V]: z.infer<S[K]> }[V];
    /** Headers que a resposta de sucesso deve incluir (versão, deprecation). */
    responseHeaders: Record<string, string>;
  }
  | { ok: false; response: Response };

/**
 * Parseia, valida e versiona o body de uma requisição.
 */
export async function parseContract<
  S extends Record<string, z.ZodTypeAny>,
>(
  req: Request,
  schemas: ContractSchemas<keyof S & string, S>,
  opts: ParseOptions = {},
): Promise<ParseResult<keyof S & string, S>> {
  const corsHeaders = opts.corsHeaders ?? {};

  // 1. Resolver versão
  type V = keyof S & string;
  const supportedVersions = Object.keys(schemas.versions) as V[];
  const versionConfig: VersionConfig = {
    supported: supportedVersions,
    default: schemas.defaultVersion,
    deprecated: schemas.deprecated,
  };
  const vRes = resolveContractVersion(req, versionConfig, corsHeaders);
  if (!vRes.ok) return { ok: false, response: vRes.response };

  const { version, responseHeaders } = vRes.resolved;
  const schema = schemas.versions[version as V];

  // 2. Ler body (uma única vez)
  let rawText: string;
  if (opts.prereadBody !== undefined) {
    rawText = opts.prereadBody;
  } else {
    try {
      rawText = await req.text();
    } catch {
      return {
        ok: false,
        response: invalidJsonResponse({
          corsHeaders,
          version,
          requestId: opts.requestId,
          extraHeaders: responseHeaders,
        }),
      };
    }
  }

  if (!rawText || rawText.trim() === "") {
    return {
      ok: false,
      response: missingBodyResponse({
        corsHeaders,
        version,
        requestId: opts.requestId,
        extraHeaders: responseHeaders,
      }),
    };
  }

  // 3. Parsear JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return {
      ok: false,
      response: invalidJsonResponse({
        corsHeaders,
        version,
        requestId: opts.requestId,
        extraHeaders: responseHeaders,
      }),
    };
  }

  // 4. Validar contra o schema
  const result = schema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      response: zodValidationErrorResponse(result.error, {
        corsHeaders,
        version,
        requestId: opts.requestId,
        extraHeaders: responseHeaders,
      }),
    };
  }

  return {
    ok: true,
    version: version as V,
    data: result.data,
    responseHeaders,
  };
}
