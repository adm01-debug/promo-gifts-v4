import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXTERNAL_SUPABASE_URL;
const supabaseKey = process.env.EXTERNAL_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function checkUser() {
  const email = 'adm01@promobrindes.com.br';
  console.log(`Checking user ${email} in external project ${supabaseUrl}`);
  
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .single();
    
  if (profileError) {
    console.error('Error fetching profile:', profileError);
  } else {
    console.log('Profile found:', profile);
  }

  // Check auth user status if possible (service role can do this)
  const { data: authUser, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) {
    console.error('Error listing auth users:', authError);
  } else {
    const user = authUser.users.find(u => u.email === email);
    console.log('Auth user status:', user ? { 
      id: user.id, 
      email_confirmed: !!user.email_confirmed_at,
      last_sign_in: user.last_sign_in_at,
      banned: !!user.banned_until,
      confirmed: !!user.confirmed_at
    } : 'User not found in Auth');
  }
}

checkUser();
