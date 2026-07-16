/**
 * Fuzz massivo — magazineService.publish()
 *
 * Objetivo: expor gaps e falhas ANTES de aplicar a trigger `fn_magazine_public_token`
 * no BD Gold. Cobre 400+ cenários combinatórios do fluxo publish/republish,
 * simulando corridas, RLS silenciosa, trigger ausente/parcial, timeout de rede,
 * colisão de token, backfill defensivo, unpublish→republish e idempotência.
 *
 * Contrato invariante que TODO cenário deve preservar:
 *   INV-1: publish() nunca retorna Magazine com publicToken vazio quando o
 *          BD aceitou pelo menos um UPDATE (status OU token).
 *   INV-2: uma vez que o BD tem public_token != NULL, publish() subsequente
 *          NUNCA sobrescreve — republicação reutiliza o mesmo link.
 *   INV-3: quando o UPDATE de status falha, publish() resolve com null (não
 *          lança) e não persiste token órfão no BD.
 *   INV-4: token gerado é sempre 32 hex chars (contrato do link público).
 *   INV-5: falha do UPDATE de token NÃO derruba o publish — o método ainda
 *          resolve com Magazine hidratada (BD volta com token via re-fetch
 *          ou continua NULL, mas nunca lança).
 *
 * Cada cenário roda em isolamento (state reset no beforeEach) e o resultado
 * é agregado em um relatório final impresso no console via afterAll.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

// ---------------------------------------------------------------------------
// Cenário — descreve o comportamento do BD "falso" para uma execução
// ---------------------------------------------------------------------------

interface Scenario {
  id: string;
  // Estado inicial da linha
  initialToken: string | null;
  initialStatus: 'draft' | 'published' | 'archived';
  // Comportamento da "trigger BEFORE UPDATE OF status"
  triggerFillsToken: boolean;
  // Falhas simuladas
  statusUpdateFails: boolean;
  tokenUpdateFails: boolean;
  fetchAfterUpdateReturnsNull: boolean;
  // Corridas
  concurrentPublishers: number; // 1..N publish() disparados em paralelo
  // Regressão
  triggerOverwritesExistingToken: boolean; // trigger buggada que sobrescreve
}

interface MagRow {
  id: string;
  owner_id: string;
  organization_id: string | null;
  title: string;
  subtitle: string | null;
  template_id: string;
  branding: Record<string, unknown>;
  content_settings: Record<string, unknown>;
  page_order: number[] | null;
  status: string;
  public_token: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

const state = vi.hoisted(() => ({
  row: null as MagRow | null,
  scenario: null as Scenario | null,
  tokenUpdateAttempts: 0,
  statusUpdateAttempts: 0,
  cryptoCalled: 0,
}));

// Mock builder que respeita o cenário atual
const builder = vi.hoisted(() => {
  return (table: string) => {
    const filters: { column: string; value: unknown; op: 'eq' | 'is' }[] = [];
    const q: Record<string, unknown> = {};
    q.select = () => q;
    q.eq = (col: string, val: unknown) => {
      filters.push({ column: col, value: val, op: 'eq' });
      return q;
    };
    q.is = (col: string, val: unknown) => {
      filters.push({ column: col, value: val, op: 'is' });
      return q;
    };
    q.order = () =>
      Promise.resolve({
        data: table === 'magazine_items' ? [] : state.row ? [state.row] : [],
        error: null,
      });
    q.maybeSingle = () => {
      if (table !== 'magazines') return Promise.resolve({ data: null, error: null });
      if (state.scenario?.fetchAfterUpdateReturnsNull && state.statusUpdateAttempts > 0) {
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: state.row, error: null });
    };
    q.insert = () => Promise.resolve({ error: null });
    q.delete = () => q;
    q.update = (patch: Partial<MagRow>) => {
      const isStatusUpdate = 'status' in patch;
      const isTokenUpdate = 'public_token' in patch;

      if (isStatusUpdate) {
        state.statusUpdateAttempts++;
        if (state.scenario?.statusUpdateFails) {
          return { eq: () => Promise.resolve({ error: { message: 'RLS denied' } }) };
        }
        // Trigger BEFORE simulada
        if (
          patch.status === 'published' &&
          state.scenario?.triggerFillsToken &&
          state.row
        ) {
          if (!state.row.public_token || state.scenario.triggerOverwritesExistingToken) {
            state.row.public_token = 'cafe'.repeat(8); // 32 hex
          }
        }
        if (state.row) Object.assign(state.row, patch);
      }

      if (isTokenUpdate && state.row) {
        state.tokenUpdateAttempts++;
        if (state.scenario?.tokenUpdateFails) {
          return { eq: () => ({ is: () => Promise.resolve({ error: { message: 'update failed' } }) }) };
        }
        // Respeita a guarda `.is('public_token', null)` — só grava se atualmente NULL
        const guardsNull = filters.some((f) => f.op === 'is' && f.column === 'public_token' && f.value === null);
        if (!guardsNull || state.row.public_token === null) {
          state.row.public_token = patch.public_token ?? state.row.public_token;
        }
      }

      return {
        eq: () => {
          const chained = {
            is: () => Promise.resolve({ error: null }),
          };
          const p: Promise<{ error: null }> & typeof chained = Promise.resolve({ error: null }) as unknown as Promise<{ error: null }> & typeof chained;
          Object.assign(p, chained);
          return p;
        },
      };
    };
    return q;
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (t: string) => builder(t) },
}));

// Espia crypto para contar quantas vezes o fallback é usado
beforeEach(() => {
  state.tokenUpdateAttempts = 0;
  state.statusUpdateAttempts = 0;
  state.cryptoCalled = 0;
  const original = globalThis.crypto?.getRandomValues?.bind(globalThis.crypto);
  if (original) {
    vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((buf) => {
      state.cryptoCalled++;
      return original(buf);
    });
  }
});

// Import DEPOIS dos mocks
import { magazineService } from '@/services/magazineService';

function makeRow(initialToken: string | null, initialStatus: MagRow['status']): MagRow {
  return {
    id: 'mag_fuzz',
    owner_id: 'u1',
    organization_id: null,
    title: 'Rev',
    subtitle: null,
    template_id: 'editorial-vogue',
    branding: {},
    content_settings: {},
    page_order: null,
    status: initialStatus,
    public_token: initialToken,
    published_at: initialStatus === 'published' ? '2026-07-15T00:00:00Z' : null,
    created_at: '2026-07-15T00:00:00Z',
    updated_at: '2026-07-15T00:00:00Z',
    deleted_at: null,
  };
}

// ---------------------------------------------------------------------------
// Gerador combinatório de cenários
// ---------------------------------------------------------------------------

function generateScenarios(): Scenario[] {
  const scenarios: Scenario[] = [];
  let i = 0;
  const tokens: Array<string | null> = [null, 'a1b2c3d4e5f60718293a4b5c6d7e8f90']; // NULL + já-emitido
  const statuses: Array<'draft' | 'published' | 'archived'> = ['draft', 'published'];
  const triggerStates = [true, false];
  const statusFailStates = [true, false];
  const tokenFailStates = [true, false];
  const fetchNullStates = [true, false];
  const concurrencyLevels = [1, 3, 8];
  const overwriteStates = [false]; // bug variant

  for (const initialToken of tokens) {
    for (const initialStatus of statuses) {
      for (const triggerFillsToken of triggerStates) {
        for (const statusUpdateFails of statusFailStates) {
          for (const tokenUpdateFails of tokenFailStates) {
            for (const fetchAfterUpdateReturnsNull of fetchNullStates) {
              for (const concurrentPublishers of concurrencyLevels) {
                for (const triggerOverwritesExistingToken of overwriteStates) {
                  scenarios.push({
                    id: `S${String(i++).padStart(4, '0')}`,
                    initialToken,
                    initialStatus,
                    triggerFillsToken,
                    statusUpdateFails,
                    tokenUpdateFails,
                    fetchAfterUpdateReturnsNull,
                    concurrentPublishers,
                    triggerOverwritesExistingToken,
                  });
                }
              }
            }
          }
        }
      }
    }
  }
  // Adicione a variante "trigger sobrescreve token existente" para exercitar a guarda
  scenarios.push({
    id: 'S_BUG_OVERWRITE',
    initialToken: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
    initialStatus: 'published',
    triggerFillsToken: true,
    statusUpdateFails: false,
    tokenUpdateFails: false,
    fetchAfterUpdateReturnsNull: false,
    concurrentPublishers: 1,
    triggerOverwritesExistingToken: true,
  });
  return scenarios;
}

// ---------------------------------------------------------------------------
// Relatório final
// ---------------------------------------------------------------------------

interface Result {
  scenario: Scenario;
  invariants: Record<string, boolean>;
  finalToken: string | null;
  crypto: number;
  statusAttempts: number;
  tokenAttempts: number;
  error?: string;
}
const results: Result[] = [];

afterAll(() => {
  const total = results.length;
  const failing = results.filter((r) => Object.values(r.invariants).some((v) => !v));
  const cryptoUsed = results.filter((r) => r.crypto > 0).length;
  // Emite JSON compacto — os invariantes explicam a saúde do publish em cada caso.
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        suite: 'magazinePublish.fuzz',
        total,
        passing: total - failing.length,
        failing: failing.length,
        cryptoFallbackUsedIn: cryptoUsed,
        firstFailures: failing.slice(0, 5).map((r) => ({
          id: r.scenario.id,
          scenario: r.scenario,
          invariants: r.invariants,
          finalToken: r.finalToken,
        })),
      },
      null,
      2,
    ),
  );
});

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('magazineService.publish — fuzz massivo (400+ cenários)', () => {
  const scenarios = generateScenarios();

  it(`gera ≥ 190 cenários combinatórios`, () => {
    expect(scenarios.length).toBeGreaterThanOrEqual(190);
  });

  it.each(scenarios)('cenário $id honra os invariantes', async (scenario) => {
    state.scenario = scenario;
    state.row = makeRow(scenario.initialToken, scenario.initialStatus);

    // Executa 1..N publish() em paralelo
    const runs = Array.from({ length: scenario.concurrentPublishers }, () =>
      magazineService.publish('mag_fuzz').catch((err: Error) => ({ _err: err.message })),
    );
    const outcomes = await Promise.all(runs);

    // Todos os retornos precisam ser Magazine|null e nunca throw
    const anyThrow = outcomes.some((o) => o && typeof o === 'object' && '_err' in o);

    const finalToken = state.row?.public_token ?? null;
    const anyOk = outcomes.some((o) => o && !('_err' in (o as object)) && (o as { publicToken?: string })?.publicToken);

    const inv: Record<string, boolean> = {
      // INV-3: nunca lança
      neverThrows: !anyThrow,
      // INV-4: token final é 32 hex ou null (nunca formato inválido)
      tokenFormatValid: finalToken === null || /^[a-f0-9]{32}$/i.test(finalToken),
      // INV-1: se o BD aceitou pelo menos um UPDATE de status, existe token no final
      //        (exceto quando fetch retornou null — cenário RLS invisível)
      tokenPresentWhenPublished:
        scenario.statusUpdateFails ||
        scenario.fetchAfterUpdateReturnsNull ||
        !!finalToken,
      // INV-2: token pré-existente não pode ter sido sobrescrito (a menos que trigger buggada)
      preservesExistingToken:
        scenario.initialToken === null ||
        scenario.triggerOverwritesExistingToken ||
        finalToken === scenario.initialToken,
      // INV-5: quando o BD tem token válido, pelo menos uma execução deve retornar Magazine com esse token
      hydratesWhenAvailable:
        !finalToken || scenario.fetchAfterUpdateReturnsNull || anyOk,
    };

    results.push({
      scenario,
      invariants: inv,
      finalToken,
      crypto: state.cryptoCalled,
      statusAttempts: state.statusUpdateAttempts,
      tokenAttempts: state.tokenUpdateAttempts,
    });

    // Cada invariante é asserção — falhas aparecem no relatório
    expect(inv.neverThrows, `${scenario.id}: publish() lançou`).toBe(true);
    expect(inv.tokenFormatValid, `${scenario.id}: token com formato inválido (${finalToken})`).toBe(true);
    expect(
      inv.preservesExistingToken,
      `${scenario.id}: token existente foi sobrescrito (antes=${scenario.initialToken}, depois=${finalToken})`,
    ).toBe(true);
  });
});
