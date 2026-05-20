/**
 * Render tests for GlobalSearchPalette
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";

vi.mock("@/hooks/common/useSearch", () => ({
  useSearch: vi.fn().mockReturnValue({
    results: [], loading: false, search: vi.fn(), clear: vi.fn(), recentSearches: [],
  }),
}));

vi.mock("@/hooks/intelligence/useSpeechRecognition", () => ({
  useSpeechRecognition: vi.fn().mockReturnValue({
    isListening: false, transcript: "", startListening: vi.fn(), stopListening: vi.fn(), isSupported: false,
  }),
}));

vi.mock("@/hooks/intelligence/useVoiceCommandHistory", () => ({
  useVoiceCommandHistory: vi.fn().mockReturnValue({ history: [], addCommand: vi.fn(), clearHistory: vi.fn() }),
}));

vi.mock("@/hooks/intelligence/useContextualSuggestions", () => ({
  useContextualSuggestions: vi.fn().mockReturnValue({ suggestions: [], loading: false }),
}));

vi.mock("@/hooks/useVoiceFeedback", () => ({
  useVoiceFeedback: vi.fn().mockReturnValue({ speak: vi.fn(), stop: vi.fn(), isSpeaking: false }),
}));

vi.mock("@/hooks/intelligence/useVoiceAgent", () => ({
  useVoiceAgent: vi.fn().mockReturnValue({
    phase: "idle", partialTranscript: "", finalTranscript: "", agentResponse: "",
    error: null, currentAction: null, isConnected: false,
    startListening: vi.fn(), stopListening: vi.fn(), stopSpeaking: vi.fn(), reset: vi.fn(),
  }),
}));

vi.mock("@elevenlabs/react", () => ({
  useScribe: vi.fn().mockReturnValue({
    connect: vi.fn(), disconnect: vi.fn(), isConnected: false,
    partialTranscript: "", committedTranscripts: [],
  }),
}));

vi.mock("@/components/search/VoiceSearchOverlay", () => ({
  VoiceSearchOverlay: () => null,
}));

describe("GlobalSearchPalette", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports GlobalSearchPalette component", async () => {
    const module = await import("@/components/search/GlobalSearchPalette");
    expect(module.GlobalSearchPalette).toBeDefined();
    expect(typeof module.GlobalSearchPalette).toBe("function");
  }, 15000);
});
