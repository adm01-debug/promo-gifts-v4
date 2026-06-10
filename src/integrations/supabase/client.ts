import { createClient } from '@supabase/supabase-js';
import type { Database } from "./types";

// SSOT: O projeto canônico do app é doufsxqlfjyuvxuezpln.
// Em produção, se o .env não estiver configurado ou apontar para projetos 
// conhecidos como "vazios", usamos o canônico como fallback.
const CANONICAL_URL = "https://doufsxqlfjyuvxuezpln.supabase.co";
const CANONICAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvdWZzeHFsZmp5dXZ4dWV6cGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczODY2NDMsImV4cCI6MjA4Mjk2MjY0M30.nm3WMOBSx5SUnIBmvF_Mj0Y-4hV6UohrBF0sUpuQvPc";

const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const envKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

// Usamos o .env se disponível, caso contrário usamos o canônico.
// Removemos a lógica de "FORBIDDEN_REFS" que bloqueava o próprio projeto atual.
export const SUPABASE_URL = envUrl || CANONICAL_URL;
export const SUPABASE_PUBLISHABLE_KEY = envKey || CANONICAL_ANON_KEY;

if (!envUrl && typeof console !== "undefined") {
  console.info(
    "[supabase/client] VITE_SUPABASE_URL não encontrada - usando banco canônico doufsxqlfjyuvxuezpln."
  );
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
});
