import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXTERNAL_SUPABASE_URL;
const supabaseKey = process.env.EXTERNAL_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function checkRoles() {
  const userId = '75921d8b-611f-4413-9ce5-afccdb733d26';
  console.log(`Checking roles for ${userId} in external project ${supabaseUrl}`);
  
  const { data: roles, error: rolesError } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', userId);
    
  if (rolesError) {
    console.error('Error fetching roles:', rolesError);
  } else {
    console.log('Roles found:', roles);
  }
}

checkRoles();
