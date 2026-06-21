/**
 * Behavioural tests for mockupGenerationService.
 *
 * Replaces the previous grep-based "audit" suite (mockup-audit.test.ts) with tests that
 * exercise real behaviour: the Supabase client and storage helpers are mocked so the
 * functions run end-to-end against a controllable fake.
 *
 * Run: npx vitest run src/hooks/mockup/__tests__/mockupGenerationService.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Supabase client mock (chainable, thenable query builder) ────────────────
const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
let tableResults: Record<
  string,
  { data: unknown; error: unknown }[] | { data: unknown; error: unknown }
> = {};
const captured: { insert?: Record<string, unknown> } = {};

vi.mock('@/integrations/supabase/client', () => {
  const makeBuilder = (table: string) => {
    // result(): se tableResults[table] for um array, consome em fila (1ª chamada => [0],
    // 2ª => [1], ...) — permite simular retry-on-FK. Objeto único = comportamento legado.
    const result = () => {
      const r = tableResults[table];
      if (Array.isArray(r)) {
        return r.length > 1 ? (r.shift() as { data: unknown; error: unknown }) : r[0];
      }
      return r ?? { data: null, error: null };
    };
    const q: Record<string, unknown> = {};
    const chain = (method: string) =>
      vi.fn((...args: unknown[]) => {
        calls.push({ table, method, args });
        if (method === 'insert') captured.insert = args[0] as Record<string, unknown>;
        return q;
      });
    for (const m of ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'order', 'limit']) {
      q[m] = chain(m);
    }
    q.maybeSingle = vi.fn(() => Promise.resolve(result()));
    q.single = vi.fn(() => Promise.resolve(result()));
    (q as { then?: unknown }).then = (
      resolve: (v: unknown) => unknown,
      reject: (e: unknown) => unknown,
    ) => Promise.resolve(result()).then(resolve, reject);
    return q;
  };
  return {
    supabase: {
      from: vi.fn((t: string) => makeBuilder(t)),
      functions: { invoke: vi.fn() },
    },
  };
});

vi.mock('@/lib/mockup-storage', () => ({
  uploadLogoToStorage: vi.fn(async () => 'https://storage/uploaded-logo.png'),
  downloadImageAsPdfFromUrl: vi.fn(async () => {}),
}));

vi.mock('sonner', () => ({
  toast: { info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

import { supabase } from '@/integrations/supabase/client';
import { uploadLogoToStorage } from '@/lib/mockup-storage';
import { toast } from 'sonner';
import {
  getTechniquePrompt,
  saveMockupToDb,
  fetchMockupHistory,
  deleteMockupFromDb,
  generateMockupApi,
  validateSvgLogo,
  buildTechniqueList,
  buildMockupToastMessage,
  type Technique,
} from '@/hooks/mockup/mockupGenerationService';
import type { PersonalizationArea } from '@/components/mockup/MultiAreaManager';

const invoke = supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>;

/** Mimics the FunctionsHttpError shape supabase-js produces for non-2xx responses. */
function httpError(status: number, body: unknown): Error & { context: Response } {
  const resp = new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
  const err = new Error(`Edge Function returned a non-2xx status code`) as Error & {
    context: Response;
  };
  err.context = resp;
  return err;
}

const area = (over: Partial<PersonalizationArea> = {}): PersonalizationArea => ({
  id: 'a1',
  name: 'Frente',
  positionX: 50,
  positionY: 50,
  logoWidth: 5,
  logoHeight: 3,
  logoRotation: 0,
  logoScale: 100,
  logoPreview: 'https://cdn.example.com/logo.png',
  ...over,
});

const silk: Technique = { id: 'tech-1', name: 'Serigrafia', code: 'silk' };

beforeEach(() => {
  calls.length = 0;
  tableResults = {};
  captured.insert = undefined;
  invoke.mockReset();
  (uploadLogoToStorage as unknown as ReturnType<typeof vi.fn>).mockClear();
  (toast.warning as ReturnType<typeof vi.fn>).mockClear();
});

