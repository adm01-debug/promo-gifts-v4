import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXTERNAL_SUPABASE_URL;
const supabaseKey = process.env.EXTERNAL_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function checkLoginAttempts() {
  console.log(`Checking login_attempts in external project ${supabaseUrl}`);
  
  const { data: attempts, error: attemptsError } = await supabase
    .from('login_attempts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (attemptsError) {
    console.error('Error fetching login_attempts:', attemptsError);
  } else {
    console.log('Recent login_attempts:', attempts);
  }
}

checkLoginAttempts();
