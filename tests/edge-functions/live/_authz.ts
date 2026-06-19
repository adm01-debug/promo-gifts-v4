/**
 * tests/edge-functions/live/_authz.ts
 * --------------------------------------------------------------
 * Deriva, a partir do SSOT `edge-authz-manifest.ts`, o comportamento esperado
 * de cada função na fronteira de autenticação + classifica funções destrutivas
 * (que NÃO podem ser exercitadas no happy-path live).
 */
import {
  EDGE_AUTHZ_MANIFEST,
  type AuthzCategory,
} from "../../../supabase/functions/_shared/edge-authz-manifest";
import type { EdgeRole } from "./_live-client";

export { EDGE_AUTHZ_MANIFEST };

export function categoryOf(fn: string): AuthzCategory | undefined {
  return EDGE_AUTHZ_MANIFEST[fn]?.category;
}

/**
 * Funções com `verify_jwt = false` em supabase/config.toml. Para elas o gateway
 * NÃO exige JWT → a chamada anônima ALCANÇA o handler (que pode validar inline e
 * devolver 400/401/422). Mantido em sincronia com config.toml (decodificado).
 */
export const VERIFY_JWT_FALSE = new Set<string>([
  "crm-db-bridge",
  "ai-recommendations",
  "external-db-inspect",
  "external-db-bridge",
  "image-proxy",
  "webhook-dispatcher",
  "webhook-inbound",
  "mcp-server",
  "connections-auto-test",
  "e2e-cleanup",
  "get-visitor-info",
  "cleanup-notifications",
  "cleanup-novelties",
  "collections-watcher",
  "comparison-price-watcher",
  "connections-health-check",
  "favorites-watcher",
  "ownership-audit",
  "process-queue",
  "process-scheduled-reports",
  "quote-followup-reminders",
  "send-digest",
  "send-notification",
  "send-scheduled-reports",
  "sync-external-db",
  // Cron functions with verify_jwt=false — called by pg_cron, not browsers.
  // Auth is enforced inline via x-cron-secret, so anon reaches the handler.
  "asia-ingestion",
  "backfill-image-dimensions",
]);

/**
 * Status aceitáveis para uma chamada ANÔNIMA (sem Authorization).
 * - verify_jwt=false OU public/scoped: o handler é alcançado → qualquer não-5xx
 *   é válido (200 happy, 400/422 validação, 401 assinatura, 429 rate-limit…).
 *   O contrato relevante é "sem crash 500".
 * - demais (gateway verify_jwt=true): gateway rejeita antes do handler → 401/403.
 */
export function expectedAnonStatuses(fn: string): { mode: "reject" | "reach" } {
  if (VERIFY_JWT_FALSE.has(fn)) return { mode: "reach" };
  const cat = categoryOf(fn);
  if (cat === "public" || cat === "scoped") return { mode: "reach" };
  return { mode: "reject" };
}

/**
 * Role a usar no happy-path positivo (quando aplicável).
 * NOTA: o gateway deste projeto aplica verify_jwt=true por padrão (a maioria
 * das funções, mesmo "public" no manifest, exige JWT válido em runtime).
 * Por isso public/scoped também usam um JWT de usuário no happy-path — sem
 * credencial, o happy-path faz skip gracioso.
 */
export function happyPathRole(fn: string): EdgeRole {
  const cat = categoryOf(fn);
  switch (cat) {
    case "supervisor":
      return "supervisor";
    case "dev":
      return "dev";
    default:
      return "authenticated"; // authenticated/public/scoped/service
  }
}

/**
 * Funções destrutivas / com efeito colateral externo: testar NEGATIVE-ONLY
 * (fronteira de auth + validação de input). NUNCA disparar o efeito real,
 * mesmo com credenciais — exceto via dry-run explícito quando suportado.
 */
export const DESTRUCTIVE = new Set<string>([
  // Envio externo (e-mail/push/webhooks reais)
  "send-digest",
  "send-scheduled-reports",
  "send-notification",
  "send-transactional-email",
  "webhook-dispatcher",
  "quote-followup-reminders",
  // Processamento de fila / jobs com escrita
  "process-queue",
  "process-scheduled-reports",
  // Limpezas destrutivas
  "cleanup-notifications",
  "cleanup-novelties",
  // Sync com sistemas externos (escrita)
  "bitrix-sync",
  "sync-quote-bitrix",
  "sync-external-db",
  "external-db-bridge",
  "crm-db-bridge",
  // Segurança com efeito amplo
  "bulk-random-passwords",
  "force-global-logout",
  "block-ip-temporarily",
  // Mutação de chaves
  "mcp-keys-issue",
  "mcp-keys-revoke",
  "mcp-keys-rotate",
  "mcp-keys-update",
  // Reparo com escrita (mas suporta dry_run → ver SUPPORTS_DRY_RUN)
  "ownership-repair",
  // Secrets
  "secrets-manager",
  // Utilitários de teste — criam e deletam registros no DB
  "test-cart-concurrency",
  "test-cart-limit",
  "test-cart-rls",
]);

/** Funções que suportam dry-run seguro (read-only quando dry_run=true). */
export const SUPPORTS_DRY_RUN = new Set<string>(["ownership-repair"]);

export function isDestructive(fn: string): boolean {
  return DESTRUCTIVE.has(fn);
}
