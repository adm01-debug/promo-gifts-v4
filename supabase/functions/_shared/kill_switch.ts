// supabase/functions/_shared/kill_switch.ts
// Helper para checagem rápida da tabela `public.system_kill_switches`.
// Toda edge function legada deve chamar `assertSwitchEnabled('switch_name', req)`
// LOGO no início do handler (após CORS preflight), ANTES de validar JWT,
// ler integration_credentials, abrir conexão Postgres ou fazer qualquer trabalho.
//
// Quando o switch está desabilitado, retorna Response 410 Gone com mensagem amigável.
// Quando habilitado (ou inexistente), retorna null — handler continua normalmente.
//
// Implementação:
// - Usa `anon` key (não service_role) para reduzir custo. A tabela tem RLS
//   ativada com policy de SELECT pública (true) — só permite SELECT mesmo.
// - Cache em memória do worker com TTL 60s. Primeiro hit faz 1 fetch leve;
//   os próximos 60s vêm do cache.
// - Timeout duro de 1.5s no fetch — não bloqueia o handler indefinidamente.
// - Fail-open: se a checagem falhar (rede, 5xx, timeout), NÃO bloqueia tráfego.
//
// Criado em 2026-05-24 como parte da contenção do colapso causado por
// `external-db-bridge` em loop. Ver docs/RELATORIO_COLAPSO_2026-05-24.md.
// Atualizado em 2026-05-24 (fase 2): anon key + timeout + corsHeaders param.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
// Anon key é seguro aqui — RLS + policy pública garantem que só SELECT funciona.
const ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ??
  Deno.env.get("ANON_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface KillSwitchRow {
  enabled: boolean;
  legacy_message: string | null;
}

interface CacheEntry {
  enabled: boolean;
  legacy_message: string | null;
  expires: number;
}

const cache = new Map<string, CacheEntry>();
const TTL_MS = 60_000;
const FETCH_TIMEOUT_MS = 1_500;

async function fetchSwitch(switchName: string): Promise<KillSwitchRow | null> {
  if (!SUPABASE_URL || !ANON_KEY) return null;

  const url = `${SUPABASE_URL}/rest/v1/system_kill_switches` +
    `?select=enabled,legacy_message&switch_name=eq.${encodeURIComponent(switchName)}` +
    `&limit=1`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[kill_switch] check failed for ${switchName}: HTTP ${res.status}`);
      return null;
    }
    const rows = (await res.json()) as KillSwitchRow[];
    return rows[0] ?? null;
  } catch (err) {
    console.warn(`[kill_switch] check error for ${switchName}: ${(err as Error).message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Retorna `null` se a função deve continuar processando,
 * ou uma `Response` 410 Gone se o switch estiver desligado.
 *
 * @param switchName  - chave em `public.system_kill_switches.switch_name`
 * @param _req        - Request original (mantido para futuras heurísticas)
 * @param corsHeaders - headers CORS já calculados pelo handler (opcional)
 */
export async function assertSwitchEnabled(
  switchName: string,
  _req: Request,
  corsHeaders: Record<string, string> = {},
): Promise<Response | null> {
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

  // Não há registro OU switch está habilitado → segue o jogo.
  if (!row || row.enabled) return null;

  const message = row.legacy_message ?? "Esta função foi descontinuada.";
  return new Response(
    JSON.stringify({
      error: "Gone",
      switch: switchName,
      message,
      migration_hint:
        "Use chamadas REST nativas em /rest/v1/ ou a função substituta correspondente.",
    }),
    {
      status: 410,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300",
      },
    },
  );
}
