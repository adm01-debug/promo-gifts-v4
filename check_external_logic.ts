import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXTERNAL_SUPABASE_URL;
const supabaseKey = process.env.EXTERNAL_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function checkTriggers() {
  console.log(`Checking triggers and functions in external project ${supabaseUrl}`);
  
  // We can't query pg_trigger via PostgREST easily. 
  // Let's try to see if there's an 'ip_access_control' check being performed by a RPC.
  
  // Let's try to find any function names
  const { data: functions, error } = await supabase.rpc('get_service_health').catch(() => ({ data: null, error: 'RPC failed' }));
  console.log('Service health:', functions || error);

  // Let's try a generic approach to see if there are custom functions
  // Actually, I'll just check if there is an 'ip_access_control' table and its policies.
}

checkTriggers();