// ─── getTechniquePrompt (pure) ──────────────────────────────────────
describe('getTechniquePrompt', () => {
  it('maps known technique codes to their prompts', () => {
    expect(getTechniquePrompt({ id: '1', name: 'Serigrafia', code: 'silk' })).toMatch(
      /screen printed/,
    );
    expect(getTechniquePrompt({ id: '2', name: 'Bordado', code: 'bordado' })).toMatch(/embroidery/);
    expect(getTechniquePrompt({ id: '3', name: 'Laser', code: 'laser' })).toMatch(/laser engraved/);
  });

  it('falls back to default for unknown techniques', () => {
    expect(getTechniquePrompt({ id: '4', name: 'Nova', code: null })).toMatch(
      /professionally printed/,
    );
  });

  it('does not let "default" win by substring (T7 regression)', () => {
    // contains "laser" → must resolve to laser, never to the default bucket
    expect(getTechniquePrompt({ id: '5', name: 'X', code: 'laser-default-special' })).toMatch(
      /laser engraved/,
    );
  });
});

// ─── saveMockupToDb ───────────────────────────────────────────────
describe('saveMockupToDb', () => {
  it('persists rotation/scale in area_config and thumbnail_url = mockupUrl (G5/T10)', async () => {
    tableResults.products = { data: { id: 'prod-1' }, error: null };
    tableResults.generated_mockups = { data: { id: 'rec-1' }, error: null };

    const recordId = await saveMockupToDb({
      userId: 'user-1',
      product: { id: 'prod-1', name: 'Caneca', sku: 'CAN-001' },
      technique: silk,
      client: { id: 'c1', name: 'Cliente' },
      area: area({ logoRotation: 45, logoScale: 150 }),
      mockupUrl: 'https://cdn.example.com/mockup.png',
    });

    expect(recordId).toBe('rec-1');
    const row = captured.insert!;
    expect(row.thumbnail_url).toBe('https://cdn.example.com/mockup.png');
    expect(row.position_x).toBe(50);
    expect(row.logo_url).toBe('https://cdn.example.com/logo.png');
    const cfg = row.area_config as Record<string, unknown>;
    expect(cfg.logoRotation).toBe(45);
    expect(cfg.logoScale).toBe(150);
  });

  // BUG-10 regression: technique_id has a FK to personalization_techniques but the UI
  // loads techniques from tabela_preco_gravacao_oficial — zero UUID overlap. Sending a
  // tabela_preco UUID causes a FK violation and silently prevents every save.
  // The fix: always send null for technique_id; technique_name (text) carries the name.
  it('always sends technique_id: null to avoid FK violation (BUG-10)', async () => {
    tableResults.products = { data: { id: 'prod-1' }, error: null };
    tableResults.generated_mockups = { data: { id: 'rec-1' }, error: null };

    await saveMockupToDb({
      userId: 'user-1',
      product: { id: 'prod-1', name: 'Caneca', sku: 'CAN-001' },
      technique: silk,
      client: null,
      area: area(),
      mockupUrl: 'https://cdn.example.com/mockup.png',
    });

    expect(captured.insert!.technique_id).toBeNull();
    expect(captured.insert!.technique_name).toBe('Serigrafia');
  });

  it('uploads data: logos and nulls product_id when the product is unknown', async () => {
    // Nova estratégia (BUG-PRODUCT-EXTRA-SELECT): sem SELECT prévio em products.
    // O 1º insert com product_id:'ghost' (UUID inexistente) recebe FK violation 23503,
    // e o código faz retry com product_id:null. Simulamos a fila: erro depois sucesso.
    tableResults.products = { data: null, error: null };
    tableResults.generated_mockups = [
      { data: null, error: { code: '23503', message: 'FK violation on product_id' } },
      { data: { id: 'rec-2' }, error: null },
    ];

    const recordId = await saveMockupToDb({
      userId: 'user-1',
      product: { id: 'ghost', name: 'Caneca', sku: 'CAN-001' },
      technique: silk,
      client: null,
      area: area({ logoPreview: 'data:image/png;base64,AAAA' }),
      mockupUrl: 'https://cdn.example.com/m.png',
    });

    expect(recordId).toBe('rec-2');
    expect(uploadLogoToStorage).toHaveBeenCalledTimes(1);
    expect(captured.insert!.logo_url).toBe('https://storage/uploaded-logo.png');
    expect(captured.insert!.product_id).toBeNull();
  });

  it('returns null (does not throw) when the insert fails', async () => {
    tableResults.products = { data: { id: 'prod-1' }, error: null };
    tableResults.generated_mockups = { data: null, error: new Error('insert boom') };
    const recordId = await saveMockupToDb({
      userId: 'user-1',
      product: { id: 'prod-1', name: 'Caneca' },
      technique: silk,
      client: null,
      area: area(),
      mockupUrl: 'https://cdn.example.com/m.png',
    });
    expect(recordId).toBeNull();
  });
});

