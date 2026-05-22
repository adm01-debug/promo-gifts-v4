/**
 * Suite consolidada de contract tests para os endpoints migrados em #46/47/48.
 *
 * `send-transactional-email` e `step-up-verify` têm arquivos próprios (testes
 * mais detalhados); este arquivo cobre o smoke-test dos outros 11.
 */
import { describe, it, expect } from 'vitest';
import { parseContract } from '../../supabase/functions/_shared/contracts/parse';
import { KitAiBuilderSchemas } from '../../supabase/functions/_shared/contracts/schemas/kit-ai-builder';
import { BiCopilotSchemas } from '../../supabase/functions/_shared/contracts/schemas/bi-copilot';
import { MarketIntelligenceInsightsSchemas } from '../../supabase/functions/_shared/contracts/schemas/market-intelligence-insights';
import { OwnershipAuditSchemas } from '../../supabase/functions/_shared/contracts/schemas/ownership-audit';
import { OwnershipRepairSchemas } from '../../supabase/functions/_shared/contracts/schemas/ownership-repair';
import { SimulationOrchestratorSchemas } from '../../supabase/functions/_shared/contracts/schemas/simulation-orchestrator';
import { SyncExternalDbSchemas } from '../../supabase/functions/_shared/contracts/schemas/sync-external-db';
import { TrendsInsightsSchemas } from '../../supabase/functions/_shared/contracts/schemas/trends-insights';
import { ForceGlobalLogoutSchemas } from '../../supabase/functions/_shared/contracts/schemas/force-global-logout';
import { E2eCleanupSchemas } from '../../supabase/functions/_shared/contracts/schemas/e2e-cleanup';
import { BlockIpTemporarilySchemas } from '../../supabase/functions/_shared/contracts/schemas/block-ip-temporarily';
import { makeRequest, expectContractError } from './_helpers';

const UUID = '11111111-1111-4111-8111-111111111111';

describe('contract: kit-ai-builder', () => {
  it('v1 aceita prompt 6-2000 chars', async () => {
    const r = await parseContract(makeRequest({ body: { prompt: 'x'.repeat(50) } }), KitAiBuilderSchemas);
    expect(r.ok).toBe(true);
  });
  it('v1 rejeita prompt < 6 → 422', async () => {
    const r = await parseContract(makeRequest({ body: { prompt: 'abc' } }), KitAiBuilderSchemas);
    expect(r.ok).toBe(false);
    if (!r.ok) await expectContractError(r.response, { status: 422, code: 'validation_failed' });
  });
  it('v2 exige idempotency_key', async () => {
    const r = await parseContract(
      makeRequest({ headers: { 'accept-version': '2' }, body: { prompt: 'x'.repeat(50) } }),
      KitAiBuilderSchemas,
    );
    expect(r.ok).toBe(false);
  });
});

describe('contract: bi-copilot', () => {
  it('v1 aceita question simples', async () => {
    const r = await parseContract(makeRequest({ body: { question: 'Qual ticket médio?' } }), BiCopilotSchemas);
    expect(r.ok).toBe(true);
  });
  it('v1 aceita context+history opcionais', async () => {
    const r = await parseContract(
      makeRequest({
        body: {
          question: 'Como melhorar?',
          context: { client_id: 'X' },
          history: [{ role: 'user', content: 'olá' }],
        },
      }),
      BiCopilotSchemas,
    );
    expect(r.ok).toBe(true);
  });
  it('v1 rejeita question vazia → 422', async () => {
    const r = await parseContract(makeRequest({ body: { question: '' } }), BiCopilotSchemas);
    expect(r.ok).toBe(false);
  });
});

describe('contract: market-intelligence-insights', () => {
  it('v1 aceita body vazio (defaults)', async () => {
    const r = await parseContract(makeRequest({ body: {} }), MarketIntelligenceInsightsSchemas);
    expect(r.ok).toBe(true);
  });
  it('v1 valida days range 1-365', async () => {
    const r = await parseContract(makeRequest({ body: { days: 400 } }), MarketIntelligenceInsightsSchemas);
    expect(r.ok).toBe(false);
  });
  it('v2 exige UUIDs em filtros', async () => {
    const r = await parseContract(
      makeRequest({ headers: { 'accept-version': '2' }, body: { categoryId: 'not-uuid' } }),
      MarketIntelligenceInsightsSchemas,
    );
    expect(r.ok).toBe(false);
  });
});

describe('contract: ownership-audit', () => {
  it('v1 aceita body vazio (default cron no handler)', async () => {
    const r = await parseContract(makeRequest({ body: {} }), OwnershipAuditSchemas);
    expect(r.ok).toBe(true);
  });
  it('v2 exige triggered_by', async () => {
    const r = await parseContract(
      makeRequest({ headers: { 'accept-version': '2' }, body: {} }),
      OwnershipAuditSchemas,
    );
    expect(r.ok).toBe(false);
  });
});

describe('contract: ownership-repair', () => {
  it('v1 aceita body vazio', async () => {
    const r = await parseContract(makeRequest({ body: {} }), OwnershipRepairSchemas);
    expect(r.ok).toBe(true);
  });
  it('v2 exige dry_run+triggered_by+idempotency_key', async () => {
    const r = await parseContract(
      makeRequest({
        headers: { 'accept-version': '2' },
        body: { dry_run: true, triggered_by: 'manual', idempotency_key: UUID },
      }),
      OwnershipRepairSchemas,
    );
    expect(r.ok).toBe(true);
  });
});

