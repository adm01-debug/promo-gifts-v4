/**
 * Console Filter — Silencia warnings conhecidos e poluição visual no console.
 * 
 * Silencia:
 * - React Router v7 Future Flag warning.
 * - Prewarm skip logs (cold-start bridge).
 * - Erros de manifest.json 401 (comuns na extensão Lovable).
 * - PostMessage origin mismatches (comuns no preview).
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
  ];

  const SILENCED_ERRORS = [
    'manifest.json',
    'failed, code 401',
    'Failed to load resource: the server responded with a status of 401',
  ];

  console.warn = (...args: any[]) => {
    const msg = args[0];
    if (typeof msg === 'string' && SILENCED_WARNINGS.some(pattern => msg.includes(pattern))) {
      return;
    }
    originalWarn.apply(console, args);
  };

  console.error = (...args: any[]) => {
    const msg = args[0];
    if (typeof msg === 'string' && SILENCED_ERRORS.some(pattern => msg.includes(pattern))) {
      return;
    }
    originalError.apply(console, args);
  };
})();
