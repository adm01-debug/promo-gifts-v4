/**
 * Wrapper resiliente para fetch a APIs externas com circuit breaker integrado.
 *
 * BUG-A14 FIX (26/05/2026): `Retry-After` era hardcoded como 60s para todos os
 * serviços. CNPJA tem limite diário (pode levar horas), Dropbox tem recovery rápido.
 * `circuitOpenResponse` agora aceita `retryAfterSeconds` opcional (default: 60).
 * Cada função pode passar o valor correto para o serviço que está chamando.
 */
import { getBreaker } from "./circuit-breaker.ts";

export class CircuitOpenError extends Error {
  constructor(public service: string, public retryAfterSeconds = 60) {
    super(`circuit_open:${service}`);
    this.name = "CircuitOpenError";
  }
}

export class InsecureUrlError extends Error {
  constructor(public url: string) {
    super(`insecure_url:${url}`);
    this.name = "InsecureUrlError";
  }
}

function assertSecureUrl(url: string | URL): void {
  const allowHttp = Deno.env.get("ALLOW_HTTP_FETCH") === "1";
  const u = typeof url === "string" ? url : url.toString();
  if (allowHttp) return;
  if (!u.startsWith("https://")) {
    throw new InsecureUrlError(u);
  }
}

/** Mapa de Retry-After por serviço (segundos). Sobrescreve o default 60s. */
const SERVICE_RETRY_AFTER: Record<string, number> = {
  cnpja: 3600,          // CNPJA: limite diário ~35 req/dia — esperar 1h
  "image-cdn": 10,      // CDN de imagens: recovery rápido
  dropbox: 15,          // Dropbox: recupera em segundos
  elevenlabs: 30,       // ElevenLabs: rate limit por minuto
  bitrix: 5,            // Bitrix: normalmente transiente
};

export async function fetchWithBreaker(
  service: string,
  url: string | URL,
  init?: RequestInit,
): Promise<Response> {
  assertSecureUrl(url);

  const breaker = getBreaker(service);
  if (!breaker.canRequest()) {
    const retryAfter = SERVICE_RETRY_AFTER[service] ?? 60;
    throw new CircuitOpenError(service, retryAfter);
  }

  try {
    const res = await fetch(url, init);
    if (res.status >= 500) {
      breaker.recordFailure();
    } else {
      breaker.recordSuccess();
    }
    return res;
  } catch (err) {
    breaker.recordFailure();
    throw err;
  }
}

/**
 * Helper para responder 503 + Retry-After quando circuito aberto.
 * Use em catch blocks:
 *   `if (err instanceof CircuitOpenError) return circuitOpenResponse(err, corsHeaders);`
 */
export function circuitOpenResponse(
  err: CircuitOpenError,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({
      error: "Service temporarily unavailable",
      service: err.service,
      retry_after_seconds: err.retryAfterSeconds,
    }),
    {
      status: 503,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(err.retryAfterSeconds),
      },
    },
  );
}