// ─── fetchMockupHistory ───────────────────────────────────────────
describe('fetchMockupHistory', () => {
  it('selects layout_url + area_config, limits to 200, and scopes by owner', async () => {
    tableResults.generated_mockups = {
      data: [{ id: 'm1', mockup_url: 'https://cdn.example.com/m.png' }],
      error: null,
    };
    const data = await fetchMockupHistory('user-1');
    expect(data).toHaveLength(1);

    const select = calls.find((c) => c.method === 'select');
    expect(select!.args[0]).toContain('layout_url');
    expect(select!.args[0]).toContain('area_config');
    expect(calls.some((c) => c.method === 'limit' && c.args[0] === 200)).toBe(true);
    expect(
      calls.some((c) => c.method === 'eq' && c.args[0] === 'user_id' && c.args[1] === 'user-1'),
    ).toBe(true);
  });

  it('omits the owner filter when no userId is given', async () => {
    tableResults.generated_mockups = { data: [], error: null };
    await fetchMockupHistory();
    expect(calls.some((c) => c.method === 'eq' && c.args[0] === 'user_id')).toBe(false);
  });

  it('throws when the query errors', async () => {
    tableResults.generated_mockups = { data: null, error: new Error('select boom') };
    await expect(fetchMockupHistory('user-1')).rejects.toThrow('select boom');
  });
});

// ─── deleteMockupFromDb ───────────────────────────────────────────
describe('deleteMockupFromDb', () => {
  it('applies an owner-scoped filter when userId is provided (T6)', async () => {
    tableResults.generated_mockups = { data: null, error: null };
    await deleteMockupFromDb('m1', 'user-1');
    expect(calls.some((c) => c.method === 'eq' && c.args[0] === 'id' && c.args[1] === 'm1')).toBe(
      true,
    );
    expect(
      calls.some((c) => c.method === 'eq' && c.args[0] === 'user_id' && c.args[1] === 'user-1'),
    ).toBe(true);
  });

  it('does not scope by user_id when userId is absent', async () => {
    tableResults.generated_mockups = { data: null, error: null };
    await deleteMockupFromDb('m2');
    expect(calls.some((c) => c.method === 'eq' && c.args[0] === 'user_id')).toBe(false);
  });

  it('throws on delete error', async () => {
    tableResults.generated_mockups = { data: null, error: new Error('delete boom') };
    await expect(deleteMockupFromDb('m3', 'user-1')).rejects.toThrow('delete boom');
  });
});

