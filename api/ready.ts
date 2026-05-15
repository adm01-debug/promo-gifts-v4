// /api/ready — readiness probe (runtime).
//
// Diferente de /api/health (estático, JSON gerado no build com metadados de
// versão/commit), este endpoint roda no edge runtime do Vercel a cada request
// e valida que as dependências externas críticas estão respondendo.
//
// Checagens:
//   1. ENV obrigatórias presentes (Supabase principal + externo)
//   2. Supabase principal — HEAD em /auth/v1/health (200/204)
//   3. Supabase externo  — HEAD em /rest/v1/ com apikey (200/401 ok, qualquer
//      resposta HTTP válida prova que o host está de pé; só falha em network err)
//
// Resposta:
//   200 → { status: "ready",      checks: {...}, latency_ms, commit, version }
//   503 → { status: "degraded"|"unhealthy", checks: {...}, ... }
//
// Usado pelo workflow .github/workflows/deploy-vercel.yml no smoke check
// pós-deploy (junto com /api/health).

export const config = { runtime: "edge" };

type CheckStatus = "ok" | "degraded" | "fail" | "skipped";
interface Check {
  status: CheckStatus;
  latency_ms?: number;
  error?: string;
  detail?: string;
}

const TIMEOUT_MS = 3500;

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new Error(`${label} timeout after ${ms}ms`)), ms),
    ),
  ]);
}

function checkEnv(): { check: Check; envs: Record<string, string | undefined> } {
  const required = [
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "VITE_EXTERNAL_SUPABASE_URL",
    "VITE_EXTERNAL_SUPABASE_ANON_KEY",
  ] as const;
  const envs: Record<string, string | undefined> = {};
  const missing: string[] = [];
  for (const k of required) {
    const v = process.env[k];
    envs[k] = v;
    if (!v) missing.push(k);
  }
  if (missing.length) {
    return {
      check: { status: "fail", error: `Missing env: ${missing.join(", ")}` },
      envs,
    };
  }
  return { check: { status: "ok", detail: `${required.length} vars presentes` }, envs };
}

async function pingSupabase(url: string, apikey: string, label: string): Promise<Check> {
  const t0 = Date.now();
  try {
    // /auth/v1/health responde 200 sem auth; rest/v1/ responde 200/401 com apikey
    const target = label === "supabase_main"
      ? `${url.replace(/\/$/, "")}/auth/v1/health`
      : `${url.replace(/\/$/, "")}/rest/v1/`;
    const res = await withTimeout(
      fetch(target, { method: "GET", headers: { apikey, Authorization: `Bearer ${apikey}` } }),
      TIMEOUT_MS,
      label,
    );
    const latency_ms = Date.now() - t0;
    // Qualquer resposta HTTP < 500 prova que o host está saudável.
    if (res.status < 500) {
      return { status: "ok", latency_ms, detail: `HTTP ${res.status}` };
    }
    return { status: "degraded", latency_ms, error: `HTTP ${res.status}` };
  } catch (err) {
    return {
      status: "fail",
      latency_ms: Date.now() - t0,
      error: (err as Error)?.message ?? "unknown",
    };
  }
}

export default async function handler(_req: Request): Promise<Response> {
  const start = Date.now();
  const checks: Record<string, Check> = {};

  // 1. Env vars
  const { check: envCheck, envs } = checkEnv();
  checks.env = envCheck;

  // 2/3. Supabase pings (em paralelo) — só roda se temos as URLs
  if (envs.VITE_SUPABASE_URL && envs.VITE_SUPABASE_PUBLISHABLE_KEY) {
    checks.supabase_main = await pingSupabase(
      envs.VITE_SUPABASE_URL,
      envs.VITE_SUPABASE_PUBLISHABLE_KEY,
      "supabase_main",
    );
  } else {
    checks.supabase_main = { status: "skipped", error: "missing url/key" };
  }

  if (envs.VITE_EXTERNAL_SUPABASE_URL && envs.VITE_EXTERNAL_SUPABASE_ANON_KEY) {
    checks.supabase_external = await pingSupabase(
      envs.VITE_EXTERNAL_SUPABASE_URL,
      envs.VITE_EXTERNAL_SUPABASE_ANON_KEY,
      "supabase_external",
    );
  } else {
    checks.supabase_external = { status: "skipped", error: "missing url/key" };
  }

  // Agregação
  const statuses = Object.values(checks).map((c) => c.status);
  let overall: "ready" | "degraded" | "unhealthy";
  if (statuses.some((s) => s === "fail")) {
    overall = "unhealthy";
  } else if (statuses.some((s) => s === "degraded")) {
    overall = "degraded";
  } else {
    overall = "ready";
  }

  const body = {
    status: overall,
    timestamp: new Date().toISOString(),
    latency_ms: Date.now() - start,
    commit:
      process.env.VERCEL_GIT_COMMIT_SHA ||
      process.env.GITHUB_SHA ||
      "unknown",
    env: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
    checks,
  };

  return new Response(JSON.stringify(body, null, 2), {
    status: overall === "unhealthy" ? 503 : 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
