// TZ: forçado via vitest.config.ts test.env (passa aos workers no spawn).
// Setar process.env.TZ aqui NÃO FUNCIONA — Date.prototype.toLocaleString
// cacheia TZ na startup do worker, antes deste setup file rodar.

// CI/local test mode: stub VITE_SUPABASE_URL e KEY pra evitar erro
// "supabaseUrl is required" no IMPORT do supabase client em src/integrations/supabase/client.ts.
// Em produção essas vars vêm do env real (.env / Vercel / GitHub Secrets).
// Mantém fail-fast em prod ao não tocar no client gerado.
import { vi } from 'vitest';
vi.stubEnv('VITE_SUPABASE_URL', process.env.VITE_SUPABASE_URL || 'http://localhost:54321');
vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature');

import '@testing-library/jest-dom';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, expect } from 'vitest';
import { toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

// RTL waitFor/findBy default é 1000ms — curto demais p/ portais Radix sob carga paralela
// da suíte (2 vThreads). Eleva o teto de espera assíncrona globalmente; sem custo p/
// asserções que já passam (o teto só conta enquanto o waitFor reexecuta).
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  cleanup();
});

// Mock do window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  }),
});

// Mock do IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() { return []; }
  unobserve() {}
} as any;

// Mock do ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any;

// Stub de WebSocket: o Supabase Realtime (.channel()) abre uma conexão real
// via undici quando componentes/hooks com realtime são montados em testes.
// O undici tenta dispatchEvent com um Event incompatível com o jsdom, lançando
// "TypeError: The 'event' argument must be an instance of Event" como uncaught
// exception (vitest reporta como unhandled error e pode causar falso-positivo).
// Substituímos por um stub no-op que nunca conecta — testes não dependem de
// realtime; quem precisar pode mockar explicitamente.
global.WebSocket = class WebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;
  readyState = 3; // CLOSED — nunca "conecta"
  url = '';
  onopen: ((ev: unknown) => void) | null = null;
  onclose: ((ev: unknown) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: unknown) => void) | null = null;
  constructor(url?: string | URL) {
    this.url = url ? String(url) : '';
  }
  send() {}
  close() {}
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() {
    return true;
  }
} as unknown as typeof WebSocket;

// Mock do window.scrollTo (jsdom não implementa)
// Necessário para testes que usam createMemoryRouter + back/forward navigation
// (React Router chama scrollTo internamente para restaurar scroll position).
// Sem este mock, testes de SidebarNavGroup.history/suspense falhavam em CI.
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
Element.prototype.scrollTo = vi.fn() as unknown as Element['scrollTo'];

// Fix: @remix-run/router cria objetos Request com AbortSignal durante navegação.
// Em Node.js 20+, o construtor nativo de Request (undici) verifica
// `signal instanceof AbortSignal` usando a classe interna do undici, enquanto
// o jsdom fornece sua própria implementação de AbortController que produz sinais
// incompatíveis. Fazemos um patch do construtor global de Request para ignorar
// o signal (suficiente para testes de estado visual que não usam loaders).
if (typeof globalThis.Request !== 'undefined') {
  let needsPatch = false;
  try {
    new globalThis.Request('http://localhost/', { signal: new AbortController().signal });
  } catch (e) {
    if (e instanceof TypeError && String(e).includes('AbortSignal')) {
      needsPatch = true;
    }
  }
  if (needsPatch) {
    const _NativeRequest = globalThis.Request;
    const _PatchedRequest = new Proxy(_NativeRequest, {
      construct(target, [input, init]: [RequestInfo | URL, RequestInit | undefined]) {
        if (init?.signal) {
          const { signal: _s, ...rest } = init;
          return new target(input, rest as RequestInit);
        }
        return new target(input, init);
      },
    });
    // @ts-expect-error Overriding Request to fix jsdom/undici AbortSignal incompatibility
    globalThis.Request = _PatchedRequest;
  }
}
