
import { createClient } from '@supabase/supabase-js';

const SOURCE_URL = process.env.SUPABASE_URL;
const SOURCE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TARGET_URL = process.env.EXTERNAL_SUPABASE_URL;
const TARGET_KEY = process.env.EXTERNAL_SUPABASE_SERVICE_ROLE_KEY;

if (!SOURCE_URL || !SOURCE_KEY || !TARGET_URL || !TARGET_KEY) {
  console.error('Missing required environment variables for migration.');
  process.exit(1);
}

const sourceClient = createClient(SOURCE_URL, SOURCE_KEY);
const targetClient = createClient(TARGET_URL, TARGET_KEY);

const TABLES_TO_MIGRATE = [
  'profiles',
  'organizations',
  'organization_members',
  'products',
  'orders',
  'user_roles',
  'permissions',
  'role_permissions'
];

async function migrateTable(tableName: string) {
  console.log(`Migrating table: ${tableName}...`);
  
  // 1. Get data from source
  const { data, error: fetchError } = await sourceClient.from(tableName).select('*');
  
  if (fetchError) {
    console.error(`Error fetching from ${tableName}:`, fetchError.message);
    return;
  }
  
  if (!data || data.length === 0) {
    console.log(`No data found in ${tableName}.`);
    return;
  }
  
  // 2. Insert into target
  // Note: This assumes the schema already exists or we are just inserting data.
  // We use upsert to avoid conflicts if some data exists.
  const { error: insertError } = await targetClient.from(tableName).upsert(data);
  
  if (insertError) {
    console.error(`Error inserting into ${tableName}:`, insertError.message);
    if (insertError.message.includes('relation') && insertError.message.includes('does not exist')) {
        console.log(`Table ${tableName} does not exist on target. Please run migrations first.`);
    }
  } else {
    console.log(`Successfully migrated ${data.length} rows to ${tableName}.`);
  }
}

async function run() {
  for (const table of TABLES_TO_MIGRATE) {
    await migrateTable(table);
  }
  console.log('Migration completed.');
}

run();