// ─── generateMockupApi ────────────────────────────────────────────
describe('generateMockupApi', () => {
  const baseParams = {
    productImage: 'https://cdn.example.com/product.png',
    productName: 'Caneca',
    technique: silk,
  };

  it('single area: returns the URL and never sends the dead areas[] payload (G3)', async () => {
    invoke.mockResolvedValue({
      data: { mockupUrl: 'https://cdn.example.com/out.png' },
      error: null,
    });
    const res = await generateMockupApi({ ...baseParams, areas: [area()] });

    expect(res).toEqual({ singleUrl: 'https://cdn.example.com/out.png', batchResults: [] });
    expect(invoke).toHaveBeenCalledTimes(1);
    const body = invoke.mock.calls[0][1].body as Record<string, unknown>;
    expect(body).not.toHaveProperty('areas');
    expect(body.logoUrl).toBe('https://cdn.example.com/logo.png');
    expect(body.productImageUrl).toBe('https://cdn.example.com/product.png');
  });

  // BUG-400c regression: a freshly-uploaded logo is a data: URL, and the edge
  // function rejects data: URLs supplied as logoUrl. It MUST be sent as logoBase64.
  it('sends a data: URL logo as logoBase64 (never as logoUrl) — primary upload flow', async () => {
    invoke.mockResolvedValue({
      data: { mockupUrl: 'https://cdn.example.com/out.png' },
      error: null,
    });
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAA=';
    await generateMockupApi({ ...baseParams, areas: [area({ logoPreview: dataUrl })] });

    const body = invoke.mock.calls[0][1].body as Record<string, unknown>;
    expect(body.logoBase64).toBe(dataUrl);
    expect(body).not.toHaveProperty('logoUrl');
  });

  // BUG-400c regression: field names + technique metadata must match the edge contract.
  it('maps geometry to logoWidthCm/logoHeightCm and technique to techniqueName', async () => {
    invoke.mockResolvedValue({
      data: { mockupUrl: 'https://cdn.example.com/out.png' },
      error: null,
    });
    await generateMockupApi({
      ...baseParams,
      areas: [area({ logoWidth: 8, logoHeight: 4 })],
    });

    const body = invoke.mock.calls[0][1].body as Record<string, unknown>;
    expect(body.logoWidthCm).toBe(8);
    expect(body.logoHeightCm).toBe(4);
    expect(body.techniqueName).toBe('Serigrafia');
    // legacy/wrong field names must NOT be present
    expect(body).not.toHaveProperty('logoWidth');
    expect(body).not.toHaveProperty('logoHeight');
    expect(body).not.toHaveProperty('technique');
  });

  // BUG-400d regression: logo-less areas must be filtered out, not sent and failed.
  it('ignores areas without a logo and treats a single logged area as the single path', async () => {
    invoke.mockResolvedValue({
      data: { mockupUrl: 'https://cdn.example.com/out.png' },
      error: null,
    });
    const res = await generateMockupApi({
      ...baseParams,
      areas: [
        area({ name: 'Frente', logoPreview: 'https://cdn.example.com/logo.png' }),
        area({ name: 'Costas', logoPreview: null }),
      ],
    });

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(res.batchResults).toEqual([]);
    expect(res.singleUrl).toBe('https://cdn.example.com/out.png');
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it('throws a friendly error when no area has a logo', async () => {
    await expect(
      generateMockupApi({ ...baseParams, areas: [area({ logoPreview: null })] }),
    ).rejects.toThrow(/upload de pelo menos um logo/i);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('translates the SVG_NOT_SUPPORTED error code into a friendly message (G1)', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: httpError(400, {
        error: 'validation_failed',
        errorCode: 'SVG_NOT_SUPPORTED',
        message: 'Logos SVG não são suportados. Use PNG ou JPG.',
      }),
    });
    await expect(generateMockupApi({ ...baseParams, areas: [area()] })).rejects.toThrow(/SVG/);
  });

  it('surfaces the edge error message on a generic failure', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: httpError(500, { error: 'composition_failed', message: 'canvas exploded' }),
    });
    await expect(generateMockupApi({ ...baseParams, areas: [area()] })).rejects.toThrow(
      'canvas exploded',
    );
  });

  it('throws when the function returns no image URL', async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    await expect(generateMockupApi({ ...baseParams, areas: [area()] })).rejects.toThrow(
      /Nenhuma imagem/,
    );
  });

  it('batch: keeps successful areas and warns about failures', async () => {
    invoke
      .mockResolvedValueOnce({
        data: { mockupUrl: 'https://cdn.example.com/front.png' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: httpError(500, { error: 'composition_failed', message: 'boom' }),
      });

    const res = await generateMockupApi({
      ...baseParams,
      areas: [area({ name: 'Frente' }), area({ name: 'Costas' })],
    });

    expect(res.batchResults).toHaveLength(1);
    expect(res.singleUrl).toBe('https://cdn.example.com/front.png');
    expect(toast.warning).toHaveBeenCalledTimes(1);
  });

  it('batch: throws when every area fails', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: httpError(500, { error: 'composition_failed' }),
    });
    await expect(
      generateMockupApi({
        ...baseParams,
        areas: [area({ name: 'Frente' }), area({ name: 'Costas' })],
      }),
    ).rejects.toThrow(/Nenhum mockup gerado/);
  });
});

