import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

// TZ-fix (nível de processo): precisa estar setado ANTES dos workers nascerem
// para o ICU/Date.toLocaleString resolverem America/Sao_Paulo. test.env é tarde
// demais (ICU cacheia o TZ no startup). Snapshots com "Hora local" dependem disso.
process.env.TZ = 'America/Sao_Paulo';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // TZ-fix: vitest passa env aos workers no spawn. Setar em setup.ts é
    // TARDE DEMAIS — Date.prototype.toLocaleString cacheia TZ na startup
    // do worker. CI (Ubuntu UTC) e dev (VPS BRT) geram snapshots divergentes
    // sem isso. Snapshot file mantém timestamps em America/Sao_Paulo.
    env: { TZ: 'America/Sao_Paulo' },
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts', './tests/setup-ref-warning-capture.ts'],
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}', 'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}', 'e2e/scripts/__tests__/*.test.ts'],
    typecheck: {
      enabled: false,
    },
    // 'tests/e2e/**' excluído: contém testes Playwright (imports @playwright/test)
    // que vitest tenta carregar e trava workers em deadlock. Playwright config
    // usa testDir: './e2e' (não 'tests/e2e'), então esses 8 arquivos estavam
    // órfãos. Ver fix(test): unblock vitest hang in CI.
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache', 'tests/e2e/**'],
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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
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
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
