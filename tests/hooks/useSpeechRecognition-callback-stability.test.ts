/**
 * BUG-20 Regression Test — useSpeechRecognition
 *
 * Verifica que a instância SpeechRecognition NÃO é recriada quando os callbacks
 * onResult/onError mudam (regressão de callbacks instáveis nas deps do useEffect).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSpeechRecognition } from '@/hooks/intelligence/useSpeechRecognition';

// Mock do SpeechRecognition
class MockSpeechRecognition {
  static instances: MockSpeechRecognition[] = [];
  continuous = false;
  interimResults = false;
  lang = '';
  onstart: (() => void) | null = null;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  aborted = false;

  constructor() {
    MockSpeechRecognition.instances.push(this);
  }

  start() {}
  stop() {}
  abort() {
    this.aborted = true;
  }
}

describe('useSpeechRecognition — BUG-20: estabilidade de callbacks', () => {
  beforeEach(() => {
    MockSpeechRecognition.instances = [];
    Object.defineProperty(window, 'SpeechRecognition', {
      writable: true,
      configurable: true,
      value: MockSpeechRecognition,
    });
    Object.defineProperty(window, 'webkitSpeechRecognition', {
      writable: true,
      configurable: true,
      value: undefined,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('não recria a instância SpeechRecognition quando onResult muda', () => {
    const onResult1 = vi.fn();
    const onResult2 = vi.fn();

    const { rerender } = renderHook(
      ({ onResult }) => useSpeechRecognition({ onResult }),
      { initialProps: { onResult: onResult1 } },
    );

    const instancesAfterMount = MockSpeechRecognition.instances.length;

    // Muda a referência do callback (simula inline callback no pai)
    rerender({ onResult: onResult2 });

    // BUG-20: antes do fix, o useEffect recriava a instância, gerando uma nova
    expect(MockSpeechRecognition.instances.length).toBe(instancesAfterMount);
  });

  it('não recria a instância SpeechRecognition quando onError muda', () => {
    const onError1 = vi.fn();
    const onError2 = vi.fn();

    const { rerender } = renderHook(
      ({ onError }) => useSpeechRecognition({ onError }),
      { initialProps: { onError: onError1 } },
    );

    const instancesAfterMount = MockSpeechRecognition.instances.length;
    rerender({ onError: onError2 });

    expect(MockSpeechRecognition.instances.length).toBe(instancesAfterMount);
  });

  it('usa sempre o onResult mais recente ao disparar resultado', () => {
    const onResult1 = vi.fn();
    const onResult2 = vi.fn();

    const { result, rerender } = renderHook(
      ({ onResult }) => useSpeechRecognition({ onResult }),
      { initialProps: { onResult: onResult1 } },
    );

    // Atualiza callback ANTES de simular resultado
    rerender({ onResult: onResult2 });

    // Simula evento de resultado final na instância existente
    const instance = MockSpeechRecognition.instances[0];
    if (instance?.onresult) {
      instance.onresult({
        resultIndex: 0,
        results: [
          Object.assign([{ transcript: 'olá mundo' }], { isFinal: true }),
        ],
      });
    }

    // Deve ter chamado o callback MAIS RECENTE, não o original
    expect(onResult2).toHaveBeenCalledWith('olá mundo');
    expect(onResult1).not.toHaveBeenCalled();
  });

  it('recria instância apenas quando language muda', () => {
    const { rerender } = renderHook(
      ({ language }) => useSpeechRecognition({ language }),
      { initialProps: { language: 'pt-BR' } },
    );

    const countAfterMount = MockSpeechRecognition.instances.length;

    // Mudança de language SIM deve recriar (dependência legítima)
    rerender({ language: 'en-US' });

    expect(MockSpeechRecognition.instances.length).toBeGreaterThan(countAfterMount);
  });
});