// ─── validateSvgLogo (pure) ───────────────────────────────────────
describe('validateSvgLogo', () => {
  it('accepts a non-SVG data URL', () => {
    expect(validateSvgLogo('data:image/png;base64,AAAA').valid).toBe(true);
  });

  it('accepts a plain SVG with no scripts', () => {
    const svgText = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>';
    const b64 = btoa(svgText);
    const result = validateSvgLogo(`data:image/svg+xml;base64,${b64}`);
    expect(result.valid).toBe(true);
  });

  it('rejects an SVG that contains <script>', () => {
    const svgText = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
    const b64 = btoa(svgText);
    const result = validateSvgLogo(`data:image/svg+xml;base64,${b64}`);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/script/i);
  });

  it('rejects an SVG that contains javascript: URLs', () => {
    const svgText = '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"/></svg>';
    const b64 = btoa(svgText);
    const result = validateSvgLogo(`data:image/svg+xml;base64,${b64}`);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/script/i);
  });

  it('rejects a data URL that claims to be SVG but has no <svg> element', () => {
    const b64 = btoa('not an svg at all');
    const result = validateSvgLogo(`data:image/svg+xml;base64,${b64}`);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/<svg>/i);
  });

  it('returns invalid (not throw) when the base64 is undecodeable', () => {
    const result = validateSvgLogo('data:image/svg+xml;base64,!!!not-valid-base64!!!');
    expect(result.valid).toBe(false);
  });
});

// ─── buildTechniqueList (pure) ────────────────────────────────────
describe('buildTechniqueList', () => {
  it('filters out items without id or name', () => {
    const raw = [
      { id: '1', name: 'Silk', code: 'silk' },
      { id: '2' }, // no name
      { name: 'Laser' }, // no id
      null,
      undefined,
      42,
    ];
    const list = buildTechniqueList(raw as unknown[]);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('1');
    expect(list[0].name).toBe('Silk');
  });

  it('coerces id/name to strings', () => {
    const list = buildTechniqueList([{ id: 99, name: 'Bordado', code: null }]);
    expect(typeof list[0].id).toBe('string');
    expect(list[0].id).toBe('99');
  });

  it('sets code to null when absent', () => {
    const list = buildTechniqueList([{ id: '1', name: 'X' }]);
    expect(list[0].code).toBeNull();
  });

  it('preserves extra properties via spread', () => {
    const list = buildTechniqueList([{ id: '1', name: 'X', price: 9.99 }]);
    expect((list[0] as Record<string, unknown>).price).toBe(9.99);
  });
});

