I will switch the application's primary Supabase instance to your external database and migrate the existing tables.

**Note on Auth & Edge Functions:**
*   **Auth:** Your external Supabase must have the same Authentication providers and settings configured for login to work seamlessly.
*   **Edge Functions:** These will be updated to point to the external database by injecting the new credentials into their environment.
*   **Storage:** Buckets must be manually recreated in the external Supabase to match the current ones.

### Proposed Changes

#### 1. Database Migration
*   Export the current database schema and data from the internal Supabase.
*   Since I have service role access to both, I will use a script to migrate the core tables and their content to your external instance.
*   I will prioritize tables like `profiles`, `organizations`, and others visible in your current schema.

#### 2. Supabase Client Update
*   Modify `src/integrations/supabase/client.ts` to use `EXTERNAL_SUPABASE_URL` and `EXTERNAL_SUPABASE_ANON_KEY` from your secrets.
*   This will ensure the frontend immediately starts talking to your external database.

#### 3. Edge Functions Configuration
*   Update any existing Edge Functions to use the `EXTERNAL_SUPABASE_URL` and `EXTERNAL_SUPABASE_SERVICE_ROLE_KEY` for server-side operations.

#### 4. Verification
*   Run a connectivity test to ensure the frontend can read/write to the external database.
*   Verify that the Auth session can still be established (if the external DB is configured correctly).

### Technical Details
*   I will create a migration script `scripts/migrate-to-external.ts` that uses the Supabase JS client to copy data between instances.
*   I will update `src/integrations/supabase/client.ts` to look for the external credentials first.
*   I will check if there are any hardcoded references to the old project ID.

**Next steps after approval:**
1. Execute the migration script.
2. Update the client code.
3. Test and verify.