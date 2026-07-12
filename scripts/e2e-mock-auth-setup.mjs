#!/usr/bin/env node
/**
 * Gera um `e2e/.auth/storageState.json` SINTÉTICO para rodar specs E2E
 * autenticadas sem depender de credenciais reais (`E2E_USER_EMAIL` /
 * `E2E_USER_PASSWORD`).
 *
 * ⚠️ Uso local/CI SEM secrets. NÃO substitui login real:
 *   • Os specs devem interceptar TODAS as chamadas de rede que exijam
 *     um JWT válido (ex.: `/rest/v1/**`, `/auth/v1/**`), ou o Supabase
 *     rejeitará o token sintético e derrubará a sessão.
 *   • O helper `e2e/helpers/mock-auth.ts` faz o pareamento no lado do
 *     browser, interceptando `/auth/v1/**`.
 *
 * Escreve o formato oficial do Playwright storageState:
 *   - cookies: 1 cookie sentinela (para o gate `authStorageHasCookies`);
 *   - origins[]: entrada com `localStorage` contendo a chave canônica
 *     do Supabase JS (`sb-<projectRef>-auth-token`) com uma sessão
 *     mock (JWT não-assinado + refresh_token fake + user).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// SSOT do projeto Supabase (mesmo valor em src/integrations/supabase/client.ts).
const PROJECT_REF = "doufsxqlfjyuvxuezpln";
const STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`;
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:8080";
const OUT = path.resolve(ROOT, "e2e/.auth/storageState.json");

// JWT sintético (header.payload.signature em base64url) — NUNCA será
// validado por um servidor real. Serve apenas para o cliente Supabase JS
// carregar a sessão sem erro de parse.
function b64url(obj) {
  return Buffer.from(JSON.stringify(obj))
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}
const nowSec = Math.floor(Date.now() / 1000);
const expSec = nowSec + 60 * 60 * 24; // 24h
const MOCK_USER_ID = "00000000-0000-0000-0000-e2e0e2e0e2e0";
const MOCK_EMAIL = "e2e-mock@promogifts.local";

const jwtHeader = b64url({ alg: "HS256", typ: "JWT" });
const jwtPayload = b64url({
  aud: "authenticated",
  sub: MOCK_USER_ID,
  email: MOCK_EMAIL,
  role: "authenticated",
  iat: nowSec,
  exp: expSec,
  aal: "aal1",
  amr: [{ method: "password", timestamp: nowSec }],
});
const jwtSig = "mock-signature-not-verified";
const accessToken = `${jwtHeader}.${jwtPayload}.${jwtSig}`;

const session = {
  access_token: accessToken,
  refresh_token: "mock-refresh-token",
  expires_in: 60 * 60 * 24,
  expires_at: expSec,
  token_type: "bearer",
  user: {
    id: MOCK_USER_ID,
    aud: "authenticated",
    role: "authenticated",
    email: MOCK_EMAIL,
    email_confirmed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { e2e_mock: true },
    identities: [],
  },
};

const storageState = {
  cookies: [
    {
      // Sentinela para o gate `authStorageHasCookies()` em test-base.
      name: "e2e-mock-auth",
      value: "1",
      domain: new URL(BASE_URL).hostname,
      path: "/",
      expires: expSec,
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ],
  origins: [
    {
      origin: BASE_URL,
      localStorage: [
        { name: STORAGE_KEY, value: JSON.stringify(session) },
        { name: "e2e-mock-auth", value: "1" },
      ],
    },
  ],
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(storageState, null, 2), "utf-8");

console.log(`✔ storageState mock gerado: ${OUT}`);
console.log(`  project_ref = ${PROJECT_REF}`);
console.log(`  base_url    = ${BASE_URL}`);
console.log(`  user_id     = ${MOCK_USER_ID}`);
console.log(`  expires_at  = ${new Date(expSec * 1000).toISOString()}`);
