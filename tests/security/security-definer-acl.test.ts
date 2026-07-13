/**
 * SECURITY DEFINER ACL — regressão automática
 * ---------------------------------------------------------------
 * Garante que nenhuma função `SECURITY DEFINER` em `public` fique
 * executável por `PUBLIC`, `anon` (fora da whitelist `public_intent`)
 * ou `authenticated` (para trigger functions). Complementa o script
 * `scripts/check-security-definer-acl.mjs` (gate de CI) rodando na
 * suíte vitest padrão — pega regressão local antes do PR.
 *
 * Fonte de verdade: RPC `public.audit_security_definer_acl()` — a
 * mesma consultada pelo gate. Se retornar linhas, é violação.
 *
 * Skipped quando credenciais Supabase ausentes (fork PR, sandbox).
 */
import { test, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const hasCreds = !!url && !!key;

type Violation = {
  function_name: string;
  arguments: string | null;
  granted_to: string;
  problem: string;
};

test.skipIf(!hasCreds)(
  "SECURITY DEFINER ACL: 0 violações em public",
  async () => {
    const supabase = createClient(url!, key!);
    const { data, error } = await supabase.rpc("audit_security_definer_acl");

    expect(error, `RPC audit_security_definer_acl falhou: ${error?.message}`).toBeNull();
    expect(Array.isArray(data), "esperava array de violações").toBe(true);

    const rows = (data ?? []) as Violation[];
    if (rows.length > 0) {
      const table = rows
        .map(
          (r) =>
            `  ${r.function_name}(${r.arguments ?? ""})  → ${r.granted_to}  [${r.problem}]`,
        )
        .join("\n");
      throw new Error(
        `\n${rows.length} função(ões) SECURITY DEFINER expostas indevidamente:\n${table}\n\n` +
          `Corrija com REVOKE EXECUTE ON FUNCTION public.<fn>(<args>) FROM <papel>;\n` +
          `Se a exposição é intencional, adicione ao array public_intent em audit_security_definer_acl().`,
      );
    }
  },
  30_000,
);

test.skipIf(!hasCreds)(
  "SECURITY DEFINER ACL: RPC audit_security_definer_acl é acessível e retorna schema esperado",
  async () => {
    const supabase = createClient(url!, key!);
    const { data, error } = await supabase.rpc("audit_security_definer_acl");
    expect(error).toBeNull();
    // Schema check via primeira linha (se houver); array vazio também é válido.
    if (Array.isArray(data) && data.length > 0) {
      const first = data[0] as Record<string, unknown>;
      for (const col of ["function_name", "granted_to", "problem"]) {
        expect(first, `coluna ${col} ausente no RPC`).toHaveProperty(col);
      }
    }
  },
  15_000,
);
