import { useState, useCallback, useMemo, useEffect } from 'react';

import { logger } from '@/lib/logger';
export interface VoiceCommandRecord {
  id: string;
  command: string;
  normalizedCommand: string;
  timestamp: Date;
  type: 'filter' | 'search' | 'navigation' | 'sort' | 'clear' | 'unknown';
  successful: boolean;
}

interface CommandPattern {
  command: string;
  count: number;
  lastUsed: Date;
  type: VoiceCommandRecord['type'];
}

interface UseVoiceCommandHistoryReturn {
  history: VoiceCommandRecord[];
  patterns: CommandPattern[];
  frequentCommands: CommandPattern[];
  recentCommands: VoiceCommandRecord[];
  addCommand: (command: string, type: VoiceCommandRecord['type'], successful?: boolean) => void;
  clearHistory: () => void;
  removeCommand: (id: string) => void;
  getSuggestions: (partial?: string) => CommandPattern[];
}

const STORAGE_KEY = 'voice-command-history';
const MAX_HISTORY = 100;
const RECENT_LIMIT = 5;
const FREQUENT_LIMIT = 6;

const normalizeCommand = (command: string): string => {
  return command
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const detectCommandType = (command: string): VoiceCommandRecord['type'] => {
  const normalized = normalizeCommand(command);

  if (/^(limpar|resetar|remover filtros|limpar tudo)/.test(normalized)) {
    return 'clear';
  }
  if (/^(ir para|abrir|navegar|mostrar pagina)/.test(normalized)) {
    return 'navigation';
  }
  if (/(ordenar|ordem|mais barato|mais caro|alfabetica)/.test(normalized)) {
    return 'sort';
  }
  if (/(filtrar|buscar|mostrar|encontrar|quero|preciso)/.test(normalized)) {
    return 'filter';
  }

  return 'search';
};

export const useVoiceCommandHistory = (): UseVoiceCommandHistoryReturn => {
  const [history, setHistory] = useState<VoiceCommandRecord[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.map(
          (item: { transcript?: string; command?: string; timestamp?: string; type?: string }) => ({
            ...item,
            timestamp: item.timestamp ? new Date(item.timestamp) : new Date(),
          }),
        );
      }
    } catch (error) {
      logger.error('Error loading voice command history:', error);
    }
    return [];
  });

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      logger.error('Error saving voice command history:', error);
    }
  }, [history]);

  const addCommand = useCallback(
    (command: string, type?: VoiceCommandRecord['type'], successful = true) => {
      const normalizedCommand = normalizeCommand(command);
      const detectedType = type || detectCommandType(command);

      const newRecord: VoiceCommandRecord = {
        id: crypto.randomUUID(),
        command,
        normalizedCommand,
        timestamp: new Date(),
        type: detectedType,
        successful,
      };

      setHistory((prev) => {
        const updated = [newRecord, ...prev].slice(0, MAX_HISTORY);
        return updated;
      });
    },
    [],
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const removeCommand = useCallback((id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // Analyze patterns from history
  const patterns = useMemo((): CommandPattern[] => {
    const patternMap = new Map<string, CommandPattern>();

    history.forEach((record) => {
      if (!record.successful) return;

      const key = record.normalizedCommand;
      const existing = patternMap.get(key);

      if (existing) {
        existing.count += 1;
        if (record.timestamp > existing.lastUsed) {
          existing.lastUsed = record.timestamp;
        }
      } else {
        patternMap.set(key, {
          command: record.command,
          count: 1,
          lastUsed: record.timestamp,
          type: record.type,
        });
      }
    });

    return Array.from(patternMap.values()).sort((a, b) => {
      // Score based on frequency and recency
      const now = Date.now();
      const aRecency = 1 / (1 + (now - a.lastUsed.getTime()) / (1000 * 60 * 60 * 24));
      const bRecency = 1 / (1 + (now - b.lastUsed.getTime()) / (1000 * 60 * 60 * 24));

      const aScore = a.count * 0.7 + aRecency * 10 * 0.3;
      const bScore = b.count * 0.7 + bRecency * 10 * 0.3;

      return bScore - aScore;
    });
  }, [history]);

  // Get most frequent commands
  const frequentCommands = useMemo((): CommandPattern[] => {
    return patterns.filter((p) => p.count >= 2).slice(0, FREQUENT_LIMIT);
  }, [patterns]);

  // Get recent unique commands
  const recentCommands = useMemo((): VoiceCommandRecord[] => {
    const seen = new Set<string>();
    return history
      .filter((record) => {
        if (seen.has(record.normalizedCommand)) return false;
        seen.add(record.normalizedCommand);
        return true;
      })
      .slice(0, RECENT_LIMIT);
  }, [history]);

  // Get suggestions based on partial input
  const getSuggestions = useCallback(
    (partial?: string): CommandPattern[] => {
      if (!partial) {
        return frequentCommands;
      }

      const normalizedPartial = normalizeCommand(partial);

      return patterns
        .filter((p) => normalizeCommand(p.command).includes(normalizedPartial))
        .slice(0, FREQUENT_LIMIT);
    },
    [patterns, frequentCommands],
  );

  return {
    history,
    patterns,
    frequentCommands,
    recentCommands,
    addCommand,
    clearHistory,
    removeCommand,
    getSuggestions,
  };
};
