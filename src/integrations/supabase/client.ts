import { createClient } from '@supabase/supabase-js';
import type { Database } from "./types";

// SSOT: O projeto canônico do app é doufsxqlfjyuvxuezpln.
// O .env é auto-gerado pelo Lovable e pode apontar para um projeto Lovable Cloud
// vazio (ex.: pqpdolkaeqlyzpdpbizo). Por isso, o canônico SEMPRE vence em produção
// e qualquer override de env só é aceito se:
//   (a) aponta explicitamente para o canônico, OU
//   (b) não aponta para nenhum dos projetos proibidos conhecidos.
//
// SECURITY: A CANONICAL_ANON_KEY é pública por design no Supabase (role 'anon').
// No entanto, TODAS as tabelas com dados sensíveis DEVEM ter RLS ativo em
// doufsxqlfjyuvxuezpln. Verificar via:
//   SELECT tablename, rowsecurity FROM pg_tables
//   WHERE schemaname = 'public' AND rowsecurity = false;
// Nenhuma tabela de negócio deve aparecer nessa query sem justificativa documentada.
const CANONICAL_URL = "https://doufsxqlfjyuvxuezpln.supabase.co";
const CANONICAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvdWZzeHFsZmp5dXZ4dWV6cGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczODY2NDMsImV4cCI6MjA4Mjk2MjY0M30.nm3WMOBSx5SUnIBmvF_Mj0Y-4hV6UohrBF0sUpuQvPc";

// Lista de projetos CONHECIDOS que não devem ser usados (Lovable Cloud vazios).
// ATENÇÃO: esta lista é de negação e pode ficar desatualizada se Lovable criar
// novos projetos Cloud. O check positivo abaixo (envPointsToCanonical) é a
// proteção primária — esta lista é defesa em profundidade.
const FORBIDDEN_REFS = ["hncgwjbzdajfdgtqgefe"];

const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const envKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

// Check POSITIVO (primário): o .env já aponta para o projeto correto?
const envPointsToCanonical = !!envUrl && envUrl.includes('doufsxqlfjyuvxuezpln');

// Check NEGATIVO (defesa em profundidade): o .env aponta para um proibido?
const envPointsToForbidden = !!envUrl && !envPointsToCanonical &&
  FORBIDDEN_REFS.some((ref) => envUrl.includes(ref));

// Estratégia de resolução:
// 1. Se .env aponta para o canônico → usa .env (inclui key do .env).
// 2. Se .env aponta para proibido OU .env está vazio → usa canônico hardcoded.
// 3. Se .env aponta para outro desconhecido → usa .env (operador configurou outro projeto).
export const SUPABASE_URL = envPointsToCanonical
  ? envUrl
  : (envPointsToForbidden || !envUrl ? CANONICAL_URL : envUrl);
export const SUPABASE_PUBLISHABLE_KEY = envPointsToCanonical
  ? (envKey ?? CANONICAL_ANON_KEY)
  : (envPointsToForbidden || !envKey ? CANONICAL_ANON_KEY : envKey);

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
