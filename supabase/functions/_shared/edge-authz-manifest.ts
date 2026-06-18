/**
 * Manifest SSOT — Authorization requirements per Edge Function
 * --------------------------------------------------------------
 * Cada edge function deployada deve aparecer aqui com sua categoria
 * de autorização. Este manifest é a fonte de verdade consumida pelo
 * gate de CI (`scripts/check-edge-authorization.mjs`) e pelos testes
 * de bypass (`tests/security/edge-authz-bypass.test.ts`).
 *
 * Categorias:
 *   - "public":          chamável sem autenticação (rotas públicas por token,
 *                        webhooks com assinatura, health, image-proxy etc.).
 *   - "authenticated":   exige JWT válido, qualquer role (incl. agente).
 *   - "supervisor":      exige role >= supervisor (admin/dev).
 *   - "dev":             exige role dev.
 *   - "service":         só pode ser chamada server-to-server (cron / outra edge),
 *                        verify_jwt true + tipicamente service_role no caller.
 *   - "scoped":          autenticação custom (token/HMAC/scope MCP) — validada
 *                        in-function com lógica própria.
 *
 * Política: TODA edge nova precisa ser adicionada aqui no mesmo PR
 * que cria a função. O gate CI falha se houver função em
 * `supabase/functions/<name>/index.ts` ausente do manifest.
 */
export type AuthzCategory =
  | "public"
  | "authenticated"
  | "supervisor"
  | "dev"
  | "service"
  | "scoped";

export interface AuthzEntry {
  /** Categoria principal */
  category: AuthzCategory;
  /** Comentário curto explicando a decisão */
  rationale: string;
  /**
   * Mecanismo de enforcement. Default = "shared-authorize" (helper SSOT).
   * "custom" = implementação própria legítima (validação inline de
   * has_role, scope MCP, HMAC, etc.) — exige rationale claro.
   */
  enforcedBy?: "shared-authorize" | "custom";
  /** Se true, o teste de bypass anon é dispensado */
  skipAnonBypassTest?: boolean;
  /** Se true, o teste de bypass authenticated é dispensado */
  skipAuthBypassTest?: boolean;
}

