import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSpeechRecognition } from '@/hooks/intelligence/useSpeechRecognition';

describe('useSpeechRecognition', () => {
  it('should return speech recognition state', () => {
    const { result } = renderHook(() => useSpeechRecognition());
    
    expect(result.current).toBeDefined();
    expect(typeof result.current.isListening).toBe('boolean');
    expect(typeof result.current.isSupported).toBe('boolean');
    expect(typeof result.current.startListening).toBe('function');
    expect(typeof result.current.stopListening).toBe('function');
  });
});
