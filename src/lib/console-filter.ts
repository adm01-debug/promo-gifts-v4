/**
 * Console Filter — Silencia warnings conhecidos e poluição visual no console.
 */
/* eslint-disable no-console */
(function installConsoleFilter() {
  if (typeof window === 'undefined') return;

  const originalWarn = console.warn;
  const originalError = console.error;
  const originalLog = console.log;

  const SILENCED_PATTERNS = [
    'React Router Future Flag Warning',
    'v7_startTransition',
    'postMessage',
    'target origin provided',
    'prewarm skip',
    'prewarm',
    'SkeletonMonitor',
    'SkeletonMonitor.tsx',
    'threshold: 1500ms',
    'Skeleton-Trace',
    'aponta para projeto não-canônico',
    '[Performance] Skeleton',
    '[CloudStatus]',
    '[Telemetry] performance',
    '[Performance] Route',
    'manifest.json',
    'failed, code 401',
    'Failed to load resource: the server responded with a status of 401',
  ];

  const shouldSilence = (args: unknown[]) => {
    try {
      const first = args[0];
      const msg = typeof first === 'string' ? first : JSON.stringify(first);
      return SILENCED_PATTERNS.some((pattern) => msg?.includes(pattern));
    } catch {
      return false;
    }
  };

  console.warn = (...args: unknown[]) => {
    if (shouldSilence(args)) return;
    return originalWarn.apply(console, args as Parameters<typeof originalWarn>);
  };

  console.error = (...args: unknown[]) => {
    if (shouldSilence(args)) return;
    return originalError.apply(console, args as Parameters<typeof originalError>);
  };

  console.log = (...args: unknown[]) => {
    if (shouldSilence(args)) return;
    return originalLog.apply(console, args as Parameters<typeof originalLog>);
  };
})();
