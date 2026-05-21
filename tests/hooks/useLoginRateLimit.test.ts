/**
 * useLoginRateLimit — testes funcionais (funções puras com sessionStorage).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  checkLoginAllowed,
  recordFailedAttempt,
  clearLoginAttempts,
} from "@/lib/auth/rate-limit";

beforeEach(() => {
  sessionStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2025-01-01T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  sessionStorage.clear();
});

describe("useLoginRateLimit", () => {
  it("permite login quando não há registro", () => {
    expect(checkLoginAllowed("a@b.com")).toEqual({ allowed: true, remainingSeconds: 0 });
  });

  it("incrementa tentativas e bloqueia após 5", () => {
    for (let i = 0; i < 4; i++) {
      const r = recordFailedAttempt("user@test.com");
      expect(r.locked).toBe(false);
    }
    const fifth = recordFailedAttempt("user@test.com");
    expect(fifth.locked).toBe(true);
    expect(fifth.remainingSeconds).toBeGreaterThan(0);

    const check = checkLoginAllowed("user@test.com");
    expect(check.allowed).toBe(false);
    expect(check.remainingSeconds).toBeGreaterThan(0);
  });

  it("é case-insensitive no email", () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt("User@Test.com");
    expect(checkLoginAllowed("user@test.com").allowed).toBe(false);
    expect(checkLoginAllowed("USER@TEST.COM").allowed).toBe(false);
  });

  it("desbloqueia após o lockout expirar", () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt("e@t.com");
    expect(checkLoginAllowed("e@t.com").allowed).toBe(false);

    // avança 6 minutos
    vi.setSystemTime(new Date("2025-01-01T12:06:00Z"));
    const result = checkLoginAllowed("e@t.com");
    expect(result.allowed).toBe(true);
  });

  it("clearLoginAttempts remove o registro", () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt("c@t.com");
    expect(checkLoginAllowed("c@t.com").allowed).toBe(false);
    clearLoginAttempts("c@t.com");
    expect(checkLoginAllowed("c@t.com").allowed).toBe(true);
  });

  it("janela de tentativas reseta após 5 minutos sem nova falha", () => {
    recordFailedAttempt("w@t.com");
    recordFailedAttempt("w@t.com");
    vi.setSystemTime(new Date("2025-01-01T12:06:00Z"));
    const r = recordFailedAttempt("w@t.com");
    expect(r.locked).toBe(false);
  });

  it("sobrevive a sessionStorage corrompido", () => {
    sessionStorage.setItem("login_attempts", "{not-json");
    expect(checkLoginAllowed("x@y.com")).toEqual({ allowed: true, remainingSeconds: 0 });
  });
});
