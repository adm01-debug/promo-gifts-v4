/**
 * supabase/functions/_shared/contracts/versioning.ts
 *
 * Negociação de versão de contrato para Edge Functions / Webhooks.
 *
 * Estratégia de resolução (em ordem de prioridade):
 *   1. Header `accept-version: 2` (RFC-style; preferido)
 *   2. Query param `?v=2`
 *   3. Default da função
 *
 * Versões marcadas como `deprecated` continuam atendendo mas a resposta
 * inclui:
 *   - `Deprecation: true`           (RFC 8594)
 *   - `Sunset: <RFC1123 date>`      (RFC 8594)
 *   - `Link: <docs>; rel="deprecation"`
 *
 * Versões fora de `supported` retornam 406 (unsupported_version).
 */

import { unsupportedVersionResponse } from "./errors.ts";

export interface VersionConfig {
  /** Lista de versões aceitas (ex.: ["1", "2"]). */
  supported: string[];
  /** Versão usada quando nenhuma é solicitada. */
  default: string;
  /**
   * Versões em depreciação. Continuam funcionando, mas a resposta carrega
   * headers `Deprecation` / `Sunset`.
   */
  deprecated?: Array<{
    version: string;
    /** Data ISO (yyyy-mm-dd) em que a versão deixa de ser servida. */
    sunset: string;
    /** URL opcional do guia de migração. */
    migrationUrl?: string;
  }>;
}

export interface ResolvedVersion {
  /** Versão escolhida. */
  version: string;
  /** Se vier de `deprecated`, traz info do sunset. */
  deprecation?: {
    sunset: string;
    migrationUrl?: string;
  };
  /** Headers que devem ser anexados a TODA resposta (sucesso ou erro). */
  responseHeaders: Record<string, string>;
}

export type VersionResolution =
  | { ok: true; resolved: ResolvedVersion }
  | { ok: false; response: Response };

/**
 * Resolve a versão pedida pelo client. Retorna `Response` 406 se não suportada.
 */
export function resolveContractVersion(
  req: Request,
  config: VersionConfig,
  corsHeaders: Record<string, string> = {},
): VersionResolution {
  const requested = readRequestedVersion(req);
  const version = requested ?? config.default;

  if (!config.supported.includes(version)) {
    return {
      ok: false,
      response: unsupportedVersionResponse(version, config.supported, {
        corsHeaders,
      }),
    };
  }

  const dep = config.deprecated?.find((d) => d.version === version);
  const responseHeaders: Record<string, string> = {
    "x-contract-version": version,
  };
  if (dep) {
    responseHeaders["Deprecation"] = "true";
    responseHeaders["Sunset"] = toRfc1123(dep.sunset);
    if (dep.migrationUrl) {
      responseHeaders["Link"] = `<${dep.migrationUrl}>; rel="deprecation"`;
    }
  }

  return {
    ok: true,
    resolved: {
      version,
      deprecation: dep
        ? { sunset: dep.sunset, migrationUrl: dep.migrationUrl }
        : undefined,
      responseHeaders,
    },
  };
}

function readRequestedVersion(req: Request): string | null {
  // 1. Header `accept-version`
  const headerVal = req.headers.get("accept-version");
  if (headerVal) {
    // aceita "2", "v2", "2.0"
    return headerVal.replace(/^v/i, "").split(".")[0].trim();
  }

  // 2. Query param `?v=`
  try {
    const url = new URL(req.url);
    const qv = url.searchParams.get("v");
    if (qv) return qv.replace(/^v/i, "").split(".")[0].trim();
  } catch {
    /* ignore */
  }

  return null;
}

function toRfc1123(isoDate: string): string {
  // Aceita "2026-12-31" ou ISO completa; força UTC midnight.
  const d = isoDate.length === 10 ? new Date(`${isoDate}T00:00:00Z`) : new Date(isoDate);
  if (Number.isNaN(d.getTime())) {
    // Fallback: ecoa o valor (não trava o response, apenas perde validade RFC).
    return isoDate;
  }
  return d.toUTCString();
}
