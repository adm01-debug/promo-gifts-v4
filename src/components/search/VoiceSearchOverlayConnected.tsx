/**
 * VoiceSearchOverlayConnected — Self-contained voice overlay with built-in useVoiceAgent.
 * Lazy-load this component so @elevenlabs/react (205KB) only loads when voice is activated.
 *
 * Usage:
 *   const LazyVoice = lazy(() => import("./VoiceSearchOverlayConnected"));
 *   {voiceOpen && <Suspense fallback={null}><LazyVoice isOpen onClose={...} onAction={...} /></Suspense>}
 */
import { useCallback } from 'react';
import { useVoiceAgent, type VoiceAgentAction } from '@/hooks/intelligence';
import { useVoiceHistory } from '@/hooks/voice/useVoiceHistory';
import { VoiceSearchOverlay } from './VoiceSearchOverlay';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAction?: (action: VoiceAgentAction) => void;
  onError?: (msg: string) => void;
}

function VoiceSearchOverlayConnected({ isOpen, onClose, onAction, onError }: Props) {
  const { history, addEntry } = useVoiceHistory();

  const handleAction = useCallback(
    (action: VoiceAgentAction) => {
      // Save to local history
      if (action.action !== 'answer') {
        addEntry(action.response, action);
      }
      onAction?.(action);
    },
    [addEntry, onAction],
  );

  const voice = useVoiceAgent({ onAction: handleAction, onError });

  const handleCommandSelect = useCallback(
    (command: string) => {
      voice.simulateCommand(command);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [voice.simulateCommand],
  );

  return (
    <VoiceSearchOverlay
      isOpen={isOpen}
      phase={voice.phase}
      partialTranscript={voice.partialTranscript}
      finalTranscript={voice.finalTranscript}
      agentResponse={voice.agentResponse}
      error={voice.error}
      recentCommands={history}
      currentAction={voice.currentAction}
      onClose={() => {
        onClose();
        voice.reset();
      }}
      onStartListening={voice.startListening}
      onStopListening={voice.stopListening}
      onStopSpeaking={voice.stopSpeaking}
      onCommandSelect={handleCommandSelect}
      onSimulateCommand={voice.simulateCommand}
    />
  );
}

export default VoiceSearchOverlayConnected;
