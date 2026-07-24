/**
 * Helper — Trilha diagnóstica para loops de Tab/Shift+Tab em E2E.
 *
 * Objetivo: quando um assert de sequência de foco falha, o erro do Playwright
 * mostra automaticamente a **trilha completa** dos passos executados (índice,
 * tecla, `activeElement`, `:focus-visible`, `className`, `box-shadow`) e o
 * esperado vs. o atual, para diagnóstico sem precisar re-rodar em modo trace.
 *
 * Uso típico:
 *
 * ```ts
 * const trail = createTabTrail();
 * try {
 *   await trail.tab(page, { expected: 'focus-1' });
 *   await trail.tab(page, { expected: 'focus-2' });
 *   trail.assertVisited(['focus-1', 'focus-2']);
 * } finally {
 *   await trail.attach(testInfo);
 * }
 * ```
 *
 * Se `assertVisited` falhar, o `Error` inclui a tabela formatada — que aparece
 * tanto no `list` reporter quanto no `html` reporter — e o JSON bruto vai como
 * anexo `tab-trail.json` no relatório do teste.
 */
import type { Page, TestInfo } from '@playwright/test';

export type TabKey = 'Tab' | 'Shift+Tab' | 'INIT';

export interface TabStep {
  /** 0-based, o passo `INIT` (leitura inicial) é o índice 0. */
  index: number;
  key: TabKey;
  activeTestId: string | null;
  tagName: string | null;
  focusVisible: boolean;
  className: string | null;
  boxShadow: string | null;
  expectedTestId: string | null;
}

interface RecordOptions {
  /** `data-testid` esperado após a tecla. Se omitido, o passo é registrado sem contrato. */
  expected?: string | null;
}

async function readActiveState(page: Page): Promise<Omit<TabStep, 'index' | 'key' | 'expectedTestId'>> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) {
      return {
        activeTestId: null,
        tagName: el ? el.tagName.toLowerCase() : null,
        focusVisible: false,
        className: null,
        boxShadow: null,
      };
    }
    let fv = false;
    try {
      fv = el.matches(':focus-visible');
    } catch {
      fv = false;
    }
    return {
      activeTestId: el.getAttribute('data-testid'),
      tagName: el.tagName.toLowerCase(),
      focusVisible: fv,
      className: typeof el.className === 'string' ? el.className : null,
      boxShadow: getComputedStyle(el).boxShadow || null,
    };
  });
}

function formatTrail(steps: TabStep[]): string {
  const header = ['#', 'key', 'active', 'tag', ':fv', 'expected', 'ok'];
  const rows = steps.map((s) => {
    const ok = s.expectedTestId == null ? '—' : s.expectedTestId === s.activeTestId ? '✓' : '✗';
    return [
      String(s.index).padStart(2, '0'),
      s.key,
      s.activeTestId ?? '(body)',
      s.tagName ?? '—',
      s.focusVisible ? 'true' : 'false',
      s.expectedTestId ?? '—',
      ok,
    ];
  });
  const widths = header.map((h, col) =>
    Math.max(h.length, ...rows.map((r) => r[col]!.length)),
  );
  const line = (cells: string[]) =>
    cells.map((c, i) => c.padEnd(widths[i]!, ' ')).join(' │ ');
  return [line(header), line(widths.map((w) => '─'.repeat(w))), ...rows.map(line)].join('\n');
}

export interface TabTrail {
  /** Registra o estado atual sem pressionar tecla (leitura inicial, útil no início do teste). */
  init(page: Page, opts?: RecordOptions): Promise<TabStep>;
  /** Pressiona `Tab` e registra o novo `activeElement`. */
  tab(page: Page, opts?: RecordOptions): Promise<TabStep>;
  /** Pressiona `Shift+Tab` e registra o novo `activeElement`. */
  shiftTab(page: Page, opts?: RecordOptions): Promise<TabStep>;
  /** Retorna a sequência de `data-testid` visitados, filtrando body e duplicatas consecutivas. */
  visited(): (string | null)[];
  /** Asserta a sequência de focáveis visitados. Em falha, joga com trilha formatada. */
  assertVisited(expected: (string | null)[]): void;
  /** Anexa a trilha ao `testInfo` (JSON + tabela texto). Sempre seguro chamar em `finally`. */
  attach(testInfo: TestInfo): Promise<void>;
  /** Acesso somente-leitura à trilha bruta (útil para asserts customizados). */
  readonly steps: readonly TabStep[];
}

export function createTabTrail(): TabTrail {
  const steps: TabStep[] = [];

  const record = async (
    page: Page,
    key: TabKey,
    opts: RecordOptions | undefined,
  ): Promise<TabStep> => {
    if (key === 'Tab' || key === 'Shift+Tab') {
      await page.keyboard.press(key);
    }
    const state = await readActiveState(page);
    const step: TabStep = {
      index: steps.length,
      key,
      expectedTestId: opts?.expected ?? null,
      ...state,
    };
    steps.push(step);
    return step;
  };

  const visited = (): (string | null)[] => {
    const out: (string | null)[] = [];
    for (const s of steps) {
      if (s.key === 'INIT') continue;
      if (out.length && out[out.length - 1] === s.activeTestId) continue;
      out.push(s.activeTestId);
    }
    return out;
  };

  return {
    steps,
    init: (page, opts) => record(page, 'INIT', opts),
    tab: (page, opts) => record(page, 'Tab', opts),
    shiftTab: (page, opts) => record(page, 'Shift+Tab', opts),
    visited,
    assertVisited(expected) {
      // Filtra passagens por body (activeTestId === null) — o navegador pode
      // atravessar `document.body` na fronteira do documento; o contrato do
      // teste é sobre focáveis reais visitados.
      const actual = visited().filter((id): id is string => id !== null);
      const same =
        actual.length === expected.length &&
        actual.every((v, i) => v === expected[i]);
      if (same) return;
      const table = formatTrail(steps);
      throw new Error(
        [
          'assertVisited: sequência de focáveis divergente.',
          `  esperado: ${JSON.stringify(expected)}`,
          `  atual:    ${JSON.stringify(actual)}`,
          '',
          'Trilha completa (activeElement por passo):',
          table,
        ].join('\n'),
      );
    },
    async attach(testInfo) {
      const table = formatTrail(steps);
      await testInfo.attach('tab-trail.json', {
        body: JSON.stringify(steps, null, 2),
        contentType: 'application/json',
      });
      await testInfo.attach('tab-trail.txt', {
        body: table,
        contentType: 'text/plain',
      });
    },
  };
}
