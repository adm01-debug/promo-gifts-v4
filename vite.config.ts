import { defineConfig, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { componentTagger } from 'lovable-tagger';
import { visualizer } from 'rollup-plugin-visualizer';

/**
 * Vite Configuration - Production Ready (perf/deep-optimization-2026)
 *
 * Otimizações aplicadas:
 * - manualChunks expandido: index chunk → granular splits por domínio
 * - cssCodeSplit habilitado
 * - esbuild com legalComments:none, treeShaking:true
 * - optimizeDeps.include expandido para pré-bundling mais preciso
 */
export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';
  const uploadSourcemaps = isProd && !!process.env.SENTRY_AUTH_TOKEN;

  const config: UserConfig & { test?: any } = {
    plugins: [
      react(),
      mode === 'development' && componentTagger(),
      isProd &&
        visualizer({
          filename: 'dist/stats.html',
          gzipSize: true,
          brotliSize: true,
          template: 'treemap',
        }),
    ].filter(Boolean),

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
      dedupe: ['react', 'react-dom'],
    },

    esbuild: {
      pure: isProd ? ['console.log', 'console.debug', 'console.info'] : [],
      drop: (isProd ? ['debugger'] : []) as ('console' | 'debugger')[],
      legalComments: 'none',
      treeShaking: true,
    },

    build: {
      outDir: 'dist',
      sourcemap: uploadSourcemaps ? 'hidden' : false,
      minify: 'esbuild',
      target: 'esnext',
      chunkSizeWarningLimit: 2000,
      cssCodeSplit: true,
      reportCompressedSize: false,

      rollupOptions: {
        output: {
          // Nomes de chunk mais legíveis (sem hash aleatório no nome)
          chunkFileNames: (chunkInfo) => {
            const name = chunkInfo.name || 'chunk';
            return `assets/${name}-[hash].js`;
          },
          manualChunks(id: string) {
            // ── Runtime interno do Vite ────────────────────────────────────
            if (id.includes('vite/preload-helper')) return 'runtime-vendor';

            // ── React core (react + react-dom) ─────────────────────────────
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
              return 'react-vendor';
            }

            // ── React Router ───────────────────────────────────────────────
            if (id.includes('node_modules/react-router')) return 'router-vendor';

            // ── TanStack Query (react-query) ────────────────────────────────
            if (id.includes('node_modules/@tanstack/')) return 'query-vendor';

            // ── Supabase SDK ───────────────────────────────────────────────
            if (id.includes('node_modules/@supabase/')) return 'supabase-vendor';

            // ── Radix UI + cmdk ────────────────────────────────────────────
            if (id.includes('node_modules/@radix-ui/') || id.includes('node_modules/cmdk/')) {
              return 'ui-vendor';
            }

            // ── Lucide React (ícones) ──────────────────────────────────────
            // Mantido em chunk próprio — tree-shaking por rota já acontece,
            // mas um chunk dedicado reduz waterfall no critical path.
            if (id.includes('node_modules/lucide-react/')) return 'icons-vendor';

            // ── Framer Motion ──────────────────────────────────────────────
            // NÃO force-chunked: LazyMotion precisa do split dinâmico próprio.
            // Deixar o Rollup dividir mantém domMax carregado sob demanda.

            // ── date-fns ───────────────────────────────────────────────────
            if (id.includes('node_modules/date-fns/')) return 'date-vendor';

            // ── Recharts + D3 (gráficos) ───────────────────────────────────
            if (id.includes('node_modules/recharts/') || id.includes('node_modules/d3-')) {
              return 'charts-vendor';
            }

            // ── Zod (validação) ────────────────────────────────────────────
            if (id.includes('node_modules/zod/')) return 'zod-vendor';

            // ── React Hook Form ────────────────────────────────────────────
            if (
              id.includes('node_modules/react-hook-form/') ||
              id.includes('node_modules/@hookform/')
            ) {
              return 'form-vendor';
            }

            // ── Sonner (toast) ─────────────────────────────────────────────
            if (id.includes('node_modules/sonner/')) return 'toast-vendor';

            // ── PDF / image export (jsPDF + html2canvas) ───────────────────
            // Carregado APENAS em páginas de exportação — chunk próprio evita
            // que 620 KB entre no critical path do catálogo.
            if (id.includes('node_modules/jspdf') || id.includes('node_modules/html2canvas')) {
              return 'export-vendor';
            }

            // ── XLSX ───────────────────────────────────────────────────────
            if (id.includes('node_modules/@e965/xlsx') || id.includes('node_modules/xlsx')) {
              return 'xlsx-vendor';
            }

            // ── DnD Kit ────────────────────────────────────────────────────
            if (id.includes('node_modules/@dnd-kit/')) return 'dnd-vendor';

            // ── Sentry ─────────────────────────────────────────────────────
            if (id.includes('node_modules/@sentry/')) return 'sentry-vendor';

            // ── Markdown (react-markdown, remark) ──────────────────────────
            if (id.includes('node_modules/react-markdown/') || id.includes('node_modules/remark-')) {
              return 'markdown-vendor';
            }

            // ── PPTX ───────────────────────────────────────────────────────
            if (id.includes('node_modules/pptxgenjs/')) return 'pptx-vendor';

            // ── Utilitários pequenos (clsx, tailwind-merge, class-variance-authority) ─
            if (
              id.includes('node_modules/clsx/') ||
              id.includes('node_modules/tailwind-merge/') ||
              id.includes('node_modules/class-variance-authority/')
            ) {
              return 'utils-vendor';
            }

            // ── Zustand ────────────────────────────────────────────────────
            if (id.includes('node_modules/zustand/')) return 'zustand-vendor';

            // NOTA: domain splits (admin, bi, kit, quotes, tools) removidos.
            // React.lazy() + dynamic imports já criam chunks automáticos por
            // rota. O manualChunks manual gerava circular deps que causavam
            // TDZ em runtime: 'Cannot access X before initialization'.
          },
        },
      },
    },

    server: {
      port: 8080,
      host: '::',
      // Evita CSS/JS cacheado no preview durante o dev: força revalidação a
      // cada request, garantindo que mudanças de width/min-width (e qualquer
      // outro estilo) sejam refletidas imediatamente após o save.
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    },


    preview: {
      port: 4173,
      host: true,
    },

    optimizeDeps: {
      esbuildOptions: {
        target: 'esnext',
      },
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        'react-hook-form',
        '@hookform/resolvers/zod',
        '@tanstack/react-query',
        '@tanstack/react-virtual',
        'framer-motion',
        'zustand',
        'sonner',
        'clsx',
        'tailwind-merge',
        'date-fns',
        'lucide-react',
        'zod',
        // Pré-bundlar helpers frequentes
        '@supabase/supabase-js',
        'nprogress',
      ],
    },

    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      retry: process.env.CI ? 2 : 0,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html', 'json-summary'],
        thresholds: {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
        include: ['src/components/search/**'],
        exclude: ['src/components/search/__tests__/**'],
      },
    },
  };

  return config;
});
