/**
 * contract-versioning.ts — Versionamento de contratos para Edge Functions.
 *
 * Resolve o versionamento de contratos (v1, v2, ...) com retrocompatibilidade.
 *
 * Resolução de versão (ordem de prioridade):
 *   1. Header `x-api-version: 2`
 *   2. Query string `?v=2` ou `?api_version=2`
 *   3. Default (v1) — para chamadas existentes que ainda não declaram versão
 *
 * Versões depreciadas continuam funcionando, mas a resposta carrega:
 *   - Header `Deprecation: true`
 *   - Header `Sunset: <RFC 7231 date>`   (data planejada de remoção)
 *   - Header `Link: <docs URL>; rel="deprecation"`  (quando informado)
 *
 * Versão desconhecida → 400 UNSUPPORTED_VERSION via api-errors.ts.
 *
 * Uso típico:
 *
 *   const versioned = parseApiVersion(req, ["v1", "v2"], {
 *     defaultVersion: "v1",
 *     deprecated: { v1: { sunsetAt: "2026-12-31T00:00:00Z" } },
 *   });
 *   if ("error" in versioned) return versioned.error;
 *
 *   const schema = versioned.version === "v2" ? V2Schema : V1Schema;
 *   ...
 *   return withVersionHeaders(response, versioned);
 */

import { unsupportedVersionError400 } from "./api-errors.ts";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface DeprecationInfo {
  /** Data de Sunset em ISO 8601 (será convertida para HTTP-date). */
  sunsetAt: string;
  /** URL opcional com guia de migração. */
  migrationGuideUrl?: string;
}

export interface ParseVersionOptions<V extends string> {
  defaultVersion: V;
  /** Mapa de versões depreciadas. Chave = versão, valor = info de sunset. */
  deprecated?: Partial<Record<V, DeprecationInfo>>;
}

export interface VersionResolution<V extends string> {
  version: V;
  isDeprecated: boolean;
  deprecationInfo?: DeprecationInfo;
}

// ---------------------------------------------------------------------------
// Parse + validação
// ---------------------------------------------------------------------------

function normalizeVersion(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  // Aceita "1", "v1", "V1" → "v1"
  return /^v?\d+(\.\d+)?$/.test(trimmed)
    ? trimmed.startsWith("v") ? trimmed : `v${trimmed}`
    : trimmed;
}

/** Extrai a versão solicitada do header ou query string. Não valida ainda. */
export function readRequestedVersion(req: Request): string | null {
  const headerVal = req.headers.get("x-api-version");
  const fromHeader = normalizeVersion(headerVal);
  if (fromHeader) return fromHeader;

  try {
    const url = new URL(req.url);
    const queryVal = url.searchParams.get("v") ?? url.searchParams.get("api_version");
    return normalizeVersion(queryVal);
  } catch {
    return null;
  }
}

/**
 * Resolve a versão da API. Retorna `{ error }` se inválida, ou a versão final.
 */
export function parseApiVersion<V extends string>(
  req: Request,
  supportedVersions: readonly V[],
  options: ParseVersionOptions<V> & { corsHeaders: Record<string, string> },
):
  | { error: Response }
  | (VersionResolution<V> & { corsHeaders: Record<string, string> }) {
  const requested = readRequestedVersion(req);

  // Sem versão pedida → usar default. Não é erro.
  if (!requested) {
    return resolveVersion(options.defaultVersion, options);
  }

  // Versão pedida → validar contra suportadas.
  if (!supportedVersions.includes(requested as V)) {
    return {
      error: unsupportedVersionError400(requested, supportedVersions as readonly string[], {
        corsHeaders: options.corsHeaders,
      }),
    };
  }

  return resolveVersion(requested as V, options);
}

function resolveVersion<V extends string>(
  version: V,
  options: ParseVersionOptions<V> & { corsHeaders: Record<string, string> },
): VersionResolution<V> & { corsHeaders: Record<string, string> } {
  const deprecationInfo = options.deprecated?.[version];
  return {
    version,
    isDeprecated: Boolean(deprecationInfo),
    deprecationInfo,
    corsHeaders: options.corsHeaders,
  };
}

// ---------------------------------------------------------------------------
// Decoração de respostas
// ---------------------------------------------------------------------------

/**
 * Adiciona headers de versionamento e (se depreciada) Sunset/Deprecation à resposta.
 * Retorna sempre uma NOVA Response (Response é imutável após criada).
 */
export function withVersionHeaders<V extends string>(
  res: Response,
  resolution: VersionResolution<V>,
): Response {
  const newHeaders = new Headers(res.headers);
  newHeaders.set("x-api-version", resolution.version);

  if (resolution.isDeprecated && resolution.deprecationInfo) {
    newHeaders.set("Deprecation", "true");
    // RFC 7231 HTTP-date format
    const sunsetDate = new Date(resolution.deprecationInfo.sunsetAt);
    if (!Number.isNaN(sunsetDate.getTime())) {
      newHeaders.set("Sunset", sunsetDate.toUTCString());
    }
    if (resolution.deprecationInfo.migrationGuideUrl) {
      newHeaders.set(
        "Link",
        `<${resolution.deprecationInfo.migrationGuideUrl}>; rel="deprecation"`,
      );
    }
  }

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: newHeaders,
  });
}
