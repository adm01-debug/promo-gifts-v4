/**
 * Console Filter — Silencia warnings conhecidos e poluição visual no console.
 */
(function installConsoleFilter() {
  if (typeof window === 'undefined') return;

  const originalWarn = console.warn;
  const originalError = console.error;

  const SILENCED_WARNINGS = [
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
    '[CloudStatus] state change',
    '[Telemetry] performance',
    '[Performance] Route',
  ];

  const SILENCED_ERRORS = [
    'manifest.json',
    'failed, code 401',
    'Failed to load resource: the server responded with a status of 401',
  ];

  console.warn = (...args: any[]) => {
    try {
      const firstArg = args[0];
      const msg = typeof firstArg === 'string' ? firstArg : JSON.stringify(firstArg);
      if (SILENCED_WARNINGS.some(pattern => msg && msg.includes(pattern))) {
        return;
      }
    } catch (e) {
      // Fallback
    }
    return originalWarn.apply(console, args);
  };

  console.error = (...args: any[]) => {
    try {
      const firstArg = args[0];
      const msg = typeof firstArg === 'string' ? firstArg : JSON.stringify(firstArg);
      if (SILENCED_ERRORS.some(pattern => msg && msg.includes(pattern))) {
        return;
      }
    } catch (e) {
      // Fallback
    }
    return originalError.apply(console, args);
  };
})();

