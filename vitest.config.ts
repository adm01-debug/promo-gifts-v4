import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

/**
 * Plugin Vite: reescreve imports `https://esm.sh/zod@*` (estilo Deno usado
 * pelas Edge Functions) para o bare specifier `zod` (npm) antes de Vitest
 * tentar resolver. Necessário porque o `resolve.alias` do Vitest 4 não aplica
 * para schemes `https:` em arquivos fora de `src/` (regressão em vitest 4.x
 * vs 3.x — `resolve.alias` regex tinha precedência maior antes).
 *
 * Sem este plugin, qualquer teste de contrato que importe
 * `supabase/functions/_shared/contracts/schemas/*.ts` quebra com
 * `ERR_UNSUPPORTED_ESM_URL_SCHEME` no loader nativo de Node.
 */
const rewriteDenoUrlImports = (): Plugin => ({
  name: 'rewrite-deno-url-imports',
  enforce: 'pre',
  transform(code, id) {
    if (!/\.(ts|tsx|mts|js|mjs)$/.test(id)) return null;
    if (!code.includes('https://')) return null;
    const next = code
      .replace(/(["'])https:\/\/esm\.sh\/zod@[^"']+\1/g, '"zod"')
      .replace(/(["'])https:\/\/deno\.land\/x\/zod@[^"']+\/mod\.ts\1/g, '"zod"');
    return next === code ? null : { code: next, map: null };
  },
});

export default defineConfig({
  plugins: [react(), rewriteDenoUrlImports()],
  test: {
    globals: true,
    // TZ-fix: vitest passa env aos workers no spawn. Setar em setup.ts é
    // TARDE DEMAIS — Date.prototype.toLocaleString cacheia TZ na startup
    // do worker. CI (Ubuntu UTC) e dev (VPS BRT) geram snapshots divergentes
    // sem isso. Snapshot file mantém timestamps em America/Sao_Paulo.
    env: { TZ: 'America/Sao_Paulo' },
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts', './tests/setup-ref-warning-capture.ts'],
    include: [
      'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'e2e/scripts/__tests__/*.test.ts',
      // T-FIX-5: descobre a suite vitest do script anti-órfão.
      // Ver docs/redeploy/T-FIX-5-CHECKLIST.md (Passo 3).
      'scripts/__tests__/**/*.{test,spec}.{ts,mts,cts}',
    ],
    typecheck: {
      enabled: false,
    },
    exclude: [
      'node_modules',
      'dist',
      '.idea',
      '.git',
      '.cache',
      'tests/__deprecated__',
      // Specs Playwright (importam `@playwright/test` / fixture `test-base` e usam
      // `test.describe`) ficam sob `tests/` mas NÃO podem ser coletados pelo Vitest
      // — quebram a coleta com "Playwright Test did not expect test.describe() to be
      // called here". Rodam apenas via Playwright. Mantemos os specs Vitest legítimos
      // de `tests/security/` (RLS, seller-scope etc.), excluindo só os Playwright.
      'tests/e2e/**',
      'tests/navigation-tooltips.spec.ts',
      'tests/security/notification-rls.spec.ts',
    ],
    // CI runners (GitHub Actions ubuntu-latest) têm 2 vCPU (4 vThreads).
    // Default thread pool causava timeout de 75min — mitigado com
    // maxThreads: 2 para evitar contenção.
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 2,
        singleThread: false,
      },
    },
    retry: 2,
    // Vitest 4 mudou o pipeline de resolve para deps em outras pastas (fora de
    // `src/`/`tests/`). Os schemas em `supabase/functions/_shared/contracts/`
    // usam `import { z } from "https://esm.sh/zod@..."` (Deno-style) e o alias
    // em `resolve.alias` abaixo só é aplicado se o módulo passar pelo transform
    // do Vite. Forçar inline garante isso quando importados pelo Vitest (Node).
    server: {
      deps: {
        inline: [/supabase\/functions\/_shared\/contracts/],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary', 'clover'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      all: false,
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/test-utils/**',
        'src/**/__mocks__/**',
        'src/**/__tests__/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 50,
        statements: 60,
      },
    },

  },
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      // Edge Functions (Deno) importam Zod via URL esm.sh. Vitest (Node) usa o pacote npm.
      // Aliases permitem que os mesmos arquivos rodem nos dois runtimes sem duplicação.
      // Pattern abrange qualquer pin de versão (3.22.x, 3.23.x, 4.x).
      // Vitest 4: o resolve.alias é aplicado pelo Vite, mas o esbuild de pré-bundling
      // não conhece URLs `https:` — então listamos cada versão usada explicitamente
      // como string match (mais robusto que regex contra módulos não-bundleados).
      { find: 'https://esm.sh/zod@3.23.8', replacement: 'zod' },
      { find: 'https://esm.sh/zod@3.22.4', replacement: 'zod' },
      { find: 'https://esm.sh/zod@3.22.2', replacement: 'zod' },
      { find: /^https:\/\/esm\.sh\/zod@.*$/, replacement: 'zod' },
      { find: /^https:\/\/deno\.land\/x\/zod@.*\/mod\.ts$/, replacement: 'zod' },
    ],
  },
});
