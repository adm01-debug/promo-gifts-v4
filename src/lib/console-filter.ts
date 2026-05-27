/**
 * Console Filter — Silencia warnings conhecidos e poluição visual no console.
 */
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

  const shouldSilence = (args: any[]) => {
    try {
      const msg = typeof args[0] === 'string' ? args[0] : JSON.stringify(args[0]);
      return SILENCED_PATTERNS.some(pattern => msg && msg.includes(pattern));
    } catch (e) {
      return false;
    }
  };

  console.warn = (...args: any[]) => {
    if (shouldSilence(args)) return;
    return originalWarn.apply(console, args);
  };

  console.error = (...args: any[]) => {
    if (shouldSilence(args)) return;
    return originalError.apply(console, args);
  };

  console.log = (...args: any[]) => {
    if (shouldSilence(args)) return;
    return originalLog.apply(console, args);
  };
})();
