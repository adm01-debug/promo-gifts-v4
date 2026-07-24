/**
 * step-up-role-revocation_test.ts
 *
 * Garante que um `step_up_token` emitido com sucesso é REJEITADO no momento
 * do consumo se o usuário perder o papel `dev` entre a emissão e o consumo.
 *
 * Camadas:
 *
 *  1. **DB invariant (offline)**: lê o SQL da migration que define
 *     `consume_step_up_token` e exige a presença do gate de re-checagem
 *     (`is_dev(_uid)`) ANTES de qualquer lookup do token, com audit
 *     `reason=role_lost_at_consume`. Isso impede que uma migration futura
 *     remova/relaxe o gate sem o teste falhar.
 *
 *  2. **Edge runtime invariant (offline)**: lê o código das edge functions
 *     que consomem step-up (rotate/update/issue/revoke) e confirma que cada
 *     uma chama `consume_step_up_token` (que aplica a re-checagem). Se a
 *     função pular o RPC e validar o token de outra forma, o gate de role
 *     é contornado.
 *
 *  3. **HTTP smoke (online)**: chama `consume_step_up_token` como cliente
 *     anônimo (sem JWT). A função deve retornar `false` (cobre o branch
 *     `_uid IS NULL` que precede o gate de role e atua como fail-closed
 *     adicional).
 *
 * Cobertura E2E real (criar user, atribuir role dev, emitir token, revogar
 * role, consumir) exige `SUPABASE_SERVICE_ROLE_KEY`. Quando ausente, esse
 * step fica `ignored`. As camadas 1 e 2 fecham a regressão crítica.
 */

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.208.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// ============================================================================
// 1. DB INVARIANT — migration source garante o gate
// ============================================================================

Deno.test("consume_step_up_token: migration contém re-checagem is_dev(_uid)", async () => {
  // Localiza a migration que (re)define a função.
  const migrationsDir = new URL("../../migrations/", import.meta.url);
  const candidates: string[] = [];
  for await (const entry of Deno.readDir(migrationsDir)) {
    if (!entry.isFile || !entry.name.endsWith(".sql")) continue;
    const path = new URL(entry.name, migrationsDir).pathname;
    const src = await Deno.readTextFile(path);
    if (/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.consume_step_up_token/i.test(src)) {
      candidates.push(path);
    }
  }

  assert(
    candidates.length > 0,
    "Nenhuma migration define consume_step_up_token — função pode ter sido removida ou movida.",
  );

  // Pega a definição mais recente (última migration que tocou a função).
  candidates.sort();
  const latest = candidates[candidates.length - 1];
  const src = await Deno.readTextFile(latest);

  // Extrai o corpo da função (entre AS $$ ... $$).
  const bodyMatch = src.match(
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.consume_step_up_token[\s\S]*?AS\s+\$\$([\s\S]*?)\$\$/i,
  );
  assert(bodyMatch, `Não foi possível extrair corpo de consume_step_up_token em ${latest}`);
  const body = bodyMatch[1];

  // Gate obrigatório: re-checa is_dev no início do consumo.
  assert(
    /IF\s+NOT\s+public\.is_dev\s*\(\s*_uid\s*\)\s+THEN/i.test(body),
    "consume_step_up_token: falta o gate `IF NOT public.is_dev(_uid) THEN` — " +
      "usuário poderia consumir token após perder o papel dev.",
  );

  // Audit obrigatório do branch de revogação de role (rastreabilidade forense).
  assertStringIncludes(
    body,
    "role_lost_at_consume",
    "consume_step_up_token: branch de role perdida deve registrar audit com reason=role_lost_at_consume.",
  );

  // Garante que o gate de role aparece ANTES do lookup do token (fail-closed:
  // não revelamos via timing se o token existia para um user sem role).
  const idxRoleGate = body.search(/IF\s+NOT\s+public\.is_dev\s*\(\s*_uid\s*\)/i);
  const idxTokenLookup = body.search(/FROM\s+public\.step_up_tokens/i);
  assert(
    idxRoleGate >= 0 && idxTokenLookup >= 0 && idxRoleGate < idxTokenLookup,
    "consume_step_up_token: gate is_dev deve preceder o SELECT em step_up_tokens (ordem fail-closed).",
  );

  // Branch de role perdida deve retornar false (e não, ex., raise exception silenciado).
  const roleBranch = body.match(
    /IF\s+NOT\s+public\.is_dev\s*\(\s*_uid\s*\)\s+THEN[\s\S]*?END\s+IF\s*;/i,
  );
  assert(roleBranch, "Não foi possível isolar o branch de role perdida.");
  assert(
    /RETURN\s+false\s*;/i.test(roleBranch[0]),
    "Branch de role perdida deve `RETURN false` — qualquer outro retorno burla o gate.",
  );
});