describe('contract: simulation-orchestrator', () => {
  it('v1 aceita body vazio (defaults)', async () => {
    const r = await parseContract(makeRequest({ body: {} }), SimulationOrchestratorSchemas);
    expect(r.ok).toBe(true);
  });
  it('v2 exige campos completos', async () => {
    const r = await parseContract(
      makeRequest({
        headers: { 'accept-version': '2' },
        body: { targetFunctions: ['webhook-inbound'], mode: 'resilience', idempotency_key: UUID },
      }),
      SimulationOrchestratorSchemas,
    );
    expect(r.ok).toBe(true);
  });
});

describe('contract: sync-external-db', () => {
  it('v1 exige table → 422 sem table', async () => {
    const r = await parseContract(makeRequest({ body: {} }), SyncExternalDbSchemas);
    expect(r.ok).toBe(false);
    if (!r.ok) await expectContractError(r.response, { status: 422, code: 'validation_failed' });
  });
  it('v1 aceita table simples', async () => {
    const r = await parseContract(makeRequest({ body: { table: 'products' } }), SyncExternalDbSchemas);
    expect(r.ok).toBe(true);
  });
  it('v2 valida since como ISO 8601', async () => {
    const r = await parseContract(
      makeRequest({
        headers: { 'accept-version': '2' },
        body: { table: 'products', direction: 'to-external', since: 'not-iso' },
      }),
      SyncExternalDbSchemas,
    );
    expect(r.ok).toBe(false);
  });
});

describe('contract: trends-insights', () => {
  it('v1 aceita body vazio', async () => {
    const r = await parseContract(makeRequest({ body: {} }), TrendsInsightsSchemas);
    expect(r.ok).toBe(true);
  });
  it('v1 valida days range 1-365', async () => {
    const r = await parseContract(makeRequest({ body: { days: 400 } }), TrendsInsightsSchemas);
    expect(r.ok).toBe(false);
  });
});

describe('contract: force-global-logout', () => {
  it('v1 exige confirm literal', async () => {
    const r = await parseContract(makeRequest({ body: { confirm: 'wrong' } }), ForceGlobalLogoutSchemas);
    expect(r.ok).toBe(false);
  });
  it('v1 aceita literal correto', async () => {
    const r = await parseContract(makeRequest({ body: { confirm: 'FORCE_LOGOUT_ALL' } }), ForceGlobalLogoutSchemas);
    expect(r.ok).toBe(true);
  });
  it('v2 exige idempotency_key', async () => {
    const r = await parseContract(
      makeRequest({ headers: { 'accept-version': '2' }, body: { confirm: 'FORCE_LOGOUT_ALL' } }),
      ForceGlobalLogoutSchemas,
    );
    expect(r.ok).toBe(false);
  });
});

describe('contract: e2e-cleanup', () => {
  it('v1 aceita body vazio (defaults aplicados no handler)', async () => {
    const r = await parseContract(makeRequest({ body: {} }), E2eCleanupSchemas);
    expect(r.ok).toBe(true);
  });
  it('v2 exige email + dryRun + confirm + idempotency_key', async () => {
    const r = await parseContract(
      makeRequest({
        headers: { 'accept-version': '2' },
        body: {
          email: 'e2e@test.com',
          dryRun: true,
          confirm: true,
          idempotency_key: UUID,
        },
      }),
      E2eCleanupSchemas,
    );
    expect(r.ok).toBe(true);
  });
  it('v2 com sellerScope=explicit exige sellerId', async () => {
    const r = await parseContract(
      makeRequest({
        headers: { 'accept-version': '2' },
        body: {
          email: 'e2e@test.com',
          dryRun: true,
          sellerScope: 'explicit',
          confirm: true,
          idempotency_key: UUID,
        },
      }),
      E2eCleanupSchemas,
    );
    expect(r.ok).toBe(false);
  });
});

describe('contract: block-ip-temporarily', () => {
  it('v1 aceita IPv4', async () => {
    const r = await parseContract(makeRequest({ body: { ip: '192.168.0.1' } }), BlockIpTemporarilySchemas);
    expect(r.ok).toBe(true);
  });
  it('v1 aceita CIDR', async () => {
    const r = await parseContract(makeRequest({ body: { ip: '10.0.0.0/8' } }), BlockIpTemporarilySchemas);
    expect(r.ok).toBe(true);
  });
  it('v1 rejeita string lixo → 422', async () => {
    const r = await parseContract(makeRequest({ body: { ip: 'not-an-ip-zzz' } }), BlockIpTemporarilySchemas);
    expect(r.ok).toBe(false);
  });
  it('v1 valida hours range', async () => {
    const r = await parseContract(
      makeRequest({ body: { ip: '1.2.3.4', hours: 721 } }),
      BlockIpTemporarilySchemas,
    );
    expect(r.ok).toBe(false);
  });
  it('v2 strict — extras rejeitados', async () => {
    const r = await parseContract(
      makeRequest({
        headers: { 'accept-version': '2' },
        body: { ip: '1.2.3.4', reason: 'abuse', hours: 24, extra: true },
      }),
      BlockIpTemporarilySchemas,
    );
    expect(r.ok).toBe(false);
  });
});