// ─── buildMockupToastMessage (pure) ──────────────────────────────
describe('buildMockupToastMessage', () => {
  it('returns the technique name in the title', () => {
    const { title } = buildMockupToastMessage('Bordado');
    expect(title).toContain('Bordado');
  });

  it('reports revisions remaining when revisionsLeft > 0', () => {
    const { description } = buildMockupToastMessage('Silk', 3);
    expect(description).toMatch(/3 revisões/);
  });

  it('reports "Resultado final" when revisionsLeft is 0', () => {
    const { description } = buildMockupToastMessage('Silk', 0);
    expect(description).toMatch(/final/i);
  });

  it('reports "Resultado final" when revisionsLeft is absent', () => {
    const { description } = buildMockupToastMessage('Silk');
    expect(description).toMatch(/final/i);
  });
});

// ─── generateMockupApi SVG pre-validation (BUG-E) ────────────────
describe('generateMockupApi SVG pre-validation', () => {
  it('throws before calling the edge function when a logo is a data:image/svg URL', async () => {
    await expect(
      generateMockupApi({
        productImage: 'https://cdn.example.com/product.png',
        productName: 'Caneca',
        technique: silk,
        areas: [area({ logoPreview: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz...' })],
      }),
    ).rejects.toThrow(/SVG não são suportados/i);
    expect(invoke).not.toHaveBeenCalled();
  });
});

// ─── generateMockupApi → edge payload contract (AUDIT 2026-06-17) ────────────
// Regression guards for the client→edge contract that silently broke the whole
// generator (verified against supabase/functions/generate-mockup/index.ts):
//   • a freshly-uploaded logo is a data: URL and MUST travel as `logoBase64` — a
//     data: URL placed in `logoUrl` fails the edge's isValidHttpUrl() and the
//     function returned HTTP 400 on every fresh upload;
//   • the edge reads `logoWidthCm` / `logoHeightCm` / `techniqueName`, so the
//     legacy `logoWidth` / `logoHeight` / `technique` keys must no longer be
//     sent (when they were, the logo always rendered at the 5×3 cm default).
describe('generateMockupApi → edge payload contract', () => {
  const baseParams = {
    productImage: 'https://cdn.example.com/product.png',
    productName: 'Caneca',
    technique: silk,
  };

  const bodyOf = () => invoke.mock.calls[0][1].body as Record<string, unknown>;

  beforeEach(() => {
    invoke.mockResolvedValue({
      data: { mockupUrl: 'https://cdn.example.com/out.png' },
      error: null,
    });
  });

  it('routes a freshly-uploaded data: URL logo to logoBase64 (never logoUrl)', async () => {
    await generateMockupApi({
      ...baseParams,
      areas: [area({ logoPreview: 'data:image/png;base64,AAAA' })],
    });
    const body = bodyOf();
    expect(body.logoBase64).toBe('data:image/png;base64,AAAA');
    expect(body.logoUrl).toBeUndefined();
  });

  it('routes an HTTPS logo preview to logoUrl (never logoBase64)', async () => {
    await generateMockupApi({
      ...baseParams,
      areas: [area({ logoPreview: 'https://cdn.example.com/logo.png' })],
    });
    const body = bodyOf();
    expect(body.logoUrl).toBe('https://cdn.example.com/logo.png');
    expect(body.logoBase64).toBeUndefined();
  });

  it('sends size + technique under the keys the edge reads, and drops legacy keys', async () => {
    await generateMockupApi({
      ...baseParams,
      areas: [area({ logoWidth: 8, logoHeight: 6, logoScale: 120 })],
    });
    const body = bodyOf();
    // new contract — these are what generate-mockup/index.ts actually consumes
    expect(body.logoWidthCm).toBe(8);
    expect(body.logoHeightCm).toBe(6);
    expect(body.logoScale).toBe(120);
    expect(body.techniqueName).toBe('Serigrafia');
    // legacy keys must be gone so they can never shadow the contract again
    expect(body.logoWidth).toBeUndefined();
    expect(body.logoHeight).toBeUndefined();
    expect(body.technique).toBeUndefined();
  });
});
