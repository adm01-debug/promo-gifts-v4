import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'
import { componentTagger } from "lovable-tagger";
import { visualizer } from "rollup-plugin-visualizer";

/**
 * Vite Configuration - Production Ready
 * 
 * @see https://vitejs.dev/config/
 */
export default defineConfig(async ({ mode }) => {
  // ── GlitchTip / Sentry — upload de source maps ──────────────────────────────
  // Carregado DINAMICAMENTE e apenas quando SENTRY_AUTH_TOKEN está presente
  // (ativação manual). Sem o token, o @sentry/vite-plugin NÃO é importado: o build
  // de produção fica idêntico ao atual, não vira dependência obrigatória de build
  // e nenhum .map é gerado (zero risco de source map órfão vazar no deploy).
  const uploadSourcemaps = mode === 'production' && !!process.env.SENTRY_AUTH_TOKEN;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sentryPlugins: any[] = [];
  if (uploadSourcemaps) {
    const { sentryVitePlugin } = await import('@sentry/vite-plugin');
    sentryPlugins.push(
      sentryVitePlugin({
        url: process.env.SENTRY_URL || 'https://erros.atomicabr.com.br',
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        telemetry: false, // não enviar telemetria pro sentry.io (usamos GlitchTip)
        release: {
          name:
            process.env.VITE_VERCEL_GIT_COMMIT_SHA ||
            process.env.VERCEL_GIT_COMMIT_SHA ||
            undefined,
        },
        sourcemaps: {
          // sobe os .map pro GlitchTip (debug IDs) e os remove do dist em seguida
          filesToDeleteAfterUpload: ['./dist/**/*.map'],
        },
      })
    );
  }

  return {
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
    mode === 'production' && visualizer({
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
      template: 'treemap',
    }),
    ...sentryPlugins,
  ].filter(Boolean),
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  
  esbuild: {
    pure: mode === 'production' ? ['console.log', 'console.debug', 'console.info'] : [],
    drop: (mode === 'production' ? ['debugger'] : []) as ('console' | 'debugger')[],
    legalComments: 'none' as const,
    treeShaking: true,
  },
  
  build: {
    outDir: 'dist',
    // 'hidden' gera os .map sem expor o comentário sourceMappingURL ao público:
    // o GlitchTip recebe o map (via @sentry/vite-plugin), o navegador do usuário não.
    // Só liga quando o upload também vai rodar (token presente) — senão, 'false'.
    sourcemap: uploadSourcemaps ? 'hidden' : false,
    minify: 'esbuild' as const,
    target: 'esnext',
    chunkSizeWarningLimit: 2000,
    cssCodeSplit: true,
    reportCompressedSize: false,
    
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          // Core React
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/react-router')) {
            return 'router-vendor';
          }
          // UI primitives (Radix)
          if (id.includes('node_modules/@radix-ui/')) {
            return 'ui-vendor';
          }
          // Data fetching
          if (id.includes('node_modules/@tanstack/')) {
            return 'query-vendor';
          }
          // Supabase client
          if (id.includes('node_modules/@supabase/')) {
            return 'supabase-vendor';
          }
          // Animation library — lazy loaded with most pages
          if (id.includes('node_modules/framer-motion/')) {
            return 'motion-vendor';
          }
          // Date utilities
          if (id.includes('node_modules/date-fns/')) {
            return 'date-vendor';
          }
          // Charts - isolate recharts into its own chunk (only loaded by dashboard pages)
          if (id.includes('node_modules/recharts/') || id.includes('node_modules/d3-')) {
            return 'charts-vendor';
          }
          // Icons — chunk único compartilhado entre rotas (cache de longo prazo).
          // 680KB descomprimido / 118KB gzip carregado UMA vez por usuário.
          // Otimização futura: migrar para imports `lucide-react/icons/<Name>`
          // permitiria tree-shaking real por page-chunk.
          if (id.includes('node_modules/lucide-react/')) {
            return 'icons-vendor';
          }
          // Validation
          if (id.includes('node_modules/zod/')) {
            return 'zod-vendor';
          }
          // Form handling
          if (id.includes('node_modules/react-hook-form/') || id.includes('node_modules/@hookform/')) {
            return 'form-vendor';
          }
          // Sonner + toast
          if (id.includes('node_modules/sonner/')) {
            return 'toast-vendor';
          }
          // PDF/Export libs — only loaded on demand
          if (id.includes('node_modules/jspdf') || id.includes('node_modules/html2canvas')) {
            return 'export-vendor';
          }
          // DnD — only used in kit builder / kanban
          if (id.includes('node_modules/@dnd-kit/')) {
            return 'dnd-vendor';
          }
        },
      },
    },
  },
  
  server: {
    port: 8080,
    host: "::",
  },
  
  preview: {
    port: 4173,
    host: true,
  },
  
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'react-hook-form', '@hookform/resolvers/zod'],
  },
  };
})