// ============================================================================
// 2. EDGE RUNTIME INVARIANT — todas as funções sensíveis passam pelo RPC
// ============================================================================

const SENSITIVE_FUNCTIONS = [
  "mcp-keys-issue",
  "mcp-keys-rotate",
  "mcp-keys-update",
  "mcp-keys-revoke",
] as const;

for (const fn of SENSITIVE_FUNCTIONS) {
  Deno.test(`${fn}: consome step-up via RPC (gate is_dev é re-aplicado)`, async () => {
    const path = new URL(`../${fn}/index.ts`, import.meta.url).pathname;
    let src: string;
    try {
      src = await Deno.readTextFile(path);
    } catch {
      // Se a função não existe (renomeada/removida), o teste falha
      // explicitamente em vez de passar silenciosamente.
      throw new Error(`Edge function ${fn} não encontrada em ${path}`);
    }

    assert(
      /\.rpc\(\s*["']consume_step_up_token["']/.test(src),
      `${fn}: não chama supabase.rpc("consume_step_up_token") — ` +
        "token nunca passa pelo gate de re-checagem de role no banco.",
    );

    // O RPC DEVE ser chamado a partir de um client com JWT do usuário (não
    // service_role / admin), caso contrário `auth.uid()` retorna NULL e o
    // gate `is_dev(_uid)` falha por motivo errado, mascarando bugs.
    // Heurística: a chamada `consume_step_up_token` deve aparecer perto de
    // um client construído com o Authorization do request (userClient).
    const rpcIdx = src.search(/\.rpc\(\s*["']consume_step_up_token["']/);
    const window = src.slice(Math.max(0, rpcIdx - 600), rpcIdx + 100);
    assert(
      /userClient|user_client|userSb/.test(window),
      `${fn}: consume_step_up_token deve ser chamado a partir do client do usuário ` +
        "(propagando JWT) — admin/service_role zera auth.uid() e o gate de role não funciona.",
    );
  });
}

// ============================================================================
// 3. HTTP SMOKE — chamada anônima retorna false (fail-closed)
// ============================================================================

Deno.test({
  name: "consume_step_up_token: chamada sem JWT retorna false (fail-closed)",
  ignore: !SUPABASE_URL || !SUPABASE_ANON_KEY,
  async fn() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/consume_step_up_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY!,
        // sem Authorization → auth.uid() = NULL no servidor
      },
      body: JSON.stringify({
        _token: "x".repeat(64),
        _expected_action: "mcp_full_issue",
        _expected_target: null,
      }),
    });
    const text = await res.text();

    // PostgREST retorna o boolean diretamente. Caminho esperado: 200 + "false".
    // 401/403 também são aceitáveis (fail-closed mais estrito).
    if (res.status === 200) {
      assertEquals(text.trim(), "false", `Esperado false, recebido: ${text}`);
    } else {
      assert(
        res.status === 401 || res.status === 403,
        `Status inesperado ${res.status}: ${text}`,
      );
    }
  },
});

// ============================================================================
// 4. E2E (opcional, requer service role) — emite token, revoga role, tenta consumir
// ============================================================================

Deno.test({
  name: "E2E: token rejeitado quando role dev é revogada antes do consumo",
  ignore: !SUPABASE_URL || !SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY,
  async fn() {
    const admin = `${SUPABASE_URL}/rest/v1`;
    const adminHeaders = {
      apikey: SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };

    // 1. Cria user fake via Auth Admin API
    const email = `step-up-revoke-${crypto.randomUUID()}@test.invalid`;
    const password = `T${crypto.randomUUID()}!`;
    const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: { ...adminHeaders, Prefer: "" },
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    const createBody = await createRes.json();
    assertEquals(createRes.status, 200, `criar user: ${JSON.stringify(createBody)}`);
    const userId = createBody.id as string;

    try {
      // 2. Atribui role dev
      const roleIns = await fetch(`${admin}/user_roles`, {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({ user_id: userId, role: "dev" }),
      });
      await roleIns.text();

      // 3. Login para obter JWT
      const loginRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY!, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const loginBody = await loginRes.json();
      assertEquals(loginRes.status, 200, `login: ${JSON.stringify(loginBody)}`);
      const userJwt = loginBody.access_token as string;

      // 4. Insere token válido manualmente (admin) — simula step-up-verify
      const rawToken = "t".repeat(48) + crypto.randomUUID().replaceAll("-", "");
      const tokenHash = await sha256Hex(rawToken);

      // Precisa de um challenge_id (FK). Cria um.
      const chRes = await fetch(`${admin}/step_up_challenges`, {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({
          user_id: userId,
          action: "mcp_full_issue",
          target_ref: null,
          // demais colunas usam defaults
        }),
      });
      const chBody = await chRes.json();
      const challengeId = Array.isArray(chBody) ? chBody[0].id : chBody.id;

      const tokRes = await fetch(`${admin}/step_up_tokens`, {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({
          user_id: userId,
          action: "mcp_full_issue",
          target_ref: null,
          token_hash: tokenHash,
          challenge_id: challengeId,
        }),
      });
      await tokRes.text(); // Consume body to avoid leak
      assert(tokRes.ok, `inserir token: ${tokRes.status}`);

      // 5. Caminho positivo: com role dev, consume retorna true
      const okRes = await fetch(`${admin}/rpc/consume_step_up_token`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${userJwt}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          _token: rawToken,
          _expected_action: "mcp_full_issue",
          _expected_target: null,
        }),
      });
      const okText = (await okRes.text()).trim();
      assertEquals(okRes.status, 200, `consume(positivo): ${okText}`);
      assertEquals(okText, "true", "Caminho positivo deveria consumir token com role dev.");

      // 6. Revoga role dev
      const delRes = await fetch(
        `${admin}/user_roles?user_id=eq.${userId}&role=eq.dev`,
        { method: "DELETE", headers: adminHeaders },
      );
      await delRes.text();
      assert(delRes.ok, `revogar role: ${delRes.status}`);

      // 7. Emite NOVO token (o anterior já foi consumido)
      const rawToken2 = "u".repeat(48) + crypto.randomUUID().replaceAll("-", "");
      const tokenHash2 = await sha256Hex(rawToken2);
      const tok2Res = await fetch(`${admin}/step_up_tokens`, {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({
          user_id: userId,
          action: "mcp_full_issue",
          target_ref: null,
          token_hash: tokenHash2,
          challenge_id: challengeId,
        }),
      });
      await tok2Res.text();
      assert(tok2Res.ok, `inserir token 2: ${tok2Res.status}`);

      // 8. Caminho negativo: sem role dev, consume retorna false
      const noRes = await fetch(`${admin}/rpc/consume_step_up_token`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${userJwt}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          _token: rawToken2,
          _expected_action: "mcp_full_issue",
          _expected_target: null,
        }),
      });
      const noText = (await noRes.text()).trim();
      assertEquals(noRes.status, 200, `consume(negativo) HTTP: ${noText}`);
      assertEquals(
        noText,
        "false",
        "Token NÃO pode ser consumido após revogação da role dev.",
      );

      // 9. Audit deve registrar o motivo correto
      const auditRes = await fetch(
        `${admin}/step_up_audit_log?user_id=eq.${userId}&event_type=eq.unauthorized&order=created_at.desc&limit=1`,
        { method: "GET", headers: adminHeaders },
      );
      const auditRows = await auditRes.json();
      assert(
        Array.isArray(auditRows) && auditRows.length > 0,
        "Audit deve conter pelo menos um evento `unauthorized` para o user.",
      );
      assertEquals(
        auditRows[0]?.metadata?.reason,
        "role_lost_at_consume",
        `Audit deve registrar reason=role_lost_at_consume. Got: ${JSON.stringify(auditRows[0]?.metadata)}`,
      );

      // 10. Token segue não-consumido no banco (não pode ser "queimado" se foi rejeitado)
      const tokCheck = await fetch(
        `${admin}/step_up_tokens?token_hash=eq.${tokenHash2}&select=consumed`,
        { method: "GET", headers: adminHeaders },
      );
      const tokRows = await tokCheck.json();
      assertEquals(
        tokRows[0]?.consumed,
        false,
        "Token rejeitado por role perdida NÃO deve ser marcado como consumed.",
      );
    } finally {
      // Cleanup: remove user (cascade limpa user_roles, tokens, audit)
      await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: "DELETE",
        headers: adminHeaders,
      }).then((r) => r.text()).catch(() => {});
    }
  },
});

// ============================================================================
// utils
// ============================================================================

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
