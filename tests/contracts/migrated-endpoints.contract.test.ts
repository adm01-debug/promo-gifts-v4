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
  it('v2 aceita prompt com idempotency_key', async () => {
    const r = await parseContract(
      makeRequest({
        headers: { 'accept-version': '2' },
        body: { prompt: 'x'.repeat(50), idempotency_key: UUID },
      }),
      KitAiBuilderSchemas,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.version).toBe('2');
      expect(r.responseHeaders['x-contract-version']).toBe('2');
      expect(r.responseHeaders.Deprecation).toBeUndefined();
    }
  });
  it('v1 default anuncia Deprecation/Sunset', async () => {
    const r = await parseContract(makeRequest({ body: { prompt: 'x'.repeat(50) } }), KitAiBuilderSchemas);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.version).toBe('1');
      expect(r.responseHeaders.Deprecation).toBe('true');
      expect(r.responseHeaders.Sunset).toContain('31 Oct 2026');
    }
  });
  it('body vazio -> 400 missing_body', async () => {
    const r = await parseContract(makeRequest({}), KitAiBuilderSchemas);
    expect(r.ok).toBe(false);
    if (!r.ok) await expectContractError(r.response, { status: 400, code: 'missing_body' });
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
  it('v2 exige context', async () => {
    const r = await parseContract(
      makeRequest({ headers: { 'accept-version': '2' }, body: { question: 'Como melhorar margem?' } }),
      BiCopilotSchemas,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) await expectContractError(r.response, { status: 422, code: 'validation_failed', fieldPaths: ['context'] });
  });
  it('v2 aceita question com context obrigatorio', async () => {
    const r = await parseContract(
      makeRequest({
        headers: { 'accept-version': '2' },
        body: { question: 'Como melhorar margem?', context: { tenant_id: 'tenant-1' } },
      }),
      BiCopilotSchemas,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.responseHeaders['x-contract-version']).toBe('2');
  });
  it('versao nao suportada -> 406 unsupported_version', async () => {
    const r = await parseContract(
      makeRequest({ headers: { 'accept-version': '99' }, body: { question: 'Qual ticket medio?' } }),
      BiCopilotSchemas,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) await expectContractError(r.response, { status: 406, code: 'unsupported_version' });
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
  it('v2 aceita UUIDs e defaults estritos', async () => {
    const r = await parseContract(
      makeRequest({
        headers: { 'accept-version': '2' },
        body: { categoryId: UUID, supplierId: null, productId: UUID },
      }),
      MarketIntelligenceInsightsSchemas,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.days).toBe(30);
      expect(r.data.forceRefresh).toBe(false);
      expect(r.responseHeaders['x-contract-version']).toBe('2');
    }
  });
  it('v2 strict rejeita campos extras', async () => {
    const r = await parseContract(
      makeRequest({ headers: { 'accept-version': '2' }, body: { extra: true } }),
      MarketIntelligenceInsightsSchemas,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) await expectContractError(r.response, { status: 422, code: 'validation_failed' });
  });
  it('JSON malformado -> 400 invalid_json', async () => {
    const r = await parseContract(
      makeRequest({ body: '{"days":', headers: { 'content-type': 'application/json' } }),
      MarketIntelligenceInsightsSchemas,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) await expectContractError(r.response, { status: 400, code: 'invalid_json' });
  });
});

describe('contract: ownership-audit', () => {
  it('v1 aceita body vazio (default cron no handler)', async () => {
    const r = await parseContract(makeRequest({ body: {} }), OwnershipAuditSchemas);
    expect(r.ok).toBe(true);
  });
  it('v1 aceita triggered_by opcional e anuncia sunset', async () => {
    const r = await parseContract(makeRequest({ body: { triggered_by: 'cron' } }), OwnershipAuditSchemas);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.version).toBe('1');
      expect(r.responseHeaders.Deprecation).toBe('true');
      expect(r.responseHeaders.Sunset).toContain('30 Nov 2026');
    }
  });
  it('v2 exige triggered_by', async () => {
    const r = await parseContract(
      makeRequest({ headers: { 'accept-version': '2' }, body: {} }),
      OwnershipAuditSchemas,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) await expectContractError(r.response, { status: 422, code: 'validation_failed', fieldPaths: ['triggered_by'] });
  });
  it('v2 aceita triggered_by valido sem header de deprecation', async () => {
    const r = await parseContract(
      makeRequest({ headers: { 'accept-version': '2' }, body: { triggered_by: 'manual-admin' } }),
      OwnershipAuditSchemas,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.version).toBe('2');
      expect(r.responseHeaders['x-contract-version']).toBe('2');
      expect(r.responseHeaders.Deprecation).toBeUndefined();
    }
  });
  it('v2 strict rejeita campo extra', async () => {
    const r = await parseContract(
      makeRequest({ headers: { 'accept-version': '2' }, body: { triggered_by: 'manual', extra: true } }),
      OwnershipAuditSchemas,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) await expectContractError(r.response, { status: 422, code: 'validation_failed' });
  });
  it('versao nao suportada -> 406 unsupported_version', async () => {
    const r = await parseContract(
      makeRequest({ headers: { 'accept-version': '99' }, body: { triggered_by: 'manual' } }),
      OwnershipAuditSchemas,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) await expectContractError(r.response, { status: 406, code: 'unsupported_version' });
  });
});

