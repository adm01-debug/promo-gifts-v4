/**
2:  * Console Filter — Silencia warnings conhecidos e poluição visual no console.
3:  * 
4:  * Silencia:
5:  * - React Router v7 Future Flag warning.
6:  * - Prewarm skip logs (cold-start bridge).
7:  * - Erros de manifest.json 401 (comuns na extensão Lovable).
8:  * - PostMessage origin mismatches (comuns no preview).
9:  */
10: export function installConsoleFilter() {
11:   if (typeof window === 'undefined') return;
12: 
13:   const originalWarn = console.warn;
14:   const originalError = console.error;
15: 
16:   const SILENCED_WARNINGS = [
17:     'React Router Future Flag Warning',
18:     'v7_startTransition',
19:     'postMessage',
20:     'target origin provided',
21:   ];
22: 
23:   const SILENCED_ERRORS = [
24:     'manifest.json',
25:     'failed, code 401',
26:     'Failed to load resource: the server responded with a status of 401',
27:   ];
28: 
29:   console.warn = (...args: any[]) => {
30:     const msg = args[0];
31:     if (typeof msg === 'string' && SILENCED_WARNINGS.some(pattern => msg.includes(pattern))) {
32:       return;
33:     }
34:     originalWarn.apply(console, args);
35:   };
36: 
37:   console.error = (...args: any[]) => {
38:     const msg = args[0];
39:     if (typeof msg === 'string' && SILENCED_ERRORS.some(pattern => msg.includes(pattern))) {
40:       // Silencia poluição do manifest.json 401
41:       return;
42:     }
43:     originalError.apply(console, args);
44:   };
45: }
