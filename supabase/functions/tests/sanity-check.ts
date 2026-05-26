const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function test(name: string, path: string) {
  console.log(`Testing ${name}...`);
  const start = performance.now();
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1${path}`, {
      headers: { "Authorization": `Bearer ${SERVICE_KEY}` }
    });
    console.log(`${name} status: ${res.status}`);
    console.log(`${name} headers:`, Object.fromEntries(res.headers.entries()));
  } catch (e) {
    console.error(`${name} failed:`, e);
  }
}

await test("health-check", "/health-check");
await test("validate-access", "/validate-access");