describe('contract: ownership-repair', () => {
  it('v1 aceita body vazio', async () => {
    const r = await parseContract(makeRequest({ body: {} }), OwnershipRepairSchemas);
    expect(r.ok).toBe(true);
  });
  it('v1 aceita campos opcionais compat e anuncia sunset', async () => {
    const r = await parseContract(
      makeRequest({ body: { report_id: 'legacy-report', dry_run: false, triggered_by: 'admin' } }),
      OwnershipRepairSchemas,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.version).toBe('1');
      expect(r.responseHeaders.Deprecation).toBe('true');
      expect(r.responseHeaders.Sunset).toContain('30 Nov 2026');
    }
  });
  it('v2 aceita dry_run+triggered_by+idempotency_key', async () => {
    const r = await parseContract(
      makeRequest({
        headers: { 'accept-version': '2' },
        body: { dry_run: true, triggered_by: 'manual', idempotency_key: UUID },
      }),
      OwnershipRepairSchemas,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.responseHeaders['x-contract-version']).toBe('2');
  });
  it('v2 rejeita ausencia de idempotency_key', async () => {
    const r = await parseContract(
      makeRequest({ headers: { 'accept-version': '2' }, body: { dry_run: true, triggered_by: 'manual' } }),
      OwnershipRepairSchemas,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) await expectContractError(r.response, { status: 422, code: 'validation_failed', fieldPaths: ['idempotency_key'] });
  });
  it('v2 valida report_id UUID quando presente', async () => {
    const r = await parseContract(
      makeRequest({
        headers: { 'accept-version': '2' },
        body: { report_id: 'not-uuid', dry_run: true, triggered_by: 'manual', idempotency_key: UUID },
      }),
      OwnershipRepairSchemas,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) await expectContractError(r.response, { status: 422, code: 'validation_failed', fieldPaths: ['report_id'] });
  });
  it('v2 strict rejeita campo extra', async () => {
    const r = await parseContract(
      makeRequest({
        headers: { 'accept-version': '2' },
        body: { dry_run: true, triggered_by: 'manual', idempotency_key: UUID, extra: true },
      }),
      OwnershipRepairSchemas,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) await expectContractError(r.response, { status: 422, code: 'validation_failed' });
  });
});

