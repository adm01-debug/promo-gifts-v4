import { assert } from "https://deno.land/std@0.168.0/testing/asserts.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "http://localhost:54321";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

type FunctionSummary = { total: number; passed: number };
const summary = new Map<string, FunctionSummary>();

export type BusinessCase = {
  functionName: string;
  caseId: string;
  businessRule: string;
  testName: string;
  run: () => Promise<void> | void;
};

export async function invokeFunction(name: string, body: unknown, headers: Record<string, string> = {}) {
  const url = `${SUPABASE_URL}/functions/v1/${name}`;
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "X-Internal-Call": "true",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

export function registerCase(businessCase: BusinessCase) {
  const { functionName, caseId, businessRule, testName, run } = businessCase;
  Deno.test(`${functionName} :: ${caseId} :: ${testName} [regra: ${businessRule}]`, async () => {
    const current = summary.get(functionName) ?? { total: 0, passed: 0 };
    current.total += 1;
    try {
      await run();
      current.passed += 1;
    } finally {
      summary.set(functionName, current);
    }
  });
}

globalThis.addEventListener("unload", () => {
  const lines = Array.from(summary.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([functionName, { total, passed }]) => {
      const rate = total === 0 ? 0 : (passed / total) * 100;
      return `• ${functionName}: ${passed}/${total} (${rate.toFixed(1)}%)`;
    });

  assert(lines.length > 0, "Nenhum cenário de integração edge foi registrado.");
  console.log("\n=== Sumário final por função (cenários / taxa de sucesso) ===");
  for (const line of lines) console.log(line);
});
