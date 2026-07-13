/**
 * mockStructuredLogger — helper reutilizável para testes de telemetria.
 *
 * Substitui `@/lib/telemetry/structuredLogger` por uma implementação in-memory
 * que empurra cada chamada (`info`/`warn`/`error`/`debug`) num array capturável
 * do teste, evitando dependência frágil de `console.*` spies (que sofrem com
 * retries do Vitest, formatação DEV/PROD e re-mocks).
 *
 * Uso típico:
 *
 * ```ts
 * // Precisa ser factory async porque `vi.mock` é hoisted acima dos imports.
 * // Só assim conseguimos referenciar o singleton do helper.
 * vi.mock('@/lib/telemetry/structuredLogger', async () => {
 *   const mod = await import('@/test/mockStructuredLogger');
 *   return mod.structuredLoggerMockFactory();
 * });
 *
 * import {
 *   resetStructuredLoggerMock,
 *   findLoggerEvent,
 *   filterLoggerEvents,
 *   structuredLoggerMockEvents,
 * } from '@/test/mockStructuredLogger';
 *
 * beforeEach(() => resetStructuredLoggerMock());
 *
 * it('emite delete_ok', () => {
 *   // ... roda o código ...
 *   const ev = findLoggerEvent('seller_cart.restore', 'delete_ok');
 *   expect(ev?.fields).toMatchObject({ hydrated: true });
 * });
 * ```
 *
 * O buffer é um singleton no escopo do módulo. O Vitest isola módulos por
 * arquivo de teste (`isolate: true` default), então cada `*.test.tsx`
 * enxerga a sua própria instância — não há vazamento cruzado.
 */

export type LogLevel = 'debug' | 'error' | 'info' | 'warn';

export interface CapturedLogEvent {
  level: LogLevel;
  scope: string;
  event: string;
  fields: Record<string, unknown>;
}

// Buffer singleton por módulo (isolado por arquivo de teste no Vitest).
const events: CapturedLogEvent[] = [];

/** Array capturado pelos loggers mockados. Mesma referência entre chamadas. */
export const structuredLoggerMockEvents: readonly CapturedLogEvent[] = events;

/** Zera o buffer — chamar em `beforeEach` para isolar casos. */
export function resetStructuredLoggerMock(): void {
  events.length = 0;
}

/** Retorna o PRIMEIRO evento que casa `(scope, event)` ou `undefined`. */
export function findLoggerEvent(
  scope: string,
  event: string,
): CapturedLogEvent | undefined {
  return events.find((e) => e.scope === scope && e.event === event);
}

/** Retorna TODOS os eventos que casam `(scope, event)` — útil para checar ordem. */
export function filterLoggerEvents(
  scope: string,
  event: string,
): CapturedLogEvent[] {
  return events.filter((e) => e.scope === scope && e.event === event);
}

/** Retorna todos os eventos de um scope, preservando a ordem de emissão. */
export function findLoggerEventsByScope(scope: string): CapturedLogEvent[] {
  return events.filter((e) => e.scope === scope);
}

/**
 * Factory que devolve o shape do módulo `structuredLogger` mockado.
 * Passe a `vi.mock(..., async () => (await import(...)).structuredLoggerMockFactory())`.
 */
export function structuredLoggerMockFactory(): {
  createClientLogger: (scope: string) => {
    scope: string;
    requestId: string;
    info: (event: string, fields?: Record<string, unknown>) => void;
    warn: (event: string, fields?: Record<string, unknown>) => void;
    error: (event: string, fields?: Record<string, unknown>) => void;
    debug: (event: string, fields?: Record<string, unknown>) => void;
    child: (subScope: string, extra?: Record<string, unknown>) => unknown;
    headers: () => Record<string, string>;
  };
} {
  const push = (level: LogLevel, scope: string, event: string, fields: Record<string, unknown> = {}) => {
    events.push({ level, scope, event, fields });
  };
  const build = (scope: string): ReturnType<typeof structuredLoggerMockFactory>['createClientLogger'] extends (s: string) => infer R ? R : never => ({
    scope,
    requestId: 'test-request-id',
    info: (event, fields) => push('info', scope, event, fields),
    warn: (event, fields) => push('warn', scope, event, fields),
    error: (event, fields) => push('error', scope, event, fields),
    debug: (event, fields) => push('debug', scope, event, fields),
    child: (sub: string) => build(`${scope}.${sub}`),
    headers: () => ({}),
  });
  return { createClientLogger: (scope: string) => build(scope) };
}
