import { defineConfig, type UserConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'
import { componentTagger } from "lovable-tagger";
import { visualizer } from "rollup-plugin-visualizer";

/**
 * Vite Configuration - Production Ready
 */
export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';
  const uploadSourcemaps = isProd && !!process.env.SENTRY_AUTH_TOKEN;

  const config: UserConfig = {
    plugins: [
      react(),
      mode === 'development' && componentTagger(),
      isProd && visualizer({
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
          manualChunks(id: string) {
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
              return 'react-vendor';
            }
            if (id.includes('node_modules/react-router')) {
              return 'router-vendor';
            }
            if (id.includes('node_modules/@radix-ui/')) {
              return 'ui-vendor';
            }
            if (id.includes('node_modules/@tanstack/')) {
              return 'query-vendor';
            }
            if (id.includes('node_modules/@supabase/')) {
              return 'supabase-vendor';
            }
            if (id.includes('node_modules/framer-motion/')) {
              return 'motion-vendor';
            }
            if (id.includes('node_modules/date-fns/')) {
              return 'date-vendor';
            }
            if (id.includes('node_modules/recharts/') || id.includes('node_modules/d3-')) {
              return 'charts-vendor';
            }
            if (id.includes('node_modules/lucide-react/')) {
              return 'icons-vendor';
            }
            if (id.includes('node_modules/zod/')) {
              return 'zod-vendor';
            }
            if (id.includes('node_modules/react-hook-form/') || id.includes('node_modules/@hookform/')) {
              return 'form-vendor';
            }
            if (id.includes('node_modules/sonner/')) {
              return 'toast-vendor';
            }
            if (id.includes('node_modules/jspdf') || id.includes('node_modules/html2canvas')) {
              return 'export-vendor';
            }
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

  return config;
});