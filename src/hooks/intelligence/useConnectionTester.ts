import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getErrorCopy } from "@/lib/connection-error-copy";
import { createClientLogger } from "@/lib/telemetry/structuredLogger";

export type ConnectionType = "supabase" | "bitrix24" | "n8n" | "mcp" | "webhook_outbound";
export type ErrorKind =
  | "timeout"
  | "network"
  | "dns"
  | "http"
  | "auth"
  | "config"
  | "unknown";

export interface TestResult {
  ok: boolean;
  status?: number;
  latency_ms?: number;
  error?: string;
  error_kind?: ErrorKind;
  message?: string;
  /** Timeout efetivo (ms) que o backend aplicou neste teste. */
  timeout_ms?: number;
  tested_at?: string;
}

interface TestOptions {
  env_key?: "promobrind" | "crm";
  config?: Record<string, string>;
  connectionId?: string;
  silent?: boolean;
}

export function useConnectionTester() {
  const [isTesting, setIsTesting] = useState(false);
  const [lastResult, setLastResult] = useState<TestResult | null>(null);

  const test = useCallback(async (
    type: ConnectionType,
    optionsOrConfig: TestOptions | Record<string, string> = {},
    legacyConnectionId?: string,
  ): Promise<TestResult> => {
    let config: Record<string, string> | undefined;
    let connection_id: string | undefined;
    let env_key: "promobrind" | "crm" | undefined;
    let silent = false;
    if ("config" in optionsOrConfig || "env_key" in optionsOrConfig || "connectionId" in optionsOrConfig || "silent" in optionsOrConfig) {
      const opts = optionsOrConfig as TestOptions;
      config = opts.config;
      connection_id = opts.connectionId ?? legacyConnectionId;
      env_key = opts.env_key;
      silent = !!opts.silent;
    } else {
      config = optionsOrConfig as Record<string, string>;
      connection_id = legacyConnectionId;
    }

    setIsTesting(true);
    const log = createClientLogger('connections.testCredentials', { base: { type, env_key, connection_id } });
    log.info('test_start');
    try {
      const { data, error } = await supabase.functions.invoke("connection-tester", {
        body: { action: "test", type, config, connection_id, env_key },
        headers: log.headers(),
      });
      if (error) throw error;
      const r = (data?.result ?? {}) as TestResult;
      const normalized: TestResult = {
        ok: !!r.ok,
        status: r.status,
        latency_ms: r.latency_ms,
        error: r.error,
        error_kind: r.error_kind,
        message: r.message,
        timeout_ms: r.timeout_ms,
        tested_at: r.tested_at ?? new Date().toISOString(),
      };
      setLastResult(normalized);
      if (normalized.ok) {
        log.info('test_ok', { status: normalized.status, latency_ms: normalized.latency_ms });
      } else {
        log.warn('test_failed', { status: normalized.status, error_kind: normalized.error_kind, error: normalized.error });
      }
      if (!silent) {
        if (normalized.ok) {
          toast.success("Conexão OK", {
            description: normalized.message ?? `${normalized.status ?? "200"} em ${normalized.latency_ms ?? "?"}ms`,
          });
        } else {
          const copy = getErrorCopy(normalized.error_kind, normalized.status, normalized.error ?? normalized.message, normalized.timeout_ms);
          toast.error(copy.title, {
            description: copy.hint,
          });
        }
      }
      return normalized;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro";
      const failed: TestResult = { ok: false, error: msg, error_kind: "unknown", tested_at: new Date().toISOString() };
      setLastResult(failed);
      log.error('test_exception', { err });
      if (!silent) toast.error("Erro ao testar conexão", { description: msg });
      return failed;
    } finally {
      setIsTesting(false);
    }
  }, []);

  const fetchLastTest = useCallback(async (
    type: ConnectionType,
    opts: { env_key?: "promobrind" | "crm"; connectionId?: string } = {},
  ): Promise<{
    tested_at: string | null;
    ok: boolean | null;
    message: string | null;
    latency_ms: number | null;
  } | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("connection-tester", {
        body: {
          action: "last_test",
          type,
          env_key: opts.env_key,
          connection_id: opts.connectionId,
        },
      });
      if (error) return null;
      const last = data?.last;
      if (!last) return null;
      return {
        tested_at: last.last_test_at ?? null,
        ok: last.last_test_ok ?? null,
        message: last.last_test_message ?? null,
        latency_ms: last.last_latency_ms ?? null,
      };
    } catch {
      return null;
    }
  }, []);

  return { test, isTesting, lastResult, fetchLastTest };
}
