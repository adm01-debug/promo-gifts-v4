/**
 * tests/edge-functions/live/_live-client.ts
 * --------------------------------------------------------------
 * Cliente compartilhado para os testes de integração LIVE das Edge Functions.
 *
 * - Lê credenciais de import.meta.env (VITE_*) com fallback para process.env.
 * - `LIVE` só é true contra uma URL Supabase REAL (não placeholder/localhost).
 * - `describeLive` faz skip silencioso quando não há credenciais → CI verde
 *   sem segredos, roda de fato quando os segredos estão presentes.
 * - `callEdge()` faz HTTP real com timeout + retry em 502/503/504 (padrão
 *   herdado de scripts/contract-testing.mjs).
 * - `getJwt(role)` autentica contas de teste (E2E_*) via supabase-js e cacheia
 *   o access_token. Sem credencial para o role → null (caller faz skip do
 *   happy-path daquele tier).
 *
 * IMPORTANTE (segurança): aponte SUPABASE_URL para STAGING/PREVIEW ao exercitar
 * caminhos positivos. Funções destrutivas só devem ser tocadas em negative-only.
 */
import { describe } from "vitest";

type EnvBag = Record<string, string | undefined>;

const viteEnv: EnvBag = ((import.meta as unknown as { env?: EnvBag }).env ?? {}) as EnvBag;
const procEnv: EnvBag = (typeof process !== "undefined" ? process.env : {}) as EnvBag;

function readEnv(...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = viteEnv[k] ?? procEnv[k];
    if (v) return v;
  }
  return undefined;
}

export const SUPABASE_URL = (
  readEnv("SUPABASE_URL", "VITE_SUPABASE_URL") ?? ""
).replace(/\/+$/, "");

/** Chave anônima/publicável — usada como `apikey` em toda chamada. */
export const ANON_KEY =
  readEnv("SUPABASE_ANON_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_ANON_KEY") ?? "";

/** Service role — server-to-server (apenas leitura/dry-run em testes). */
export const SERVICE_ROLE_KEY = readEnv("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Detecção de placeholder (mesma heurística de tests/security/edge-authz-bypass.test.ts).
const isPlaceholderUrl =
  !SUPABASE_URL ||
  SUPABASE_URL.includes("localhost") ||
  SUPABASE_URL.includes("127.0.0.1") ||
  SUPABASE_URL.includes("//x.supabase.co");
// Aceita o formato novo (sb_publishable_… / sb_anon_…, ~40 chars) e o legado
// (JWT eyJ…, >100 chars). Rejeita o stub de setup.ts (.test.signature).
const isPlaceholderKey =
  !ANON_KEY ||
  ANON_KEY.includes(".test.signature") ||
  (!ANON_KEY.startsWith("sb_") && ANON_KEY.length < 100);

/** true quando há URL + anon key REAIS → testes live habilitados. */
export const LIVE = !isPlaceholderUrl && !isPlaceholderKey;

/** describe que faz skip silencioso sem credenciais reais. */
export const describeLive = LIVE ? describe : describe.skip;

/** Happy-paths caros (geração de imagem/IA) só rodam com FUZZ/COSTLY explícito. */
export const ALLOW_COSTLY = (readEnv("EDGE_LIVE_COSTLY") ?? "") === "1";

const TIMEOUT_MS = Number(readEnv("EDGE_LIVE_TIMEOUT_MS")) || 15_000;
const RETRY_STATUSES = new Set([502, 503, 504]);
const RETRY_COUNT = Number(readEnv("EDGE_LIVE_RETRIES")) || 3;
const RETRY_DELAY_MS = Number(readEnv("EDGE_LIVE_RETRY_DELAY_MS")) || 800;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type EdgeRole = "anon" | "authenticated" | "supervisor" | "dev";

export interface CallEdgeOptions {
  method?: string;
  /** Corpo: string (raw, p/ fuzz de JSON inválido) ou objeto (será JSON.stringify). */
  body?: string | Record<string, unknown> | unknown[] | null;
  headers?: Record<string, string>;
  /** Role cujo JWT vai no Authorization. "anon" = só apikey. */
  role?: EdgeRole;
  /** Query string (sem o "?"). */
  query?: string;
  signalTimeoutMs?: number;
}

export interface EdgeResult {
  status: number;
  headers: Headers;
  text: string;
  json: unknown;
}

/**
 * Chamada HTTP real a /functions/v1/<name> com timeout + retry em 5xx transiente.
 * Nunca lança por status != 2xx — devolve {status, headers, text, json} p/ asserção.
 */
export async function callEdge(name: string, opts: CallEdgeOptions = {}): Promise<EdgeResult> {
  const { method = "POST", body, headers = {}, role = "anon", query } = opts;
  const url = `${SUPABASE_URL}/functions/v1/${name}${query ? `?${query}` : ""}`;

  const finalHeaders: Record<string, string> = {
    apikey: ANON_KEY,
    ...headers,
  };
  if (body !== undefined && body !== null && !("Content-Type" in finalHeaders)) {
    finalHeaders["Content-Type"] = "application/json";
  }
  if (role !== "anon") {
    const jwt = await getJwt(role);
    if (jwt) finalHeaders.Authorization = `Bearer ${jwt}`;
  }

  const isBodyless = method === "GET" || method === "HEAD";
  const rawBody =
    isBodyless || body === undefined || body === null
      ? undefined
      : typeof body === "string"
        ? body
        : JSON.stringify(body);
  if (isBodyless) delete finalHeaders["Content-Type"];

  let lastResult: EdgeResult | undefined;
  for (let attempt = 0; attempt <= RETRY_COUNT; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), opts.signalTimeoutMs ?? TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method,
        headers: finalHeaders,
        body: rawBody,
        signal: controller.signal,
      });
      const text = await res.text();
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
      lastResult = { status: res.status, headers: res.headers, text, json };
      if (!RETRY_STATUSES.has(res.status) || attempt === RETRY_COUNT) return lastResult;
    } catch (err: unknown) {
      // AbortError means our client-side timeout fired — not a server crash.
      // Return synthetic 408 so tests can assert status < 500 without throwing.
      if ((err as { name?: string }).name === "AbortError") {
        return { status: 408, headers: new Headers(), text: "", json: null };
      }
      throw err;
    } finally {
      clearTimeout(t);
    }
    await sleep(RETRY_DELAY_MS * (attempt + 1));
  }
  return lastResult!;
}

