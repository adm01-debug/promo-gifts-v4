import { test, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

test('Webhook Contract: product-webhook validation', async () => {
  if (!supabaseUrl || !supabaseKey) {
    console.warn('Skipping contract test: No Supabase credentials');
    return;
  }

  const endpoint = `${supabaseUrl}/functions/v1/product-webhook`;
  
  // 1. Missing payload
  const res1 = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${supabaseKey}` },
    body: JSON.stringify({})
  });
  expect(res1.status).toBeGreaterThanOrEqual(400);
  const data1 = await res1.json().catch(() => ({}));
  expect(data1).toHaveProperty('error');

  // 2. Invalid UUID
  const res2 = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${supabaseKey}` },
    body: JSON.stringify({ id: 'invalid-uuid', type: 'INSERT' })
  });
  expect(res2.status).toBeGreaterThanOrEqual(400);
});
