import { createClient } from '@supabase/supabase-js';
import type { Database } from "./types";

import { createClientLogger } from '@/lib/telemetry/structuredLogger';

const log = createClientLogger('supabase.client');

// SSOT: O projeto canônico do app é doufsxqlfjyuvxuezpln (camada Gold/Medallion:
// v_products_public, v_variant_sale_prices_public, v_product_images_cdn etc.,
// e alvo das migrations em supabase/config.toml).
//
// ⚠️  ATENÇÃO AO LOVABLE AGENT E AO CLAUDE CODE: NÃO SIMPLIFICAR ESTE ARQUIVO.
// validate-supabase-config.mjs (executado em cada build) requer:
//   content.includes('validateEnv') && content.includes('CURRENT_PROJECT_ID')
// Remover validateEnv() ou CURRENT_PROJECT_ID derruba 100% dos builds da main no Vercel.
//
// URLs PROIBIDAS (Claude Code não deve apontar para estas):
//   - supabase.atomicabr.com.br (self-hosted — não tem o catálogo)
//   - pqpdolkaeqlyzpdpbizo (Lovable Cloud vazio)
//   - hncgwjbzdajfdgtqgefe (Lovable Cloud vazio 2)
const CURRENT_PROJECT_ID = "doufsxqlfjyuvxuezpln";
const CANONICAL_URL = `https://${CURRENT_PROJECT_ID}.supabase.co`;
const CANONICAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvdWZzeHFsZmp5dXZ4dWV6cGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczODY2NDMsImV4cCI6MjA4Mjk2MjY0M30.nm3WMOBSx5SUnIBmvF_Mj0Y-4hV6UohrBF0sUpuQvPc";

const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const envKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

// Validate that VITE_SUPABASE_URL, if set, points to the correct project.
// Localhost, placeholders, and URLs explicitly pointing to the canonical project are OK.
// Self-hosted (atomicabr), other Lovable Cloud projects, etc. are REJECTED.
// Returns true when the URL is usable, false when it must be rejected.
// Dedup: emite no máximo 1 warn por sessão por par (envUrl, expected). Evita
// poluir telemetria quando o módulo é reavaliado (HMR, testes, lazy loaders).
const inconsistencyEmitted = new Set<string>();

const validateEnv = (): boolean => {
  if (!envUrl) {
    log.warn('missing_env_url', { fallback: CURRENT_PROJECT_ID });
    return true;
  }
  const isLocal = envUrl.includes('localhost') || envUrl.includes('127.0.0.1');
  const isPlaceholder = envUrl.includes('placeholder');
  if (!isLocal && !isPlaceholder && !envUrl.includes(CURRENT_PROJECT_ID)) {
    // Severidade: WARN (não ERROR) — o guard SSOT já neutralizou o impacto aplicando
    // o fallback canônico. ERROR ficava ruidoso a cada reload sempre que o Lovable
    // reescrevia o .env, poluindo dashboards de telemetria. Mantemos o nome do evento
    // ("config_inconsistency") para preservar contratos (ssot-fallback.test.ts e
    // alertas externos que filtram por substring).
    const dedupKey = `${envUrl}->${CURRENT_PROJECT_ID}`;
    if (!inconsistencyEmitted.has(dedupKey)) {
      inconsistencyEmitted.add(dedupKey);
      log.warn('config_inconsistency', {
        envUrl,
        expected: CURRENT_PROJECT_ID,
        fallback_applied: CANONICAL_URL,
        severity_note: 'auto_resolved_by_ssot_guard',
      });
      if (import.meta.env.DEV) {
        console.warn(
          "%c[Supabase SSOT]",
          "color: orange; font-weight: bold;",
          `VITE_SUPABASE_URL aponta para projeto externo (${envUrl}). Fallback canônico aplicado: ${CANONICAL_URL}.`,
        );
      }
    }
    return false;
  }
  return true;
};

const envUrlIsValid = validateEnv();

