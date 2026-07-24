/**
 * Helpers de analytics para specs E2E.
 *
 * O app emite eventos em `window.__e2eAnalytics__` via `cartAnalytics.ts`.
 * Este módulo dá:
 *   - `readAnalyticsEvents(page)` — snapshot do buffer.
 *   - `readAnalyticsEventNames(page)` — só os `name`, na ordem inserida.
 *   - `resetAnalyticsBuffer(page)` — zera o buffer antes do cenário.
 *   - `assertEventOrder(actual, expected)` — verifica que `expected` aparece
 *     como SUBSEQUÊNCIA de `actual` (na ordem), tolerando eventos extras
 *     entre eles. Falha com mensagem descritiva mostrando o buffer real.
 *   - `waitForEventSequence(page, expected, opts)` — combinação polling +
 *     assert de ordem; o padrão E2E "aguarde N eventos na ordem certa".
 */
import { expect, type Page } from "@playwright/test";

export interface AnalyticsEvent {
  name: string;
  ts: string;
  payload: Record<string, unknown>;
}

const BUFFER_KEY = "__e2eAnalytics__";

export async function readAnalyticsEvents(page: Page): Promise<AnalyticsEvent[]> {
  return await page.evaluate((key) => {
    const buf =
      (window as unknown as Record<string, unknown>)[key] as
        | AnalyticsEvent[]
        | undefined;
    return Array.isArray(buf) ? [...buf] : [];
  }, BUFFER_KEY);
}

export async function readAnalyticsEventNames(page: Page): Promise<string[]> {
  const events = await readAnalyticsEvents(page);
  return events.map((e) => e.name);
}

export async function resetAnalyticsBuffer(page: Page): Promise<void> {
  await page.evaluate((key) => {
    (window as unknown as Record<string, unknown>)[key] = [];
  }, BUFFER_KEY);
}

/**
 * Verifica que `expected` aparece como subsequência ordenada em `actual`.
 * Não exige que sejam adjacentes — apenas que a ordem relativa seja
 * respeitada. Útil quando eventos secundários (ex.: page_view, focus)
 * podem intercalar sem invalidar o fluxo de negócio.
 *
 * Falha com mensagem descritiva listando o buffer real, o índice onde
 * a asserção quebrou e o evento faltante.
 */
export function assertEventOrder(
  actual: string[],
  expected: string[],
  ctx: { label?: string } = {},
): void {
  const label = ctx.label ?? "analytics";
  let cursor = 0;
  const trail: number[] = [];
  for (const name of expected) {
    const idx = actual.indexOf(name, cursor);
    if (idx === -1) {
      const msg =
        `[${label}] evento "${name}" não encontrado na ordem esperada.\n` +
        `  esperado (subsequência): ${JSON.stringify(expected)}\n` +
        `  buffer real:             ${JSON.stringify(actual)}\n` +
        `  matches parciais até:    ${JSON.stringify(trail)}`;
      expect(false, msg).toBe(true);
      return; // unreachable — expect acima já falhou
    }
    trail.push(idx);
    cursor = idx + 1;
  }
  // Sanity extra: os índices devem ser estritamente crescentes.
  for (let i = 1; i < trail.length; i++) {
    expect(
      trail[i]! > trail[i - 1]!,
      `[${label}] ordem violada em "${expected[i]}" (idx ${trail[i]} <= ${trail[i - 1]}). ` +
        `Buffer: ${JSON.stringify(actual)}`,
    ).toBe(true);
  }
}

export interface WaitForEventSequenceOptions {
  timeout?: number;
  pollInterval?: number;
  label?: string;
}

/**
 * Faz polling do buffer até que a sequência `expected` esteja presente
 * como subsequência ordenada — ou o timeout estoure. Retorna a lista final
 * de nomes vista quando a sequência foi satisfeita.
 */
export async function waitForEventSequence(
  page: Page,
  expected: string[],
  opts: WaitForEventSequenceOptions = {},
): Promise<string[]> {
  const timeout = opts.timeout ?? 8_000;
  const pollInterval = opts.pollInterval ?? 100;
  const label = opts.label ?? "analytics";
  const deadline = Date.now() + timeout;
  let lastNames: string[] = [];

  while (Date.now() < deadline) {
    lastNames = await readAnalyticsEventNames(page);
    let cursor = 0;
    let ok = true;
    for (const name of expected) {
      const idx = lastNames.indexOf(name, cursor);
      if (idx === -1) {
        ok = false;
        break;
      }
      cursor = idx + 1;
    }
    if (ok) return lastNames;
    await new Promise((r) => setTimeout(r, pollInterval));
  }

  // Timeout: gera falha rica com o buffer final.
  assertEventOrder(lastNames, expected, { label });
  return lastNames; // unreachable
}
