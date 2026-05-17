import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// The project currently uses an external Supabase instance as primary.
// These values are either provided via Vite environment variables or fallback to the managed project.
const SUPABASE_URL = import.meta.env.VITE_EXTERNAL_SUPABASE_URL || 'https://pqpdolkaeqlyzpdpbizo.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_EXTERNAL_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxcGRvbGthZXFseXpwZHBiaXpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NzEwNTcsImV4cCI6MjA5NDQ0NzA1N30.j9Kk_nu8J5OUn3pcDmRETLMwkhddXmtiSjgI-KCEnrc';

console.log('Initializing Supabase client with URL:', SUPABASE_URL);

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});