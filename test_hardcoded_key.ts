import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://doufsxqlfjyuvxuezpln.supabase.co";
const hardcodedKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvdWZzeHFsZmp5dXZ4dWV6cGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczODY2NDMsImV4cCI6MjA4Mjk2MjY0M30.nm3WMOBSx5SUnIBmvF_Mj0Y-4hV6UohrBF0sUpuQvPc";

async function testKey() {
  const supabase = createClient(supabaseUrl, hardcodedKey);
  const { data, error } = await supabase.from('profiles').select('id').limit(1);
  
  if (error) {
    console.error('Hardcoded key test failed:', error.message);
    if (error.message.includes('Invalid API key') || error.message.includes('Unauthorized')) {
      return false;
    }
  } else {
    console.log('Hardcoded key test PASSED');
    return true;
  }
}

testKey();
