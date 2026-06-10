
import { createClientLogger } from './src/lib/telemetry/structuredLogger';

async function runAudit() {
  const log = createClientLogger('audit.automated');
  console.log('--- Starting Authentication & RLS Automated Audit ---');
  
  try {
    // 1. Check if we are running in a browser-like environment
    if (typeof window === 'undefined') {
      console.error('Audit must be run in a browser environment (preview).');
      return;
    }

    const { getSupabaseClient } = await import('./src/integrations/supabase/lazy-client');
    const supabase = await getSupabaseClient();

    // 2. Check Auth Session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error('❌ Failed to get session:', sessionError);
    } else if (!session) {
      console.warn('⚠️ No active session found. Some RLS checks will be limited to "anon" role.');
    } else {
      console.log('✅ Active session found for user:', session.user.id);
    }

    // 3. Test Profile Access (RLS)
    console.log('Testing "profiles" table RLS...');
    const profileId = session?.user?.id;
    if (profileId) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .maybeSingle();

      if (profileError) {
        console.error('❌ Error fetching own profile:', profileError);
      } else if (!profile) {
        console.warn('⚠️ Profile not found for current user. Check if profile was created on signup.');
      } else {
        console.log('✅ Own profile accessible via RLS.');
      }
    }

    // 4. Test User Roles Access (RLS)
    console.log('Testing "user_roles" table RLS...');
    if (profileId) {
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', profileId);

      if (rolesError) {
        console.error('❌ Error fetching own roles:', rolesError);
      } else {
        console.log(`✅ Roles accessible via RLS (Found: ${roles?.length || 0}).`);
      }
    }

    // 5. Test RPC/Security Definer Functions
    console.log('Testing Security Definer functions...');
    const { data: isSupervisor, error: rpcError } = await supabase.rpc('is_supervisor_or_above');
    if (rpcError) {
      console.error('❌ Error calling is_supervisor_or_above:', rpcError);
    } else {
      console.log('✅ is_supervisor_or_above executed correctly. Result:', isSupervisor);
    }

    console.log('--- Audit Complete ---');
    log.info('audit_complete', { success: true });

  } catch (err) {
    console.error('Audit crashed:', err);
    log.error('audit_failed', { error: String(err) });
  }
}

// Execute
runAudit();
