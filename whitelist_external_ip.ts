import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXTERNAL_SUPABASE_URL;
const supabaseKey = process.env.EXTERNAL_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function whitelistIP() {
  const ip = '138.255.213.165';
  console.log(`Whitelisting IP ${ip} in external project ${supabaseUrl}`);
  
  const { data, error } = await supabase
    .from('ip_access_control')
    .insert([
      { 
        ip_address: ip, 
        list_type: 'allow', 
        reason: 'Liberacao Manual (Solicitacao Usuario)',
        metadata: { agent: 'Lovable', timestamp: new Date().toISOString() }
      }
    ]);
    
  if (error) {
    console.error('Error inserting into ip_access_control:', error);
  } else {
    console.log('Successfully whitelisted IP:', data);
  }
}

whitelistIP();