export const SUPABASE_URL = envUrlIsValid ? (envUrl || CANONICAL_URL) : CANONICAL_URL;
// Quando a env URL é rejeitada, a env KEY pertence ao projeto errado e causaria
// "Invalid API key" / 401. Descartar a key também e cair no fallback canônico.
export const SUPABASE_PUBLISHABLE_KEY = envUrlIsValid ? (envKey || CANONICAL_ANON_KEY) : CANONICAL_ANON_KEY;


log.info('init', { 
  url: SUPABASE_URL, 
  project_id: SUPABASE_URL.split('.')[0].split('//')[1],
  has_custom_env: !!envUrl,
  is_canonical: SUPABASE_URL.includes(CURRENT_PROJECT_ID)
});

// Debug flag for E2E tests
type SupabaseClientDebug = {
  url: string;
  projectId: string;
  isCanonical: boolean;
};
if (typeof window !== 'undefined') {
  (window as Window & { __SUPABASE_CLIENT_DEBUG__?: SupabaseClientDebug }).__SUPABASE_CLIENT_DEBUG__ = {
    url: SUPABASE_URL,
    projectId: SUPABASE_URL.split('.')[0].split('//')[1],
    isCanonical: SUPABASE_URL.includes(CURRENT_PROJECT_ID)
  };
}



type SupabaseStorage = {
  getItem: Storage['getItem'];
  setItem: Storage['setItem'];
  removeItem: Storage['removeItem'];
};

const getStorageOrUndefined = (): SupabaseStorage | undefined => {
  if (typeof window === 'undefined' || !window.localStorage) return undefined;
  return window.localStorage;
};

const storage = getStorageOrUndefined();

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage,
    persistSession: Boolean(storage),
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: async (url, options) => {
      try {
        const response = await fetch(url, options);
        if (response.status === 401) {
          const body = await response.clone().json().catch(() => ({}));
          if (body.code === 'UNAUTHORIZED_LEGACY_JWT' || body.message?.includes('Invalid JWT') || body.message?.includes('Invalid API key')) {
            const projectId = SUPABASE_URL.split('.')[0].split('//')[1];
            const isCanonical = projectId === CURRENT_PROJECT_ID;
            const diagnostic = isCanonical
              ? 'JWT/anon key inválida para o projeto canônico — possível rotação de chave. Atualize VITE_SUPABASE_PUBLISHABLE_KEY no painel Lovable.'
              : `Projeto resolvido (${projectId}) ≠ canônico (${CURRENT_PROJECT_ID}). Troque a conexão Supabase no painel Lovable → Cloud para o projeto canônico.`;
            log.error('auth_401_detected', {
              url,
              status: response.status,
              body,
              project_id: projectId,
              is_canonical: isCanonical,
              diagnostic,
              recommendation: 'painel Lovable → Cloud → Database → reconectar projeto canônico',
            });
            if (import.meta.env.DEV) {
              console.error(
                "%c[Supabase 401]",
                "color: red; font-weight: bold;",
                diagnostic,
              );
            }
          }
        }
        return response;
      } catch (error) {
        // BUG-FETCH-WRAPPER-ABORT FIX (2026-06-23):
        // AbortError é cancelamento intencional (React Query, navegação, cleanup de hook).
        // Logar como error polui o console com falsos positivos.
        // A condição cobre: DOMException com name 'AbortError' (fetch nativo) e
        // qualquer Error com name 'AbortError' (axios, supabase-js internals).
        const isAbort =
          error instanceof Error && error.name === 'AbortError';
        if (!isAbort) {
          log.error('request_failed', { error });
        }
        throw error;
      }
    }
  }
});

const authLog = log.child('auth');

supabase.auth.onAuthStateChange((event, session) => {
  const projectId = SUPABASE_URL.split('.')[0].split('//')[1];
  
  authLog.info('state_change', { 
    event, 
    user_id: session?.user?.id,
    project_id: projectId,
    is_canonical: projectId === CURRENT_PROJECT_ID
  });

  const isLocalProject = projectId.includes('localhost') || projectId.includes('127.0.0.1') || projectId === 'placeholder';
  if (!isLocalProject && projectId !== CURRENT_PROJECT_ID) {
    authLog.warn('wrong_project_detected', {
      current: projectId,
      expected: CURRENT_PROJECT_ID
    });
  }
});
