import { createClient } from '@supabase/supabase-js';

async function migrateData() {
  const internalUrl = process.env.SUPABASE_URL;
  const internalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const externalUrl = process.env.EXTERNAL_SUPABASE_URL;
  const externalKey = process.env.EXTERNAL_SUPABASE_SERVICE_ROLE_KEY;

  if (!internalUrl || !internalKey || !externalUrl || !externalKey) {
    console.error('Missing environment variables');
    return;
  }

  const internal = createClient(internalUrl, internalKey);
  const external = createClient(externalUrl, externalKey);

  // List of tables to migrate
  const tables = [
    'profiles', 'products', 'orders', 'order_items', 'collections', 
    'collection_items', 'organizations', 'organization_members', 
    'user_roles', 'permissions', 'role_permissions', 'system_settings'
    // ... add more if needed
  ];

  for (const table of tables) {
    console.log(`Migrating table: ${table}`);
    const { data, error } = await internal.from(table).select('*');
    if (error) {
      console.error(`Error fetching ${table}:`, error.message);
      continue;
    }

    if (data && data.length > 0) {
      const { error: insertError } = await external.from(table).upsert(data);
      if (insertError) {
        console.error(`Error inserting into ${table}:`, insertError.message);
      } else {
        console.log(`Successfully migrated ${data.length} rows to ${table}`);
      }
    } else {
      console.log(`Table ${table} is empty.`);
    }
  }
}

migrateData();
