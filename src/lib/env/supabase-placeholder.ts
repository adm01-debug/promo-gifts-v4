export function isSupabaseLighthousePlaceholder(): boolean {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';

  return (
    supabaseUrl.includes('placeholder.supabase.co') ||
    publishableKey === 'lighthouse-placeholder-key'
  );
}
