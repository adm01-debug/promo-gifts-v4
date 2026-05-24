/**
 * Browser API type extensions.
 * Eliminates (window as any) patterns for vendor-prefixed APIs.
 */

interface Window {
  webkitAudioContext?: typeof AudioContext;
  /** Web Speech API (standard + webkit prefix) */
  SpeechRecognition: typeof SpeechRecognition;
  webkitSpeechRecognition: typeof SpeechRecognition;
  /** Safari standalone mode detection */
  navigator: Navigator & {
    standalone?: boolean;
  };
}

interface Navigator {
  /** Device memory in GB (Chrome/Edge only) */
  deviceMemory?: number;
  /** Safari standalone mode */
  standalone?: boolean;
}

/**
 * Web Speech API recognizer types.
 * Absent from lib.dom in the TypeScript version used here, so declared once
 * globally as the single source of truth (replaces scattered, conflicting
 * per-file `declare global` blocks). Shape is a superset compatible with every
 * consumer's local usage (maxAlternatives, onspeechend, permissive onerror).
 */
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  onspeechend: (() => void) | null;
}

declare var SpeechRecognition: {
  prototype: SpeechRecognition;
  new (): SpeechRecognition;
};
