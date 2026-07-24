/**
 * Ambient type declarations for `canvas-confetti` (v1.9.x).
 *
 * The package ships no bundled types and `@types/canvas-confetti` is not a
 * dependency here, so the default import resolved to `any` (TS7016). These
 * declarations mirror the real public API as the single source of truth,
 * following the same pattern as `jspdf-autotable.d.ts`.
 */
declare module 'canvas-confetti' {
  interface Origin {
    x?: number;
    y?: number;
  }

  interface Options {
    particleCount?: number;
    angle?: number;
    spread?: number;
    startVelocity?: number;
    decay?: number;
    gravity?: number;
    drift?: number;
    flat?: boolean;
    ticks?: number;
    origin?: Origin;
    colors?: string[];
    shapes?: Array<Shape | 'circle' | 'square' | 'star'>;
    scalar?: number;
    zIndex?: number;
    disableForReducedMotion?: boolean;
  }

  interface GlobalOptions {
    resize?: boolean;
    useWorker?: boolean;
    disableForReducedMotion?: boolean;
  }

  type Shape =
    | { type: 'bitmap'; bitmap: ImageBitmap; matrix?: DOMMatrix }
    | { type: 'path'; path: string; matrix?: DOMMatrix };

  type CreateTypes = (options?: Options) => Promise<null> | null;

  interface ConfettiFunction {
    (options?: Options): Promise<null> | null;
    reset: () => void;
    create: (canvas: HTMLCanvasElement, options?: GlobalOptions) => CreateTypes;
    shapeFromPath: (options: { path: string; matrix?: DOMMatrix }) => Shape;
    shapeFromText: (options: {
      text: string;
      scalar?: number;
      color?: string;
      fontFamily?: string;
    }) => Shape;
  }

  const confetti: ConfettiFunction;
  export default confetti;
}
