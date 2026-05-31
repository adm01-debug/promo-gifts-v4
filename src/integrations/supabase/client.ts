import { createClient } from '@supabase/supabase-js';
import type { Database } from "./types";

const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const envKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

// SSOT: o banco canônico do app é SEMPRE doufsxqlfjyuvxuezpln.
// O .env é auto-gerado pelo Lovable Cloud e pode apontar para outro
// projeto (ex: pqpdolkaeqlyzpdpbizo) que NÃO contém os dados reais.
// Por isso fixamos a conexão e só aceitamos env se bater com o canônico.
// Forçamos o uso do projeto canônico doufsxqlfjyuvxuezpln como SSOT.
// Isso garante que mesmo que o .env seja sobrescrito, o app continue funcionando.
const CANONICAL_URL = "https://doufsxqlfjyuvxuezpln.supabase.co";
const CANONICAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvdWZzeHFsZmp5dXZ4dWV6cGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczODY2NDMsImV4cCI6MjA4Mjk2MjY0M30.nm3WMOBSx5SUnIBmvF_Mj0Y-4hV6UohrBF0sUpuQvPc";

const envMatchesCanonical = !!envUrl && envUrl.includes("doufsxqlfjyuvxuezpln");

export const SUPABASE_URL = envMatchesCanonical ? (envUrl as string) : CANONICAL_URL;
export const SUPABASE_PUBLISHABLE_KEY = envMatchesCanonical && envKey ? envKey : CANONICAL_ANON_KEY;

if (!envMatchesCanonical && typeof console !== "undefined") {
  console.warn(
    "[supabase/client] .env aponta para projeto não-canônico — usando banco canônico doufsxqlfjyuvxuezpln (SSOT do app)."
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
