import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'
import { componentTagger } from "lovable-tagger";
import { visualizer } from "rollup-plugin-visualizer";

/**
 * Vite Configuration - Production Ready
 * 
 * @see https://vitejs.dev/config/
 */
export default defineConfig(({ mode }: { mode: string }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  // O usuário deseja usar o Supabase Externo como o backend principal do sistema.
  // Resolvemos as URLs e Chaves priorizando as externas para que o Auth e Functions 
  // ocorram no projeto de destino (doufsxqlfjyuvxuezpln).
  const externalSupabaseUrl = env.VITE_EXTERNAL_SUPABASE_URL || env.EXTERNAL_SUPABASE_URL || 'https://doufsxqlfjyuvxuezpln.supabase.co';
  const externalSupabaseAnonKey = env.VITE_EXTERNAL_SUPABASE_ANON_KEY || env.EXTERNAL_SUPABASE_ANON_KEY;

  const resolvedSupabaseUrl = externalSupabaseUrl;
  const resolvedSupabaseAnonKey = externalSupabaseAnonKey || env.VITE_SUPABASE_PUBLISHABLE_KEY;



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
  ].filter(Boolean),
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  
  esbuild: {
    // Strip console.log/debug/info in production but PRESERVE console.warn/error for diagnostics.
    // `drop: ['console']` removes ALL console methods (including error/warn) — use `pure` instead
    // to drop only specific methods. See B-1.1 in docs/hardening/AUDITORIA-PROFUNDA-PROMOGIFTS-PRE-PROD.md
    pure: mode === 'production' ? ['console.log', 'console.debug', 'console.info'] : [],
    drop: (mode === 'production' ? ['debugger'] : []) as ('console' | 'debugger')[],
  },
  
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild' as const,
    target: 'esnext',
    chunkSizeWarningLimit: 2000,
    
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
    include: ['react', 'react-dom', 'react-router-dom'],
  },
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(resolvedSupabaseUrl),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(resolvedSupabaseAnonKey),
    'import.meta.env.VITE_EXTERNAL_SUPABASE_URL': JSON.stringify(externalSupabaseUrl),
    'import.meta.env.VITE_EXTERNAL_SUPABASE_ANON_KEY': JSON.stringify(externalSupabaseAnonKey),
  },
  }
})
