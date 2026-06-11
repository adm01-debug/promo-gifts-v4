/**
 * P0 — RLS e integridade de dados.
 *
 * Cobre cenários classificados como P0 ("dados corrompidos / vazamento") no RUNBOOK.
 *
 * Estratégia em duas camadas:
 *  1. Casos com asserção de contrato sobre os arquivos `.sql` em supabase/migrations/
 *     — executáveis sem banco real, pegam regressões de remoção/alteração de policy.
 *  2. Casos que exigem schema de teste com seeds permanecem `it.skip` referenciando
 *     `tests/rls/personas.test.ts` (suite gated por env, ver `_mocks.ts`).
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createSupabaseClientMock, resetExternalMocks } from "./_mocks";

const MIGRATIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "supabase",
  "migrations",
);

let migrationCorpus = "";

beforeAll(async () => {
  const entries = await fs.readdir(MIGRATIONS_DIR);
  const sql = await Promise.all(
    entries
      .filter((f) => f.endsWith(".sql"))
      .map((f) => fs.readFile(path.join(MIGRATIONS_DIR, f), "utf8")),
  );
  migrationCorpus = sql.join("\n");
});

describe("P0 — RLS e integridade", () => {
  beforeEach(() => {
    // Mock padrão: usuário autenticado comum (não admin).
    createSupabaseClientMock({ user: { id: "user-123", email: "u@example.com" } });
  });
  afterEach(() => resetExternalMocks());

  // ─── user_roles (privilege escalation) ────────────────────────────────
  it("user_roles: existe policy que restringe insert/manage a admins (anti privilege-escalation)", () => {
    // Regressão-alvo: policy pode manter nome "Admins can manage roles",
    // mas ser afrouxada para USING (true). Por isso não basta casar por título.
    const adminManagePolicyWithPredicate =
      /(?:CREATE|ALTER) POLICY[^;]*(?:"Only admins can insert roles"|"Admins can manage roles"|"Admins manage user_roles")[^;]*ON public\.user_roles[\s\S]{0,1200}(?:USING|WITH\s+CHECK)[\s\S]{0,400}(?:has_role\([^)]*'admin'\)|auth\.uid\(\))/i;

    expect(
      adminManagePolicyWithPredicate.test(migrationCorpus),
      "Policy admin-only em public.user_roles sem predicado efetivo (has_role/admin ou auth.uid)"
    ).toBe(true);
  });

  it("user_roles: existe policy que limita SELECT ao próprio usuário", () => {
    // Aceita as variações conhecidas ("Users read own roles", "Users can view own role",
    // "Users can view their own role").
    const re =
      /CREATE POLICY[^;]*"Users (?:can view (?:their )?own role|read own roles)"[^;]*ON public\.user_roles/i;
    expect(re.test(migrationCorpus)).toBe(true);
  });

  // ─── quotes ───────────────────────────────────────────────────────────
  it("quotes: existe policy de isolamento por seller_id (vendedor A não vê quotes de B)", () => {
    // Aceita a policy de isolamento criada em 20260515010000_onda18a_quote_isolation_rls.sql
    // ou a anterior em 20260320171208 (seller_id = auth.uid()).
    const re =
      /(?:CREATE|ALTER) POLICY[\s\S]{0,200}ON public\.quotes[\s\S]{0,500}seller_id\s*=\s*auth\.uid\(\)/i;
    expect(re.test(migrationCorpus)).toBe(true);
  });

  it("quotes: a policy 'Allow all' não está mais ativa (migration de QA 2026-05-22)", () => {
    // Garante que nossa migration de hardening esteja presente.
    const hasDrop =
      /DROP POLICY IF EXISTS "Allow all" ON public\.quotes/i.test(migrationCorpus);
    expect(hasDrop, "Falta DROP POLICY 'Allow all' em public.quotes").toBe(true);

    // Também valida produtos/categorias/suppliers, que sofriam do mesmo bug.
    expect(/DROP POLICY IF EXISTS "Allow all" ON public\.products/i.test(migrationCorpus)).toBe(true);
    expect(/DROP POLICY IF EXISTS "Allow all" ON public\.categories/i.test(migrationCorpus)).toBe(true);
    expect(/DROP POLICY IF EXISTS "Allow all" ON public\.suppliers/i.test(migrationCorpus)).toBe(true);
  });

  it.skip("quotes: aprovação pública por token NÃO expõe outros orçamentos via JOIN", () => {
    // TODO(P0): exige seed + execução real — vive em tests/rls/ quando habilitado.
  });

  // ─── orders / carts ───────────────────────────────────────────────────
  it.skip("orders: anônimo NÃO consegue listar orders mesmo com URL direta", () => {
    // TODO(P0): exige seed + execução real — vive em tests/rls/ quando habilitado.
  });

  it("seller_carts: existe policy de isolamento por seller_id", () => {
    // Foi criada como 'Users can manage own carts' em 20260304014416, e depois
    // sucessivamente substituída. Aceita ambas as formas, contanto que sempre
    // exista uma policy ativa em ON public.seller_carts referenciando o seller.
    const re =
      /CREATE POLICY[^;]*ON public\.seller_carts[\s\S]{0,500}(?:seller_id\s*=\s*auth\.uid\(\)|workspace_id)/i;
    expect(re.test(migrationCorpus)).toBe(true);
  });

  // ─── companies (CRM) ──────────────────────────────────────────────────
  it.skip("companies (external): RLS bloqueia acesso a CNPJ/contatos sem auth válida", async () => {
    expect(true).toBe(true);
  });

  // ─── mcp_keys (segurança crítica) ─────────────────────────────────────
  // 2026-06-11: a tabela mcp_keys foi REMOVIDA (fase 1.1, substituída por
  // integration_credentials). Os testes antigos de secret_key/auto-revogação
  // tornaram-se obsoletos; o contrato agora é garantir que o DROP esteja
  // presente para que a tabela legada nunca volte a existir com dados.
  it("mcp_keys: tabela legada foi dropada (substituída por integration_credentials)", () => {
    expect(
      /DROP TABLE IF EXISTS public\.mcp_keys CASCADE/i.test(migrationCorpus),
      "Falta DROP TABLE public.mcp_keys (fase 1.1 — legado Lovable)",
    ).toBe(true);
  });

  // ─── workspace_notifications ──────────────────────────────────────────
  it("workspace_notifications: policy de SELECT restringe ao próprio usuário (user_id = auth.uid())", () => {
    const re =
      /CREATE POLICY "Users can read own notifications"[\s\S]{0,200}ON public\.workspace_notifications FOR SELECT[\s\S]{0,200}USING \(user_id = auth\.uid\(\)\)/i;
    expect(re.test(migrationCorpus)).toBe(true);
  });

  it("workspace_notifications: policy de UPDATE exige user_id = auth.uid() em USING e WITH CHECK", () => {
    const re =
      /CREATE POLICY "Users can update own notifications"[\s\S]{0,200}ON public\.workspace_notifications FOR UPDATE[\s\S]{0,200}USING \(user_id = auth\.uid\(\)\)[\s\S]{0,100}WITH CHECK \(user_id = auth\.uid\(\)\)/i;
    expect(re.test(migrationCorpus)).toBe(true);
  });

  // ─── realtime ──────────────────────────────────────────────────────────
  it.skip("realtime: tópicos sem prefixo `user:<uid>:` são bloqueados", async () => {
    // TODO(P0): mem://security/realtime-channel-authorization.
    expect(true).toBe(true);
  });

  // ─── Integridade transacional ─────────────────────────────────────────
  it.skip("orçamento aprovado → order: criado em transação atômica (rollback se falha)", async () => {
    expect(true).toBe(true);
  });

  it("ownership-repair: repair_ownership_orphans tem _dry_run=true por default e guarda IF NOT _dry_run em cada mutação", () => {
    // Camada 1: contrato sobre a migration. Garante que (a) o default é dry-run
    // e (b) DELETE/UPDATE só executam dentro de `IF NOT _dry_run`.
    const fnDef = migrationCorpus.match(
      /CREATE OR REPLACE FUNCTION public\.repair_ownership_orphans\([\s\S]{0,20000}?\n\$\$;/i,
    )?.[0];
    expect(fnDef, "Função repair_ownership_orphans não encontrada nas migrations").toBeTruthy();
    expect(fnDef).toMatch(/_dry_run boolean DEFAULT true/i);
    // Toda mutação destrutiva deve estar protegida pelo guard.
    const mutations = fnDef!.match(/EXECUTE format\('(?:DELETE FROM|UPDATE) /gi) ?? [];
    const guards = fnDef!.match(/IF NOT _dry_run THEN/gi) ?? [];
    expect(mutations.length).toBeGreaterThan(0);
    expect(guards.length).toBeGreaterThanOrEqual(mutations.length);
  });
});
