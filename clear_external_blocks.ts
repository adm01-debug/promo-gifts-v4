import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXTERNAL_SUPABASE_URL;
const supabaseKey = process.env.EXTERNAL_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function clearBlocks() {
  const ip = '138.255.213.165';
  console.log(`Clearing blocks for IP ${ip} in external project ${supabaseUrl}`);
  
  // Try to find rate limit tables
  const { data: tables, error: tablesError } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public');
    
  if (tablesError) {
    console.error('Error listing tables:', tablesError);
  } else {
    const tableNames = (tables as any[]).map(t => t.table_name);
    console.log('Public tables:', tableNames);
    
    if (tableNames.includes('edge_rate_limits')) {
      const { error } = await supabase.from('edge_rate_limits').delete().eq('identifier', ip);
      console.log('Deleted from edge_rate_limits:', error ? error.message : 'OK');
    }
    
    if (tableNames.includes('request_rate_limits')) {
      const { error } = await supabase.from('request_rate_limits').delete().eq('ip_address', ip);
      console.log('Deleted from request_rate_limits:', error ? error.message : 'OK');
    }
  }
}

clearBlocks();
