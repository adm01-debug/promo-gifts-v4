/**
 * Teste de INTEGRAÇÃO — bate na bridge real do external DB.
 *
 * Por padrão SKIPPED. Habilita com:
 *   RUN_INTEGRATION_TESTS=1 npx vitest run src/lib/external-db/kit-coverage.integration.test.ts
 *
 * Opcionalmente pinne um kit específico:
 *   KIT_FIXTURE_ID=<uuid> RUN_INTEGRATION_TESTS=1 vitest run ...
 *
 * Sem pin, descobre o primeiro produto com is_kit=true do SSOT.
 *
 * Asserts (gate de qualidade da view):
 *   1. View NÃO retorna menos linhas que a base
 *   2. View NÃO regride em nenhum campo crítico (% por campo ≥ base)
 *   3. Cobertura média da view ≥ 70%
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { dbInvoke } from '@/lib/db/postgrest';
import { computeKitCoverage, compareCoverage } from './kit-coverage';

const INTEGRATION_ENABLED = process.env.RUN_INTEGRATION_TESTS === '1';
const MIN_VIEW_AVG_COVERAGE_PCT = 70;
const KIT_SELECT_FIELDS =
  'id, component_name, component_description, material, color, primary_image_url, images, ' +
  'height_mm, width_mm, length_mm, diameter_mm, circumference_mm, weight_g, capacity_ml, ' +
  'component_type_code, supplier_component_code, personalization_notes, display_order';

describe.skipIf(!INTEGRATION_ENABLED)(
  'kit-coverage / integração (view vs base no SSOT real)',
  () => {
    let kitId: string;

    beforeAll(async () => {
      const pinned = process.env.KIT_FIXTURE_ID;
      if (pinned) {
        kitId = pinned;
        return;
      }
      // Descobre primeiro produto kit com componentes
      const { records } = await dbInvoke<{ id: string }>({
        table: 'products',
        operation: 'select',
        select: 'id',
        filters: { is_kit: true, active: true },
        limit: 50,
      });
      if (records.length === 0) {
        throw new Error('Nenhum kit ativo encontrado no SSOT. Defina KIT_FIXTURE_ID.');
      }
      // Acha o primeiro que tem componentes de fato
      for (const p of records) {
        const { records: comps } = await dbInvoke<{ id: string }>({
          table: 'product_kit_components',
          operation: 'select',
          select: 'id',
          filters: { kit_product_id: p.id },
          limit: 1,
        });
        if (comps.length > 0) {
          kitId = p.id;
          return;
        }
      }
      throw new Error('Nenhum kit com componentes encontrado. Defina KIT_FIXTURE_ID.');
    }, 30_000);

    it('view e base retornam linhas para o mesmo kit', async () => {
      const [viewRes, baseRes] = await Promise.all([
        dbInvoke<Record<string, unknown>>({
          table: 'v_kit_component_complete',
          operation: 'select',
          select: '*',
          filters: { kit_product_id: kitId },
          orderBy: { column: 'display_order', ascending: true },
          limit: 200,
        }),
        dbInvoke<Record<string, unknown>>({
          table: 'product_kit_components',
          operation: 'select',
          select: KIT_SELECT_FIELDS,
          filters: { kit_product_id: kitId },
          orderBy: { column: 'display_order', ascending: true },
          limit: 200,
        }),
      ]);

      expect(baseRes.records.length).toBeGreaterThan(0);
      expect(viewRes.records.length).toBeGreaterThanOrEqual(baseRes.records.length);
    }, 30_000);

    it('view NÃO regride em nenhum campo crítico vs base', async () => {
      const [viewRes, baseRes] = await Promise.all([
        dbInvoke<Record<string, unknown>>({
          table: 'v_kit_component_complete',
          operation: 'select',
          select: '*',
          filters: { kit_product_id: kitId },
          orderBy: { column: 'display_order', ascending: true },
          limit: 200,
        }),
        dbInvoke<Record<string, unknown>>({
          table: 'product_kit_components',
          operation: 'select',
          select: KIT_SELECT_FIELDS,
          filters: { kit_product_id: kitId },
          orderBy: { column: 'display_order', ascending: true },
          limit: 200,
        }),
      ]);

      const viewReport = computeKitCoverage(viewRes.records);
      const baseReport = computeKitCoverage(baseRes.records);
      const { regressions } = compareCoverage(viewReport, baseReport);

      if (regressions.length > 0) {
        // eslint-disable-next-line no-console
        console.error('Regressões detectadas:', regressions);
        // eslint-disable-next-line no-console
        console.error('View coverage:', viewReport.coverage);
        // eslint-disable-next-line no-console
        console.error('Base coverage:', baseReport.coverage);
      }
      expect(regressions).toEqual([]);
    }, 30_000);

    it(`cobertura média da view ≥ ${MIN_VIEW_AVG_COVERAGE_PCT}%`, async () => {
      const { records } = await dbInvoke<Record<string, unknown>>({
        table: 'v_kit_component_complete',
        operation: 'select',
        select: '*',
        filters: { kit_product_id: kitId },
        orderBy: { column: 'display_order', ascending: true },
        limit: 200,
      });
      const report = computeKitCoverage(records);
      if (report.avgPct < MIN_VIEW_AVG_COVERAGE_PCT) {
        // eslint-disable-next-line no-console
        console.error(
          `Cobertura ${report.avgPct}% < threshold ${MIN_VIEW_AVG_COVERAGE_PCT}%. ` +
            `Campos 100% null: ${report.fullyNullFields.join(', ')}`,
        );
      }
      expect(report.avgPct).toBeGreaterThanOrEqual(MIN_VIEW_AVG_COVERAGE_PCT);
    }, 30_000);
  },
);
