import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { newRequestId, REQUEST_ID_HEADER } from "@/lib/telemetry/requestId";
import { recordSecretsManagerCall } from "@/lib/telemetry/secretsManagerCallMetrics";

export interface SecretStatus {
  name: string;
  has_value: boolean;
  masked_suffix: string | null;
  length: number;
  updated_at?: string | null;
  /** UUID do admin que fez o último set/rotate (null se veio só de ENV). */
  updated_by?: string | null;
  /** E-mail resolvido do `updated_by` (null se não foi possível resolver). */
  updated_by_email?: string | null;
  source?: "db" | "env" | "none";
  env_fallback_active?: boolean;
}

export interface SecretError {
  code: string;
  message: string;
}

export interface RotationHistoryEntry {
  id: string;
  secret_name: string;
  rotated_by: string | null;
  rotated_by_email?: string | null;
  rotated_at: string;
  previous_suffix: string | null;
  new_suffix: string | null;
  notes: string | null;
  action_type?: "set" | "rotate";
}

export interface SecretMutationResult {
  ok: boolean;
  was_update?: boolean;
  previous_suffix?: string | null;
  secret?: SecretStatus;
  masked_suffix?: string | null;
  length?: number;
  error?: SecretError;
}

function normalizeError(raw: unknown, fallback = "Erro desconhecido"): SecretError {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    if (r.error && typeof r.error === "object") {
      const e = r.error as Record<string, unknown>;
      return {
        code: typeof e.code === "string" ? e.code : "unexpected",
        message: typeof e.message === "string" ? e.message : fallback,
      };
    }
    if (typeof r.message === "string") return { code: "unexpected", message: r.message };
  }
  return { code: "unexpected", message: fallback };
}

/**
 * Wrapper único de invoke ao secrets-manager. Garante:
 *  - request_id propagado via header X-Request-Id (correlação com edge logs)
 *  - amostra registrada em `secretsManagerCallMetrics` (alimenta o painel de logs admin)
 *  - status HTTP extraído do FunctionsHttpError quando aplicável
 *
 * Retorno espelha `supabase.functions.invoke` mas inclui sempre `requestId`
 * para que o caller possa exibir/copiar.
 */
type InvokeBody = {
  action: string;
  /** Nome do secret quando aplicável — usado como `target` na telemetria. */
  name?: string;
  [key: string]: unknown;
};

async function invokeSecretsManager(body: InvokeBody): Promise<{
  data: { ok?: boolean; secrets?: unknown; history?: unknown; message?: string; [k: string]: unknown } | null;
  error: { message: string; context?: Response } | null;
  requestId: string;
  status?: number;
}> {
  const requestId = newRequestId();
  const startedAt = performance.now();
  const { data, error } = await supabase.functions.invoke("secrets-manager", {
    body,
    headers: { [REQUEST_ID_HEADER]: requestId },
  });
  const durationMs = performance.now() - startedAt;
  const ctx = (error as { context?: Response } | null)?.context;
  const status = ctx?.status;

  recordSecretsManagerCall({
    action: body.action,
    target: body.name,
    durationMs,
    ok: !error && !(data && (data as { ok?: boolean }).ok === false),
    status,
    errorMessage: error?.message ?? (data && (data as { ok?: boolean }).ok === false
      ? (typeof (data as { error?: { message?: string } }).error?.message === "string"
          ? (data as { error: { message: string } }).error.message
          : undefined)
      : undefined),
    errorCode: data && (data as { ok?: boolean }).ok === false
      ? (typeof (data as { error?: { code?: string } }).error?.code === "string"
          ? (data as { error: { code: string } }).error.code
          : undefined)
      : undefined,
    requestId,
  });

  return {
    data: data as Record<string, unknown> | null,
    error: error as { message: string; context?: Response } | null,
    requestId,
    status,
  };
}

