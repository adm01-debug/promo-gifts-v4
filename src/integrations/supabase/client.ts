import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// The project currently uses an external Supabase instance as primary.
// These values are either provided via Vite environment variables or fallback to the managed project.
const SUPABASE_URL = import.meta.env.VITE_EXTERNAL_SUPABASE_URL || 'https://doufsxqlfjyuvxuezpln.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_EXTERNAL_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

console.log('Initializing Supabase client with URL:', SUPABASE_URL);

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});