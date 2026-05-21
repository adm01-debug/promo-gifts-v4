import type { TestResult } from "@/hooks/intelligence/useConnectionTester";
import type { LastTestInfo } from "@/components/admin/connections/LastTestLine";

export function makeTimeoutResult(overrides: Partial<TestResult> = {}): TestResult {
  return {
    ok: false,
    error_kind: "timeout",
    error: "timeout após 12000ms",
    timeout_ms: 12000,
    latency_ms: 12001,
    tested_at: new Date().toISOString(),
    ...overrides,
  };
}

export function makeNetworkResult(overrides: Partial<TestResult> = {}): TestResult {
  return {
    ok: false,
    error_kind: "network",
    error: "fetch failed",
    latency_ms: 47,
    tested_at: new Date().toISOString(),
    ...overrides,
  };
}

export function makeDnsResult(overrides: Partial<TestResult> = {}): TestResult {
  return {
    ok: false,
    error_kind: "dns",
    error: "getaddrinfo ENOTFOUND foo.bar",
    latency_ms: 12,
    tested_at: new Date().toISOString(),
    ...overrides,
  };
}

export function makeAuthResult(overrides: Partial<TestResult> = {}): TestResult {
  return {
    ok: false,
    error_kind: "auth",
    status: 401,
    error: "Unauthorized",
    latency_ms: 88,
    tested_at: new Date().toISOString(),
    ...overrides,
  };
}

export function makeHttpResult(status = 504, overrides: Partial<TestResult> = {}): TestResult {
  return {
    ok: false,
    error_kind: "http",
    status,
    error: `HTTP ${status}`,
    latency_ms: 250,
    tested_at: new Date().toISOString(),
    ...overrides,
  };
}

export function makeOkResult(overrides: Partial<TestResult> = {}): TestResult {
  return {
    ok: true,
    status: 200,
    latency_ms: 120,
    tested_at: new Date().toISOString(),
    ...overrides,
  };
}

export function toLastTestInfo(r: TestResult): LastTestInfo {
  return {
    ok: r.ok,
    tested_at: r.tested_at ?? new Date().toISOString(),
    latency_ms: r.latency_ms ?? null,
    message: r.error ?? r.message ?? null,
    status: r.status ?? null,
    error_kind: r.error_kind ?? null,
    timeout_ms: r.timeout_ms ?? null,
  };
}
