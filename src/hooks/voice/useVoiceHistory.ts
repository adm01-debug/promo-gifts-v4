/**
 * useVoiceHistory — Stores recent voice commands in localStorage for quick reference.
 */
import { useState, useCallback, useEffect } from 'react';
import type { VoiceAgentAction } from '@/hooks/voice/types';

export interface VoiceHistoryEntry {
  transcript: string;
  action: VoiceAgentAction;
  timestamp: number;
}

const STORAGE_KEY = 'voice_command_history';
const MAX_ENTRIES = 5;

function loadHistory(): VoiceHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as VoiceHistoryEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_ENTRIES) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: VoiceHistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    /* quota exceeded — ignore */
  }
}

export function useVoiceHistory() {
  const [history, setHistory] = useState<VoiceHistoryEntry[]>(loadHistory);

  // Sync across tabs
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setHistory(loadHistory());
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const addEntry = useCallback((transcript: string, action: VoiceAgentAction) => {
    setHistory((prev) => {
      const entry: VoiceHistoryEntry = { transcript, action, timestamp: Date.now() };
      // Deduplicate by transcript
      const filtered = prev.filter((e) => e.transcript.toLowerCase() !== transcript.toLowerCase());
      const next = [entry, ...filtered].slice(0, MAX_ENTRIES);
      saveHistory(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { history, addEntry, clearHistory };
}
