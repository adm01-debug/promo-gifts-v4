
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXTERNAL_SUPABASE_URL;
const key = process.env.EXTERNAL_SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing EXTERNAL_SUPABASE_URL or EXTERNAL_SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

async function verify() {
  console.log('--- Verification Started ---');
  
  // 1. Check Connection
  const { data: tables, error: tablesError } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
  if (tablesError) {
    console.log('❌ Connection/Table Error:', tablesError.message);
  } else {
    console.log('✅ Connection to external Supabase successful.');
    console.log(`✅ Profiles table exists and has data.`);
  }

  // 2. Check Auth Admin
  const { data: users, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) {
    console.log('❌ Auth Admin Error (check Service Role Key):', authError.message);
  } else {
    console.log(`✅ Auth Admin access successful. Found ${users.users.length} users in external DB.`);
  }

  // 3. Check Storage (Optional - just list buckets)
  const { data: buckets, error: storageError } = await supabase.storage.listBuckets();
  if (storageError) {
    console.log('❌ Storage Error:', storageError.message);
  } else {
    console.log(`✅ Storage access successful. Found ${buckets.length} buckets.`);
    buckets.forEach(b => console.log(`   - ${b.name}`));
  }

  console.log('--- Verification Completed ---');
}

verify();
