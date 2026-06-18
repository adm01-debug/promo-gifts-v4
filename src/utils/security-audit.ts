import { supabase } from '@/integrations/supabase/client';

import { logger } from '@/lib/logger';
export async function checkSecurityDefinerAccess() {
  const { error } = await supabase.rpc('repair_ownership_orphans', { _dry_run: true });

  if (error?.message?.includes('permission denied')) {
    logger.warn(
      '✅ SECURITY DEFINER repair_ownership_orphans access blocked for anon/authenticated (correctly limited to service_role)',
    );
    return true;
  }

  if (error) {
    logger.warn('⚠️ Unexpected error checking SECURITY DEFINER access:', error);
    return false;
  }

  logger.warn(
    '❌ SECURITY DEFINER repair_ownership_orphans executed without permission error. Check grants!',
  );
  return false;
}
