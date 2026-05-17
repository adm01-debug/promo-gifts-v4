import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// O sistema está configurado para usar o Supabase Externo como principal.
// Isso garante que a autenticação e as Edge Functions ocorram no projeto correto.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

console.log('Iniciando cliente Supabase Principal (Externo):', SUPABASE_URL);

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Alias para manter compatibilidade com códigos que buscam EXTERNAL_SUPABASE_*
export const EXTERNAL_SUPABASE_URL = SUPABASE_URL;
export const EXTERNAL_SUPABASE_ANON_KEY = SUPABASE_PUBLISHABLE_KEY;