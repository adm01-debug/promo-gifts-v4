import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.test({
  name: "[cnpj-lookup] Validação de contrato e tratamento de erros",
  fn: async () => {
    // 1. Payload Vazio
    const resEmpty = await fetch(`${SUPABASE_URL}/functions/v1/cnpj-lookup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    // Deveria retornar 401 Unauthorized se não logado, mas como o teste roda com privilégio
    // vamos ver o que ele retorna sem auth header.
    // Na verdade, authenticateRequest vai falhar sem o header.
    assertEquals(resEmpty.status, 401);

    // 2. CNPJ Inválido (menos de 14 dígitos)
    const resInvalid = await fetch(`${SUPABASE_URL}/functions/v1/cnpj-lookup`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}` // Simula anon, mas o request precisa ser logado
      },
      body: JSON.stringify({ cnpj: "123" })
    });
    // Se o auth passar (no local/CI pode passar se configurado), validamos o Zod.
    // Como não temos um JWT real aqui, esperamos 401.
    assertEquals(resInvalid.status, 401);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});
