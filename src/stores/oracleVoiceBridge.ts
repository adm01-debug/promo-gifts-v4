/**
 * Shared state between Voice Agent and Flow IA.
 * Allows voice commands to open the Flow chat and send messages.
 */
import { create } from 'zustand';

interface OracleVoiceBridge {
  /** Whether the Flow dialog should be open */
  isOracleOpen: boolean;
  /** Pending message to send when oracle opens */
  pendingMessage: string | null;
  /** Open oracle and optionally send a message */
  openOracle: (message?: string) => void;
  /** Close oracle */
  closeOracle: () => void;
  /** Consume the pending message (called by oracle after sending) */
  consumePendingMessage: () => void;
}

export const useOracleVoiceBridge = create<OracleVoiceBridge>((set) => ({
  isOracleOpen: false,
  pendingMessage: null,
  openOracle: (message?: string) => set({ isOracleOpen: true, pendingMessage: message || null }),
  closeOracle: () => set({ isOracleOpen: false, pendingMessage: null }),
  consumePendingMessage: () => set({ pendingMessage: null }),
}));
