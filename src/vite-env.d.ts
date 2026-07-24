/// <reference types="vite/client" />

declare module 'canvas-confetti' {
  interface Options {
    particleCount?: number;
    spread?: number;
    origin?: { x?: number; y?: number };
    colors?: string[];
    [key: string]: unknown;
  }
  function confetti(options?: Options): Promise<null> | null;
  export = confetti;
}
