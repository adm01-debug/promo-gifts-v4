import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXTERNAL_SUPABASE_URL;
const supabaseKey = process.env.EXTERNAL_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing external Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkExternal() {
  console.log('Querying external project:', supabaseUrl);
  
  const { data: ipData, error: ipError } = await supabase
    .from('ip_access_control')
    .select('*')
    .eq('ip_address', '138.255.213.165');
    
  if (ipError) {
    console.error('Error querying ip_access_control:', ipError);
  } else {
    console.log('IP Access Control for 138.255.213.165:', ipData);
  }

  const { data: settingsData, error: settingsError } = await supabase
    .from('access_security_settings')
    .select('*')
    .limit(1);
    
  if (settingsError) {
    console.error('Error querying access_security_settings:', settingsError);
  } else {
    console.log('Access Security Settings:', settingsData);
  }
  
  const { data: attemptsData, error: attemptsError } = await supabase
    .from('auth_login_attempts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (attemptsError) {
    console.error('Error querying auth_login_attempts:', attemptsError);
  } else {
    console.log('Recent auth_login_attempts:', attemptsData);
  }
}

checkExternal();
