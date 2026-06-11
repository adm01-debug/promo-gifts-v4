import { createClient } from '@supabase/supabase-js';
import type { Database } from "./types";

import { createClientLogger } from '@/lib/telemetry/structuredLogger';

const log = createClientLogger('supabase.client');

// SSOT: O projeto canônico do app é doufsxqlfjyuvxuezpln (camada Gold/Medallion:
// v_products_public, v_variant_sale_prices_public, v_product_images_cdn etc.,
// e alvo das migrations em supabase/config.toml).
// HOTFIX 2026-06-11 (INCIDENTE 401): commits de 2026-06-10 trocaram o SSOT para
// pqpdolkaeqlyzpdpbizo (projeto Lovable Cloud, sem catálogo). Com a env do Vercel
// apontando para doufsxq, validateEnv() rejeitava a env e forçava URL pqpdo com a
// key do doufsxq → 401 "Invalid API key" em TODAS as chamadas de produção.
const CURRENT_PROJECT_ID = "doufsxqlfjyuvxuezpln";
const CANONICAL_URL = `https://${CURRENT_PROJECT_ID}.supabase.co`;
const CANONICAL_ANON_KEY =
  "sb_publishable_tjH5qAbZ0e5HTTd872NijQ_s9m6JvYU";

const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const envKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

// Validate that VITE_SUPABASE_URL, if set, points to the correct project.
// Localhost and placeholders are tolerated (dev/CI without secrets).
// Returns true when the URL is usable, false when it must be rejected.
const validateEnv = (): boolean => {
  if (!envUrl) {
    log.warn('missing_env_url', { fallback: CURRENT_PROJECT_ID });
    return true;
  }
  const isLocal = envUrl.includes('localhost') || envUrl.includes('127.0.0.1');
  const isPlaceholder = envUrl.includes('placeholder');
  if (!isLocal && !isPlaceholder && !envUrl.includes(CURRENT_PROJECT_ID)) {
    log.error('config_inconsistency', { envUrl, expected: CURRENT_PROJECT_ID });
    if (import.meta.env.DEV) {
      console.error(
        "%c[Supabase Critical]",
        "color: red; font-weight: bold;",
        `VITE_SUPABASE_URL aponta para projeto externo (${envUrl}). Usando fallback ${CANONICAL_URL}.`,
      );
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
  has_custom_env: !!envUrl 
});


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
});

// Logs e Métricas de Autenticação
const authLog = log.child('auth');

// Hook para monitorar estado da sessão e identificar conexão com projeto errado
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