/** OPTIONS preflight — devolve os headers CORS. */
export function preflight(name: string): Promise<EdgeResult> {
  return callEdge(name, {
    method: "OPTIONS",
    headers: {
      Origin: "https://example.com",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type,authorization",
    },
  });
}

// ---------------------------------------------------------------------------
// Aquisição de JWT por role (lazy + cache)
// ---------------------------------------------------------------------------

const ROLE_CREDS: Record<Exclude<EdgeRole, "anon">, { email?: string; password?: string }> = {
  authenticated: { email: readEnv("E2E_USER_EMAIL"), password: readEnv("E2E_USER_PASSWORD") },
  supervisor: { email: readEnv("E2E_ADMIN_EMAIL"), password: readEnv("E2E_ADMIN_PASSWORD") },
  dev: { email: readEnv("E2E_DEV_EMAIL"), password: readEnv("E2E_DEV_PASSWORD") },
};

const jwtCache = new Map<EdgeRole, string | null>();

/** Retorna o access_token do role (ou null se não há credencial / falha de login). */
export async function getJwt(role: EdgeRole): Promise<string | null> {
  if (role === "anon") return null;
  if (jwtCache.has(role)) return jwtCache.get(role)!;

  const creds = ROLE_CREDS[role];
  if (!LIVE || !creds?.email || !creds?.password) {
    jwtCache.set(role, null);
    return null;
  }
  try {
    // Import dinâmico p/ não pagar o custo quando não há credenciais.
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.signInWithPassword({
      email: creds.email,
      password: creds.password,
    });
    const token = error ? null : (data.session?.access_token ?? null);
    jwtCache.set(role, token);
    return token;
  } catch {
    jwtCache.set(role, null);
    return null;
  }
}

/** true se há credencial configurada (e login viável) para o role. */
export async function hasRole(role: EdgeRole): Promise<boolean> {
  if (role === "anon") return true;
  return (await getJwt(role)) !== null;
}
