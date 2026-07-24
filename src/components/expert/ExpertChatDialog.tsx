/**
 * ExpertChatDialog — Refactored to compose smaller components
 * Original: 1418 lines → Now: ~80 lines (orchestrator only)
 */
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { FlowFilterPanel } from './FlowFilterPanel';
import { useExpertChat } from './chat/useExpertChat';
import { ChatHeader } from './chat/ChatHeader';
import { ChatHistoryPanel } from './chat/ChatHistoryPanel';
import { ChatMessageList } from './chat/ChatMessageList';
import { ChatInputBar } from './chat/ChatInputBar';

interface ExpertChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  clientId?: string;
  clientName?: string;
  initialMessage?: string | null;
}

export function ExpertChatDialog({
  isOpen,
  onClose,
  clientId,
  clientName,
  initialMessage,
}: ExpertChatDialogProps) {
  const chat = useExpertChat({ isOpen, onClose, clientId, clientName, initialMessage });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[100dvh] max-w-full flex-col gap-0 overflow-hidden rounded-none border-0 p-0 shadow-xl sm:h-[640px] sm:max-w-[480px] sm:rounded-3xl sm:border sm:border-border/50 [&>button.absolute]:hidden">
        <FlowFilterPanel
          isOpen={chat.showFilters}
          onClose={() => chat.setShowFilters(false)}
          filters={chat.flowFilters}
          onFiltersChange={chat.setFlowFilters}
          options={chat.filterOptions}
          autoPlayTts={chat.autoPlayTts}
          onAutoPlayTtsChange={chat.handleToggleAutoPlayTts}
          activeFiltersCount={chat.activeFiltersCount}
          onReset={chat.resetFilters}
        />

        <ChatHeader
          clientName={clientName}
          activeFiltersCount={chat.activeFiltersCount}
          flowFilters={chat.flowFilters}
          setFlowFilters={chat.setFlowFilters}
          showHistory={chat.showHistory}
          onToggleHistory={() => {
            chat.setShowHistory(!chat.showHistory);
            chat.setHistorySearch('');
          }}
          onNewConversation={chat.startNewConversation}
          onOpenFilters={() => chat.setShowFilters(true)}
          onClose={onClose}
        />

        {chat.showHistory ? (
          <ChatHistoryPanel
            conversations={chat.conversations}
            isLoading={chat.isLoadingConversations}
            historySearch={chat.historySearch}
            onSearchChange={chat.setHistorySearch}
            historyDateFilter={chat.historyDateFilter}
            onDateFilterChange={chat.setHistoryDateFilter}
            currentConversationId={chat.currentConversationId}
            onLoadConversation={chat.loadConversation}
            onDeleteConversation={chat.handleDeleteConversation}
          />
        ) : (
          <>
            <ChatMessageList
              messages={chat.messages}
              isLoading={chat.isLoading}
              isFromVoice={chat.isFromVoice}
              thinkingMessage={chat.thinkingMessage}
              showScrollDown={chat.showScrollDown}
              sellerFirstName={chat.sellerFirstName}
              clientId={clientId}
              clientName={clientName}
              conversationsCount={chat.conversations.length}
              scrollRef={chat.scrollRef}
              onScroll={chat.handleScroll}
              onScrollToBottom={chat.scrollToBottom}
              onAutoSend={chat.handleAutoSend}
              onShowHistory={() => chat.setShowHistory(true)}
              playingTtsId={chat.playingTtsId}
              pausedTtsId={chat.pausedTtsId}
              loadingTtsId={chat.loadingTtsId}
              ttsErrorId={chat.ttsErrorId}
              copiedId={chat.copiedId}
              savingQuoteId={chat.savingQuoteId}
              onCopy={chat.handleCopy}
              onSaveAsQuote={chat.handleSaveAsQuote}
              onPlayTts={chat.handlePlayTts}
              onPauseTts={chat.handlePauseTts}
              onStopTts={chat.stopTts}
              onRetry={chat.handleRetry}
            />
            <ChatInputBar
              input={chat.input}
              setInput={chat.setInput}
              isLoading={chat.isLoading}
              inputRef={chat.inputRef}
              isFromVoiceRef={chat.isFromVoiceRef}
              onKeyDown={chat.handleKeyDown}
              onSend={chat.sendMessage}
              onStopGenerating={chat.handleStopGenerating}
              setIsFromVoice={() => {}}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