export const EDGE_AUTHZ_MANIFEST: Record<string, AuthzEntry> = {
  // ---------------- Públicas por design ----------------
  "cors-audit": { category: "dev", rationale: "Auditoria CORS — dev only via shared-authorize" },
  "image-proxy": { category: "public", rationale: "Proxy de imagens (anti-hotlink CDN externos)" },
  "cnpj-lookup": { category: "public", rationale: "Lookup CNPJ via API pública" },
  "health-check": { category: "public", rationale: "Health endpoint para uptime monitors" },
  "get-visitor-info": { category: "public", rationale: "Geo/IP do visitante para anti-fraude" },
  "verify-email": { category: "public", rationale: "Verificação de email no signup público" },
  "log-login-attempt": { category: "public", rationale: "Telemetria de login (anti-bruteforce)" },
  "rate-limit-check": { category: "public", rationale: "Rate-limit consult anonymous" },
  "commemorative-dates": { category: "public", rationale: "Calendário público" },
  "categories-api": { category: "public", rationale: "Catálogo de categorias público" },
  "materials-api": { category: "public", rationale: "Catálogo de materiais público" },
  "generate-mockup": { category: "public", rationale: "Geração de mockup — token público assinado", enforcedBy: "custom", skipAnonBypassTest: true },
  "product-webhook": { category: "public", rationale: "Webhook de produto — HMAC inline", enforcedBy: "custom", skipAnonBypassTest: true },
  "webhook-inbound": { category: "public", rationale: "Webhook inbound — assinatura HMAC", enforcedBy: "custom", skipAnonBypassTest: true },
  "semantic-search": { category: "public", rationale: "Busca semântica — rate-limited, sem dados sensíveis", skipAnonBypassTest: true },
  "detect-new-device": { category: "public", rationale: "Detecção de novo dispositivo no login" },
  "dropbox-list": { category: "public", rationale: "Listagem Dropbox — token público" },
  "elevenlabs-scribe-token": { category: "public", rationale: "Token temporário para ElevenLabs scribe" },
  "elevenlabs-tts": { category: "public", rationale: "TTS público via ElevenLabs" },
  "check-login": { category: "public", rationale: "Pre-login security check — IP/city/lockout, chamada antes de supabase.auth.signIn()", skipAnonBypassTest: true },

  // ---------------- Autenticadas (JWT obrigatório) ----------------
  "send-notification": { category: "authenticated", rationale: "Notificação do próprio user" },
  "send-digest": { category: "authenticated", rationale: "Digest do próprio user" },
  "send-scheduled-reports": { category: "authenticated", rationale: "Relatórios agendados do user" },
  "process-scheduled-reports": { category: "authenticated", rationale: "Processamento dos relatórios agendados" },
  "process-queue": { category: "authenticated", rationale: "Fila de jobs do user" },
  "webhook-dispatcher": { category: "authenticated", rationale: "Dispatcher de webhooks com autenticação" },
  "connections-hub-audit": { category: "authenticated", rationale: "Auditoria de conexões do user" },
  "connections-auto-test": { category: "authenticated", rationale: "Teste automático de conexões do user" },
  "connections-health-check": { category: "authenticated", rationale: "Health check das conexões do user" },
  "quote-followup-reminders": { category: "authenticated", rationale: "Lembretes de follow-up de cotações" },
  "ownership-audit": { category: "authenticated", rationale: "Auditoria de propriedade — JWT + service-role" },
  "cleanup-notifications": { category: "authenticated", rationale: "Limpeza de notificacoes via cron — authorizeCron" },
  "cleanup-novelties": { category: "authenticated", rationale: "Limpeza de novidades via cron — authorizeCron" },
  "collections-watcher": { category: "authenticated", rationale: "Watcher de coleções do user" },
  "favorites-watcher": { category: "authenticated", rationale: "Watcher de favoritos do user" },
  "comparison-price-watcher": { category: "authenticated", rationale: "Watcher de preços para comparação" },
  "external-db-bridge": { category: "authenticated", rationale: "Bridge para DB externo do user" },
  "kit-ai-builder": { category: "authenticated", rationale: "Builder de kit por IA" },
  "kit-identity-suggest": { category: "authenticated", rationale: "Sugestão de identidade do kit" },
  "expert-chat": { category: "authenticated", rationale: "Chat com expert — JWT user" },
  "visual-search": { category: "authenticated", rationale: "Busca visual — JWT user" },
  "ai-recommendations": { category: "authenticated", rationale: "Recomendações de IA" },
  "generate-ad-image": { category: "authenticated", rationale: "Geração de imagem de anúncio" },
  "generate-ad-prompt": { category: "authenticated", rationale: "Geração de prompt para anúncio" },
  "generate-product-seo": { category: "authenticated", rationale: "SEO de produto" },
  "analyze-logo-colors": { category: "authenticated", rationale: "Análise de cores de logo" },
  "magic-up-score": { category: "authenticated", rationale: "Scoring criativo do user" },
  "voice-agent": { category: "authenticated", rationale: "Voice agent do user" },
  "quote-sync": { category: "authenticated", rationale: "Sync do orçamento do próprio vendedor" },
  "sync-quote-bitrix": { category: "authenticated", rationale: "Sync do orçamento do vendedor" },
  "trends-insights": { category: "authenticated", rationale: "Insights do BI" },
  "comparison-ai-advisor": { category: "authenticated", rationale: "Conselheiro IA na comparação" },
  "market-intelligence-insights": { category: "authenticated", rationale: "BI insights" },
  "bi-copilot": { category: "authenticated", rationale: "BI copilot" },
  "send-transactional-email": { category: "authenticated", rationale: "Envio de e-mail trans (user logado)" },
  "step-up-verify": { category: "authenticated", rationale: "MFA step-up — quem está fazendo" },
  "validate-access": { category: "authenticated", rationale: "Validação de acesso pós-login" },
  "force-global-logout": { category: "authenticated", rationale: "Logout global do próprio user" },
  "secure-upload": { category: "authenticated", rationale: "Upload com scan VirusTotal anti-malware — exige JWT (uso de SERVICE_ROLE_KEY interno; auditoria em file_scan_logs com user_id obrigatório)" },

  // ---------------- Supervisor (admin) ----------------
  "bitrix-sync": { category: "supervisor", rationale: "Sync no CRM externo — admin/dev", enforcedBy: "shared-authorize" },
  "manage-users": { category: "supervisor", rationale: "Gestão de usuários via has_role inline", enforcedBy: "custom" },
  "block-ip-temporarily": { category: "supervisor", rationale: "Bloqueio de IP — has_role inline", enforcedBy: "custom" },
  "ownership-repair": { category: "supervisor", rationale: "Reparo de órfãos — has_role inline + dry-run", enforcedBy: "custom" },
  "bulk-random-passwords": { category: "supervisor", rationale: "Bulk reset de senhas — x-admin-token inline", enforcedBy: "custom" },

  // ---------------- Dev-only ----------------
  "secrets-manager": { category: "dev", rationale: "is_dev() inline check", enforcedBy: "custom" },
  "connection-tester": { category: "dev", rationale: "is_dev() inline check", enforcedBy: "custom" },
  "github-credentials-test": { category: "dev", rationale: "is_dev() inline check", enforcedBy: "custom" },
  "external-db-inspect": { category: "dev", rationale: "is_dev() inline check", enforcedBy: "custom" },
  "rls-audit": { category: "dev", rationale: "Auditoria via service-role + has_role inline", enforcedBy: "custom" },
  "rls-integration-tests": { category: "dev", rationale: "Testes RLS — dev/cron only", enforcedBy: "custom" },
  "rls-matrix-export": { category: "dev", rationale: "Export matriz — has_role inline", enforcedBy: "custom" },
  "tests": { category: "dev", rationale: "Pasta de Deno tests, não é edge deployada", enforcedBy: "custom", skipAnonBypassTest: true, skipAuthBypassTest: true },
  "e2e-cleanup": { category: "dev", rationale: "Cleanup E2E — JWT + service-role + e2e-shared-secret", enforcedBy: "custom" },
  "full-op-diagnostics": { category: "dev", rationale: "Diagnóstico — has_role(dev) inline", enforcedBy: "custom" },
  "mcp-keys-issue": { category: "dev", rationale: "MCP keys — has_role(dev) + step-up token", enforcedBy: "custom" },
  "mcp-keys-revoke": { category: "dev", rationale: "MCP keys — has_role(dev) inline", enforcedBy: "custom" },
  "mcp-keys-rotate": { category: "dev", rationale: "MCP keys — has_role(dev) + step-up token", enforcedBy: "custom" },
  "mcp-keys-update": { category: "dev", rationale: "MCP keys — has_role(dev) inline", enforcedBy: "custom" },
  "test-contract-orchestrator": { category: "dev", rationale: "Teste de contratos — dev/CI only, HMAC inline", enforcedBy: "custom" },
  "test-inventory-orchestrator": { category: "dev", rationale: "Teste de inventario — dev/CI only, service_role inline", enforcedBy: "custom" },
  "load-test": { category: "dev", rationale: "Load testing utility — sem auth no caller; uso dev/CI only", enforcedBy: "custom" },

  "verify-2fa-token": { category: "authenticated", rationale: "Verificação TOTP server-side — JWT Bearer obrigatório (verify_jwt: true)", enforcedBy: "jwt" },

  // ---------------- Scoped (auth custom) ----------------
  "mcp-server": { category: "scoped", rationale: "Token MCP com escopos read/write/admin", enforcedBy: "custom" },
  "crm-db-bridge": { category: "scoped", rationale: "JWT + RBAC custom interno", enforcedBy: "custom" },
  "simulation-orchestrator": { category: "scoped", rationale: "Orquestrador de simulacoes — HMAC N8N_PRODUCT_WEBHOOK_SECRET", enforcedBy: "custom" },

  // ---------------- Service (server-to-server) ----------------
  "sync-external-db": { category: "service", rationale: "Sync DB externo — service_role_key server-to-server", enforcedBy: "custom" },
  "asia-ingestion": { category: "service", rationale: "Sync paginado catálogo ASIA — cron/service via x-cron-secret (ASIA_INGESTION_CRON_SECRET)", enforcedBy: "custom" },
  "backfill-image-dimensions": { category: "service", rationale: "Backfill dimensões product_images — cron via x-cron-secret (BACKFILL_DIM_CRON_SECRET)", enforcedBy: "custom" },
  "generate-blurhashes": { category: "service", rationale: "Gera blurhashes — cron via authorizeCron (service_role + x-cron-secret)", enforcedBy: "custom" },
  "hash-product-images": { category: "service", rationale: "Hash perceptual de imagens — cron via authorizeCron (service_role + x-cron-secret)", enforcedBy: "custom" },
  "audit-suite": { category: "dev", rationale: "Suite de auditoria — service_role + has_role(dev) inline", enforcedBy: "custom" },
  "word-magic": { category: "authenticated", rationale: "Geração de copy via IA — authenticateRequest (JWT obrigatório)", enforcedBy: "custom" },
};