describe('contract: simulation-orchestrator', () => {
  it('v1 aceita body vazio (defaults)', async () => {
    const r = await parseContract(makeRequest({ body: {} }), SimulationOrchestratorSchemas);
    expect(r.ok).toBe(true);
  });
  it('v1 valida limite maximo de count', async () => {
    const r = await parseContract(makeRequest({ body: { count: 10001 } }), SimulationOrchestratorSchemas);
    expect(r.ok).toBe(false);
    if (!r.ok) await expectContractError(r.response, { status: 422, code: 'validation_failed', fieldPaths: ['count'] });
  });
  it('v1 default anuncia sunset', async () => {
    const r = await parseContract(makeRequest({ body: { mode: 'resilience' } }), SimulationOrchestratorSchemas);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.version).toBe('1');
      expect(r.responseHeaders.Deprecation).toBe('true');
      expect(r.responseHeaders.Sunset).toContain('30 Nov 2026');
    }
  });
  it('v2 aceita campos completos', async () => {
    const r = await parseContract(
      makeRequest({
        headers: { 'accept-version': '2' },
        body: { targetFunctions: ['webhook-inbound'], mode: 'resilience', idempotency_key: UUID },
      }),
      SimulationOrchestratorSchemas,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.count).toBe(100);
      expect(r.responseHeaders['x-contract-version']).toBe('2');
    }
  });
  it('v2 rejeita targetFunction fora da allowlist', async () => {
    const r = await parseContract(
      makeRequest({
        headers: { 'accept-version': '2' },
        body: { targetFunctions: ['unknown-fn'], mode: 'resilience', idempotency_key: UUID },
      }),
      SimulationOrchestratorSchemas,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) await expectContractError(r.response, { status: 422, code: 'validation_failed', fieldPaths: ['targetFunctions[0]'] });
  });
  it('v2 rejeita ausencia de idempotency_key', async () => {
    const r = await parseContract(
      makeRequest({
        headers: { 'accept-version': '2' },
        body: { targetFunctions: ['webhook-inbound'], mode: 'resilience' },
      }),
      SimulationOrchestratorSchemas,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) await expectContractError(r.response, { status: 422, code: 'validation_failed', fieldPaths: ['idempotency_key'] });
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
    if (r.ok) {
      expect(r.version).toBe('1');
      expect(r.responseHeaders.Deprecation).toBe('true');
      expect(r.responseHeaders.Sunset).toContain('30 Nov 2026');
    }
  });
  it('v2 aceita payload completo com idempotency_key', async () => {
    const r = await parseContract(
      makeRequest({
        headers: { 'accept-version': '2' },
        body: {
          table: 'products',
          direction: 'to-external',
          since: '2026-05-24T00:00:00.000Z',
          idempotency_key: UUID,
        },
      }),
      SyncExternalDbSchemas,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.responseHeaders['x-contract-version']).toBe('2');
  });
  it('v2 exige idempotency_key por ser sincronizacao com side effect', async () => {
    const r = await parseContract(
      makeRequest({
        headers: { 'accept-version': '2' },
        body: { table: 'products', direction: 'to-external' },
      }),
      SyncExternalDbSchemas,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) await expectContractError(r.response, { status: 422, code: 'validation_failed', fieldPaths: ['idempotency_key'] });
  });
  it('v2 valida since como ISO 8601', async () => {
    const r = await parseContract(
      makeRequest({
        headers: { 'accept-version': '2' },
        body: { table: 'products', direction: 'to-external', since: 'not-iso', idempotency_key: UUID },
      }),
      SyncExternalDbSchemas,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) await expectContractError(r.response, { status: 422, code: 'validation_failed', fieldPaths: ['since'] });
  });
  it('v2 strict rejeita campo extra', async () => {
    const r = await parseContract(
      makeRequest({
        headers: { 'accept-version': '2' },
        body: { table: 'products', direction: 'from-external', idempotency_key: UUID, extra: true },
      }),
      SyncExternalDbSchemas,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) await expectContractError(r.response, { status: 422, code: 'validation_failed' });
  });
});

describe('contract: trends-insights', () => {
  it('v1 aceita body vazio', async () => {
    const r = await parseContract(makeRequest({ body: {} }), TrendsInsightsSchemas);
    expect(r.ok).toBe(true);
  });
  it('v1 default anuncia sunset', async () => {
    const r = await parseContract(makeRequest({ body: { days: 30 } }), TrendsInsightsSchemas);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.version).toBe('1');
      expect(r.responseHeaders.Deprecation).toBe('true');
      expect(r.responseHeaders.Sunset).toContain('30 Nov 2026');
    }
  });
  it('v1 valida days range 1-365', async () => {
    const r = await parseContract(makeRequest({ body: { days: 400 } }), TrendsInsightsSchemas);
    expect(r.ok).toBe(false);
    if (!r.ok) await expectContractError(r.response, { status: 422, code: 'validation_failed', fieldPaths: ['days'] });
  });
  it('v2 aceita days obrigatorio', async () => {
    const r = await parseContract(
      makeRequest({ headers: { 'accept-version': '2' }, body: { days: 30 } }),
      TrendsInsightsSchemas,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.responseHeaders['x-contract-version']).toBe('2');
  });
  it('v2 rejeita days ausente', async () => {
    const r = await parseContract(
      makeRequest({ headers: { 'accept-version': '2' }, body: {} }),
      TrendsInsightsSchemas,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) await expectContractError(r.response, { status: 422, code: 'validation_failed', fieldPaths: ['days'] });
  });
  it('v2 strict rejeita campo extra', async () => {
    const r = await parseContract(
      makeRequest({ headers: { 'accept-version': '2' }, body: { days: 30, prompt: 'livre' } }),
      TrendsInsightsSchemas,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) await expectContractError(r.response, { status: 422, code: 'validation_failed' });
  });
  it('versao nao suportada -> 406 unsupported_version', async () => {
    const r = await parseContract(
      makeRequest({ headers: { 'accept-version': '99' }, body: { days: 30 } }),
      TrendsInsightsSchemas,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) await expectContractError(r.response, { status: 406, code: 'unsupported_version' });
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
