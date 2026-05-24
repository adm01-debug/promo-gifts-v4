// supabase/functions/_shared/kill_switch.ts
// Helper para checagem rápida da tabela `public.system_kill_switches`.
// Toda edge function legada deve chamar `assertSwitchEnabled('switch_name', req)`
// LOGO no início do handler, ANTES de validar JWT, ler integration_credentials,
// abrir conexão Postgres ou fazer qualquer trabalho.
//
// Quando o switch está desabilitado, retorna Response 410 Gone com mensagem amigável.
// Quando habilitado, retorna null — handler continua normalmente.
//
// Performance: usa fetch direto ao endpoint REST com SERVICE_ROLE_KEY (rápido,
// passa por PostgREST com cache de pg_graphql/cache nativo).
//
// Criado em 2026-05-24 como parte da contenção do colapso causado por
// `external-db-bridge` em loop. Ver docs/RELATORIO_COLAPSO_2026-05-24.md.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Cache em memória do worker (60s). Edge functions têm worker isolation, então
// vale a pena: evita ir ao banco em toda invocação.
const cache = new Map<string, { enabled: boolean; legacy_message: string | null; expires: number }>();
const TTL_MS = 60_000;

interface KillSwitchRow {
  enabled: boolean;
  legacy_message: string | null;
}

async function fetchSwitch(switchName: string): Promise<KillSwitchRow | null> {
  const url = `${SUPABASE_URL}/rest/v1/system_kill_switches?select=enabled,legacy_message&switch_name=eq.${encodeURIComponent(switchName)}`;
  const res = await fetch(url, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    // Fail-open: se a checagem falhar, NÃO bloqueia tráfego legítimo.
    // Loga para diagnóstico mas deixa passar.
    console.warn(`[kill_switch] check failed for ${switchName}: ${res.status}`);
    return null;
  }
  const rows = (await res.json()) as KillSwitchRow[];
  return rows[0] ?? null;
}

/**
 * Retorna `null` se a função deve continuar processando,
 * ou uma `Response` 410 Gone se o switch estiver desligado.
 */
export async function assertSwitchEnabled(switchName: string, _req: Request): Promise<Response | null> {
  const now = Date.now();
  const cached = cache.get(switchName);
  let row: KillSwitchRow | null;

  if (cached && cached.expires > now) {
    row = { enabled: cached.enabled, legacy_message: cached.legacy_message };
  } else {
    row = await fetchSwitch(switchName);
    if (row) {
      cache.set(switchName, {
        enabled: row.enabled,
        legacy_message: row.legacy_message,
        expires: now + TTL_MS,
      });
    }
  }

  // Se não há registro: assume habilitado (fail-open).
  if (!row || row.enabled) return null;

  const message = row.legacy_message ?? "Esta função foi descontinuada.";
  return new Response(
    JSON.stringify({
      error: "Gone",
      switch: switchName,
      message,
    }),
    {
      status: 410,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300",
      },
    }
  );
}
