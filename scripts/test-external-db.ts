
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXTERNAL_SUPABASE_URL;
const key = process.env.EXTERNAL_SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing EXTERNAL_SUPABASE_URL or EXTERNAL_SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

async function test() {
  const { data, error } = await supabase.from('profiles').select('*').limit(1);
  if (error) {
    console.log('Connection test failed or table profiles does not exist:', error.message);
  } else {
    console.log('Connection successful, found data in profiles.');
  }
}

test();
