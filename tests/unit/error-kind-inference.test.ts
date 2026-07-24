/**
 * Unit tests for src/lib/error-kind-inference.ts
 *
 * inferErrorKind
 */
import { describe, it, expect } from 'vitest';
import { inferErrorKind } from '@/lib/error-kind-inference';

describe('inferErrorKind', () => {
  // ── success ──────────────────────────────────────────────────────────────

  it('returns null when success=true (regardless of other fields)', () => {
    expect(inferErrorKind({ success: true })).toBeNull();
    expect(inferErrorKind({ success: true, errorKind: 'timeout', statusCode: 401 })).toBeNull();
  });

  // ── pre-recorded kind ─────────────────────────────────────────────────────

  it('returns existing errorKind as-is when already set', () => {
    expect(inferErrorKind({ errorKind: 'timeout' })).toBe('timeout');
    expect(inferErrorKind({ errorKind: 'network' })).toBe('network');
    expect(inferErrorKind({ errorKind: 'auth' })).toBe('auth');
    expect(inferErrorKind({ errorKind: 'dns' })).toBe('dns');
    expect(inferErrorKind({ errorKind: 'http' })).toBe('http');
    expect(inferErrorKind({ errorKind: 'config' })).toBe('config');
    expect(inferErrorKind({ errorKind: 'unknown' })).toBe('unknown');
  });

  // ── timeout ───────────────────────────────────────────────────────────────

  it('returns "timeout" for message containing "timeout"', () => {
    expect(inferErrorKind({ errorMessage: 'Request timeout' })).toBe('timeout');
  });

  it('returns "timeout" for message containing "timed out"', () => {
    expect(inferErrorKind({ errorMessage: 'Connection timed out' })).toBe('timeout');
  });

  it('returns "timeout" for message containing "abort"', () => {
    expect(inferErrorKind({ errorMessage: 'AbortError: request aborted' })).toBe('timeout');
  });

  // ── dns ───────────────────────────────────────────────────────────────────

  it('returns "dns" for message containing "dns"', () => {
    expect(inferErrorKind({ errorMessage: 'DNS lookup failed' })).toBe('dns');
  });

  it('returns "dns" for message containing "enotfound"', () => {
    expect(inferErrorKind({ errorMessage: 'ENOTFOUND api.example.com' })).toBe('dns');
  });

  it('returns "dns" for message containing "getaddrinfo"', () => {
    expect(inferErrorKind({ errorMessage: 'getaddrinfo ENOTFOUND host' })).toBe('dns');
  });

  it('returns "dns" for message containing "name not resolved"', () => {
    expect(inferErrorKind({ errorMessage: 'Name not resolved: host.example.com' })).toBe('dns');
  });

  // ── network ───────────────────────────────────────────────────────────────

  it('returns "network" for message containing "network"', () => {
    expect(inferErrorKind({ errorMessage: 'Network error occurred' })).toBe('network');
  });

  it('returns "network" for message containing "fetch failed"', () => {
    expect(inferErrorKind({ errorMessage: 'TypeError: fetch failed' })).toBe('network');
  });

  it('returns "network" for message containing "econnrefused"', () => {
    expect(inferErrorKind({ errorMessage: 'ECONNREFUSED 127.0.0.1:5432' })).toBe('network');
  });

  it('returns "network" for message containing "ssl"', () => {
    expect(inferErrorKind({ errorMessage: 'SSL handshake failed' })).toBe('network');
  });

  // ── auth ──────────────────────────────────────────────────────────────────

  it('returns "auth" for HTTP 401', () => {
    expect(inferErrorKind({ statusCode: 401 })).toBe('auth');
  });

  it('returns "auth" for HTTP 403', () => {
    expect(inferErrorKind({ statusCode: 403 })).toBe('auth');
  });

  it('returns "auth" for message containing "unauthorized"', () => {
    expect(inferErrorKind({ errorMessage: 'Unauthorized access denied' })).toBe('auth');
  });

  it('returns "auth" for message containing "forbidden"', () => {
    expect(inferErrorKind({ errorMessage: 'Forbidden: insufficient permissions' })).toBe('auth');
  });

  it('returns "auth" for message containing "invalid token"', () => {
    expect(inferErrorKind({ errorMessage: 'invalid token provided' })).toBe('auth');
  });

  it('returns "auth" for message containing "expired token"', () => {
    expect(inferErrorKind({ errorMessage: 'expired token — please re-login' })).toBe('auth');
  });

  // ── http (non-401/403 >= 400) ─────────────────────────────────────────────

  it('returns "http" for HTTP 404 (no matching message)', () => {
    expect(inferErrorKind({ statusCode: 404 })).toBe('http');
  });

  it('returns "http" for HTTP 500', () => {
    expect(inferErrorKind({ statusCode: 500 })).toBe('http');
  });

  it('returns "http" for HTTP 422', () => {
    expect(inferErrorKind({ statusCode: 422 })).toBe('http');
  });

  // ── config ────────────────────────────────────────────────────────────────

  it('returns "config" for message containing "config"', () => {
    expect(inferErrorKind({ errorMessage: 'config error: missing field' })).toBe('config');
  });

  it('returns "config" for message containing "missing url"', () => {
    expect(inferErrorKind({ errorMessage: 'Missing URL in connection config' })).toBe('config');
  });

  it('returns "config" for message containing "missing key"', () => {
    expect(inferErrorKind({ errorMessage: 'Missing key: API_KEY not set' })).toBe('config');
  });

  // ── unknown (fallback) ────────────────────────────────────────────────────

  it('returns "unknown" when nothing matches', () => {
    expect(inferErrorKind({ errorMessage: 'Something went wrong' })).toBe('unknown');
    expect(inferErrorKind({})).toBe('unknown');
    expect(inferErrorKind({ errorMessage: null, statusCode: null })).toBe('unknown');
  });

  it('returns "unknown" for empty string message', () => {
    expect(inferErrorKind({ errorMessage: '' })).toBe('unknown');
  });
});
