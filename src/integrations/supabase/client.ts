import { createClient } from '@supabase/supabase-js';
import type { Database } from "./types";

import { createClientLogger } from '@/lib/telemetry/structuredLogger';

const log = createClientLogger('supabase.client');

// SSOT: O projeto atual do app é pqpdolkaeqlyzpdpbizo.
// Em produção ou CI, as variáveis de ambiente devem estar configuradas.
const CURRENT_PROJECT_ID = "pqpdolkaeqlyzpdpbizo";
const CANONICAL_URL = `https://${CURRENT_PROJECT_ID}.supabase.co`;
const CANONICAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxcGRvbGthZXFseXpwZHBiaXpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NzEwNTcsImV4cCI6MjA5NDQ0NzA1N30.j9Kk_nu8J5OUn3pcDmRETLMwkhddXmtiSjgI-KCEnrc";

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
export const SUPABASE_PUBLISHABLE_KEY = envKey || CANONICAL_ANON_KEY;

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

