
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, key);

async function listUsers() {
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error('Error listing users:', error.message);
  } else {
    console.log(`Found ${data.users.length} users.`);
    data.users.forEach(u => console.log(`- ${u.email} (${u.id})`));
  }
}

listUsers();
