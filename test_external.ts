import { createClient } from 'npm:@supabase/supabase-js'

const supabaseUrl = Deno.env.get('EXTERNAL_SUPABASE_URL')
const supabaseKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing external Supabase credentials')
  Deno.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data, error } = await supabase.from('profiles').select('*').limit(1)
  if (error) {
    console.error('Error fetching from external Supabase:', error.message)
    // If profiles doesn't exist, it might just mean the schema is different
    const { data: tables, error: tableError } = await supabase.rpc('get_tables')
    if (tableError) console.error('Error fetching tables:', tableError.message)
    else console.log('Tables:', tables)
  } else {
    console.log('Successfully connected to external Supabase. Profiles count:', data.length)
  }
}

test()
