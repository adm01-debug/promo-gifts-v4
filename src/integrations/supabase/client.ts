import { createClient } from '@supabase/supabase-js';
import type { Database } from "./types";
import { createClientLogger } from '@/lib/telemetry/structuredLogger';

const log = createClientLogger('supabase.client');

// Projeto canônico doufsxqlfjyuvxuezpln
const CURRENT_PROJECT_ID = "doufsxqlfjyuvxuezpln";

const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const envKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

export const SUPABASE_URL = envUrl || `https://${CURRENT_PROJECT_ID}.supabase.co`;
export const SUPABASE_PUBLISHABLE_KEY = envKey || '';

log.info('init', { 
  url: SUPABASE_URL, 
  project_id: SUPABASE_URL.split('.')[0].split('//')[1],
  has_custom_env: !!envUrl,
  is_canonical: SUPABASE_URL.includes(CURRENT_PROJECT_ID)
});

// Debug flag for E2E tests
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__SUPABASE_CLIENT_DEBUG__ = {
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
      // Force logging of all Supabase requests in DEV
      const isDev = import.meta.env.DEV;
      if (isDev) {
        console.groupCollapsed(`%c[Supabase Request] ${options?.method || 'GET'} ${url}`, 'color: #3ecf8e; font-weight: bold;');
        console.log('Options:', options);
        console.groupEnd();
      }

      try {
        const response = await fetch(url, options);
        
        if (isDev) {
          console.groupCollapsed(`%c[Supabase Response] ${response.status} ${url}`, response.ok ? 'color: #3ecf8e;' : 'color: #f87171;');
          console.log('Status:', response.status);
          try {
             const clone = response.clone();
             const text = await clone.text();
             console.log('Body:', text.substring(0, 1000));
          } catch(e) { /* ignore */ }
          console.groupEnd();
        }

        if (response.status === 401) {
          const body = await response.clone().json().catch(() => ({}));
          const isInvalidKey = body.code === 'UNAUTHORIZED_LEGACY_JWT' || 
                             body.message?.includes('Invalid JWT') || 
                             body.message?.includes('Invalid API key');
                             
          if (isInvalidKey) {
            const projectId = SUPABASE_URL.split('.')[0].split('//')[1];
            log.error('auth_401_detected', {
              url,
              status: response.status,
              body,
              project_id: projectId,
              is_canonical: projectId === CURRENT_PROJECT_ID
            });
            
            if (projectId !== CURRENT_PROJECT_ID && !projectId.includes('localhost')) {
              console.error(`[Supabase Critical] 401 Unauthorized on project ${projectId}. Current configuration might be invalid.`);
            }
          }
        }
        return response;
      } catch (error) {
        log.error('request_failed', { error });
        throw error;
      }
    }
  }
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
