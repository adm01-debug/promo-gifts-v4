import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXTERNAL_SUPABASE_URL;
const supabaseKey = process.env.EXTERNAL_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function resetAttempts() {
  const ip = '138.255.213.165';
  console.log(`Resetting attempts for IP ${ip} in external project ${supabaseUrl}`);
  
  const { error: deleteError } = await supabase
    .from('login_attempts')
    .delete()
    .eq('ip_address', ip);
    
  if (deleteError) {
    console.error('Error resetting login_attempts:', deleteError);
  } else {
    console.log('Successfully cleared login_attempts for IP');
  }

  // Also try auth_login_attempts
  const { error: authDeleteError } = await supabase
    .from('auth_login_attempts')
    .delete()
    .eq('ip_address', ip);
    
  if (authDeleteError) {
    console.warn('Error resetting auth_login_attempts (might not exist):', authDeleteError.message);
  } else {
    console.log('Successfully cleared auth_login_attempts for IP');
  }
}

resetAttempts();
