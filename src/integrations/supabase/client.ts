import { createClient } from '@supabase/supabase-js';
import type { Database } from "./types";

// SSOT: O projeto canônico do app é doufsxqlfjyuvxuezpln.
// O .env é auto-gerado pelo Lovable e pode apontar para um projeto Lovable Cloud
// vazio (ex.: pqpdolkaeqlyzpdpbizo). Por isso, o canônico SEMPRE vence em produção
// e qualquer override de env só é aceito se NÃO for um dos projetos proibidos.
const CANONICAL_URL = "https://doufsxqlfjyuvxuezpln.supabase.co";
const CANONICAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvdWZzeHFsZmp5dXZ4dWV6cGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczODY2NDMsImV4cCI6MjA4Mjk2MjY0M30.nm3WMOBSx5SUnIBmvF_Mj0Y-4hV6UohrBF0sUpuQvPc";

const FORBIDDEN_REFS = ["pqpdolkaeqlyzpdpbizo", "hncgwjbzdajfdgtqgefe"];

const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const envKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

const envPointsToForbidden = !!envUrl && FORBIDDEN_REFS.some((ref) => envUrl.includes(ref));

export const SUPABASE_URL = envPointsToForbidden || !envUrl ? CANONICAL_URL : envUrl;
export const SUPABASE_PUBLISHABLE_KEY =
  envPointsToForbidden || !envKey ? CANONICAL_ANON_KEY : envKey;

if (envPointsToForbidden && typeof console !== "undefined") {
  console.warn(
    `[supabase/client] VITE_SUPABASE_URL aponta para projeto proibido (${envUrl}). ` +
      "Forçando uso do banco canônico doufsxqlfjyuvxuezpln."
  );
} else if (!envUrl && typeof console !== "undefined") {
  console.warn(
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