export function useSecretsManager() {
  const [secrets, setSecrets] = useState<SecretStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [listError, setListError] = useState<SecretError | null>(null);

  const list = useCallback(async (names?: string[]) => {
    setIsLoading(true);
    try {
      const { data, error, status: httpStatus } = await invokeSecretsManager({ action: "list", names });
      if (error) {
        // Tenta extrair payload estruturado (ex.: { error: { code, message } }) do FunctionsHttpError.
        const ctx = (error as { context?: Response }).context;
        let payload: unknown = null;
        if (ctx && typeof ctx.json === "function") {
          try { payload = await ctx.json(); } catch { /* ignore */ }
        }
        const normalized = normalizeError(payload ?? { message: error.message }, error.message);
        // Mapeia 401/403 para um code amigável quando o backend não enviou um.
        if ((!payload || normalized.code === "unexpected") && (httpStatus === 401 || httpStatus === 403)) {
          normalized.code = httpStatus === 401 ? "unauthenticated" : "forbidden";
          normalized.message = httpStatus === 401
            ? "Sessão expirada — faça login novamente para ver as credenciais."
            : "Sem permissão para acessar credenciais (apenas administradores).";
        }
        setListError(normalized);
        // Preserva o snapshot anterior em erros transientes (rede, 5xx, timeout)
        // para que filtros (DB/ENV/AUSENTE) e zonas selecionadas permaneçam
        // visíveis em vez de "resetar" a UI durante um refresh manual.
        // Apenas erros de auth/permissão limpam (estado real desconhecido).
        if (normalized.code === "unauthenticated" || normalized.code === "forbidden" || normalized.code === "permission_denied") {
          setSecrets([]);
        }
        toast.error("Erro ao listar credenciais", { description: normalized.message });
        return [];
      }
      setListError(null);
      setSecrets((data?.secrets ?? []) as SecretStatus[]);
      return data?.secrets as SecretStatus[];
    } catch (err) {
      const normalized = normalizeError(
        err instanceof Error ? { message: err.message } : err,
        "Falha de rede ao carregar credenciais.",
      );
      setListError(normalized);
      toast.error("Erro ao listar credenciais", { description: normalized.message });
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setSecret = useCallback(async (name: string, value: string): Promise<SecretMutationResult> => {
    const { data, error } = await invokeSecretsManager({ action: "set", name, value });
    if (error) {
      // Try to read structured payload from FunctionsHttpError context
      const ctx = (error as { context?: Response }).context;
      let payload: unknown = null;
      if (ctx && typeof ctx.json === "function") {
        try { payload = await ctx.json(); } catch { /* ignore */ }
      }
      return { ok: false, error: normalizeError(payload ?? { message: error.message }, error.message) };
    }
    if (data && data.ok === false) {
      return { ok: false, error: normalizeError(data) };
    }
    return {
      ok: true,
      was_update: !!data?.was_update,
      previous_suffix: data?.previous_suffix ?? null,
      masked_suffix: data?.masked_suffix ?? null,
      length: data?.length ?? value.length,
      secret: data?.secret as SecretStatus | undefined,
    };
  }, []);

  const rotateSecret = useCallback(async (name: string, value: string, notes?: string): Promise<SecretMutationResult> => {
    const { data, error } = await invokeSecretsManager({ action: "rotate", name, value, notes });
    if (error) {
      const ctx = (error as { context?: Response }).context;
      let payload: unknown = null;
      if (ctx && typeof ctx.json === "function") {
        try { payload = await ctx.json(); } catch { /* ignore */ }
      }
      return { ok: false, error: normalizeError(payload ?? { message: error.message }, error.message) };
    }
    if (data && data.ok === false) {
      return { ok: false, error: normalizeError(data) };
    }
    return {
      ok: true,
      was_update: true,
      previous_suffix: data?.previous_suffix ?? null,
      masked_suffix: data?.masked_suffix ?? null,
      length: data?.length ?? value.length,
      secret: data?.secret as SecretStatus | undefined,
    };
  }, []);

  const getRotationHistory = useCallback(async (name?: string): Promise<RotationHistoryEntry[]> => {
    const { data, error } = await invokeSecretsManager({ action: "rotation_history", name });
    if (error) {
      toast.error("Falha ao carregar histórico", { description: error.message });
      return [];
    }
    return (data?.history ?? []) as RotationHistoryEntry[];
  }, []);

  const refreshCache = useCallback(async (name?: string): Promise<{ ok: boolean; message?: string; error?: SecretError }> => {
    const { data, error } = await invokeSecretsManager({ action: "refresh_cache", name });
    if (error) {
      return { ok: false, error: normalizeError({ message: error.message }, error.message) };
    }
    if (data && data.ok === false) {
      return { ok: false, error: normalizeError(data) };
    }
    return { ok: true, message: data?.message };
  }, []);

  return { secrets, isLoading, listError, list, setSecret, rotateSecret, getRotationHistory, refreshCache };
}
