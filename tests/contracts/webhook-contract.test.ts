import { test, expect } from 'vitest';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://pqpdolkaeqlyzpdpbizo.supabase.co';

test('Webhook Contract: product-webhook validation', async () => {
  const endpoint = `${supabaseUrl}/functions/v1/product-webhook`;
  
  // Test 1: Missing headers (Should return 401 Unauthorized because it's a secured webhook)
  // This is actually a "pre-contract" validation: security first.
  const res1 = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'upsert' })
  });
  expect(res1.status).toBe(401);
  const data1 = await res1.json();
  expect(data1.code).toBe('unauthorized');

  // Test 2: Invalid signature headers (Still 401)
  const res2 = await fetch(endpoint, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'x-webhook-signature': 'invalid',
      'x-webhook-nonce': 'abc',
      'x-webhook-timestamp': Math.floor(Date.now() / 1000).toString()
    },
    body: JSON.stringify({ action: 'upsert' })
  });
  expect(res2.status).toBe(401);
});
