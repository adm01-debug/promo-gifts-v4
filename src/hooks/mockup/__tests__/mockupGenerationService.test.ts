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
let tableResults: Record<string, { data: unknown; error: unknown }> = {};
const captured: { insert?: Record<string, unknown> } = {};

vi.mock('@/integrations/supabase/client', () => {
  const makeBuilder = (table: string) => {
    const result = () => tableResults[table] ?? { data: null, error: null };
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

// ─── getTechniquePrompt (pure) ───────────────────────────────────────────────
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

// ─── saveMockupToDb ──────────────────────────────────────────────────────────
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

  it('uploads data: logos and nulls product_id when the product is unknown', async () => {
    tableResults.products = { data: null, error: null };
    tableResults.generated_mockups = { data: { id: 'rec-2' }, error: null };

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

// ─── fetchMockupHistory ──────────────────────────────────────────────────────
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

// ─── deleteMockupFromDb ──────────────────────────────────────────────────────
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

// ─── generateMockupApi ───────────────────────────────────────────────────────
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
