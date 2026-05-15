// /api/health — readiness/identity probe with per-request correlation ID.
//
// Mantém os metadados de build (status/version/commit/branch/builtAt/node/env)
// que o `scripts/generate-health.mjs` grava em `public/api/health.json` no
// prebuild — esse JSON continua existindo como artefato versionado e fonte
// canônica do build. Este edge handler apenas o lê e enriquece com:
//   - requestId  → propagado via header `x-request-id` (echo se vier do
//                  cliente, senão gerado via crypto.randomUUID())
//   - servedAt   → timestamp da resposta (≠ builtAt)
//
// O requestId é também emitido no log estruturado JSON para que, em caso de
// rollback automático, seja possível correlacionar a falha do smoke check
// com as entradas de log na Vercel.
//
// IMPORTANTE: o rewrite `/api/health → /api/health.json` foi REMOVIDO do
// vercel.json — agora `/api/health` resolve para esta função, e o JSON
// estático fica em `/api/health.json` (acessível diretamente para debug).

export const config = { runtime: "edge" };

interface HealthPayload {
  status: string;
  name?: string;
  version?: string;
  commit?: string;
  branch?: string;
  builtAt?: string;
  node?: string;
  env?: string;
}

// Importa o JSON gerado no prebuild. Vercel/esbuild resolvem JSON imports
// nativamente para edge functions — o conteúdo é embutido no bundle.
// Se o arquivo não existir (ambiente sem prebuild), caímos no fallback.
let BUILD_META: HealthPayload = { status: "ok" };
try {
  // @ts-expect-error — JSON import resolvido em build time
  const mod = await import("../public/api/health.json", { assert: { type: "json" } });
  BUILD_META = (mod.default ?? mod) as HealthPayload;
} catch {
  BUILD_META = {
    status: "ok",
    commit: process.env.VERCEL_GIT_COMMIT_SHA || "unknown",
    branch: process.env.VERCEL_GIT_COMMIT_REF || "unknown",
    env: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
  };
}

const REQUEST_ID_HEADER = "x-request-id";

function resolveRequestId(req: Request): { id: string; source: "client" | "generated" } {
  const incoming = req.headers.get(REQUEST_ID_HEADER);
  // Aceita apenas IDs sãos (alfanum + - _, 8..128 chars) para evitar log injection.
  if (incoming && /^[A-Za-z0-9_-]{8,128}$/.test(incoming)) {
    return { id: incoming, source: "client" };
  }
  return { id: crypto.randomUUID(), source: "generated" };
}

export default function handler(req: Request): Response {
  const { id: requestId, source } = resolveRequestId(req);
  const servedAt = new Date().toISOString();

  const payload = {
    ...BUILD_META,
    requestId,
    servedAt,
  };

  // Log estruturado JSON — capturado nos logs da Vercel e correlacionável
  // por requestId quando o smoke check do deploy registra o mesmo ID.
  console.log(
    JSON.stringify({
      level: "info",
      scope: "api.health",
      event: "health_served",
      requestId,
      requestIdSource: source,
      commit: BUILD_META.commit,
      version: BUILD_META.version,
      env: BUILD_META.env,
      servedAt,
      ua: req.headers.get("user-agent") ?? undefined,
    }),
  );

  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      [REQUEST_ID_HEADER]: requestId,
      "Access-Control-Expose-Headers": REQUEST_ID_HEADER,
    },
  });
}
