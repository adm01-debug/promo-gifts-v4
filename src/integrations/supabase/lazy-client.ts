import type { supabase as supabaseClient } from '@/integrations/supabase/client';

export type SupabaseClient = typeof supabaseClient;

let clientPromise: Promise<SupabaseClient> | null = null;

export function getSupabaseClient(): Promise<SupabaseClient> {
  clientPromise ??= import('@/integrations/supabase/client').then((m) => m.supabase);
  return clientPromise;
}
