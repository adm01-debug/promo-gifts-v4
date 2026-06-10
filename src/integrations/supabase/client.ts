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

// Validação de boot: garante que não estamos conectando ao projeto errado ou sem config.
const validateEnv = () => {
  if (envUrl && !envUrl.includes(CURRENT_PROJECT_ID)) {
    const errorMsg = `Inconsistência de Configuração: VITE_SUPABASE_URL aponta para projeto externo (${envUrl}), mas o projeto atual é ${CURRENT_PROJECT_ID}.`;
    log.error('config_inconsistency', { envUrl, expected: CURRENT_PROJECT_ID });
    throw new Error(errorMsg);
  }
  
  if (!envUrl) {
    log.warn('missing_env_url', { fallback: CURRENT_PROJECT_ID });
  }
};

try {
  validateEnv();
} catch (err) {
  // Fail loud in dev/CI, but allow fallback in prod if strictly necessary (or handle via UI)
  if (import.meta.env.DEV) {
    console.error("%c[Supabase Critical]", "color: red; font-weight: bold;", err);
  }
}

export const SUPABASE_URL = envUrl || CANONICAL_URL;
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
