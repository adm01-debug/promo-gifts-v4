import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Primary Supabase client (Lovable Managed Project).
// Handles Auth, Edge Functions, and internal storage.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Secondary config for the external project (used by bridge/test pages).
export const EXTERNAL_SUPABASE_URL = import.meta.env.VITE_EXTERNAL_SUPABASE_URL || 'https://doufsxqlfjyuvxuezpln.supabase.co';
export const EXTERNAL_SUPABASE_ANON_KEY = import.meta.env.VITE_EXTERNAL_SUPABASE_ANON_KEY;

console.log('Initializing primary Supabase client:', SUPABASE_URL);

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});