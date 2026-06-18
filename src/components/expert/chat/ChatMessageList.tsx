import { m as motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  User,
  Loader2,
  Volume2,
  VolumeX,
  Pause,
  Play,
  Mic,
  Copy,
  Check,
  ArrowDown,
  RotateCcw,
  FileText,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { preprocessProductLinks, ProductAwareLink } from '../ProductLinkRenderer';
import { type RefObject } from 'react';
import { type Message } from './useExpertChat';
import { ChatEmptyState } from './ChatEmptyState';

interface ChatMessageListProps {
  messages: Message[];
  isLoading: boolean;
  isFromVoice: boolean;
  thinkingMessage: string;
  showScrollDown: boolean;
  sellerFirstName: string;
  clientId?: string;
  clientName?: string;
  conversationsCount: number;
  scrollRef: RefObject<HTMLDivElement>;
  onScroll: () => void;
  onScrollToBottom: () => void;
  onAutoSend: (text: string) => void;
  onShowHistory: () => void;
  // TTS
  playingTtsId: string | null;
  pausedTtsId: string | null;
  loadingTtsId: string | null;
  ttsErrorId: string | null;
  copiedId: string | null;
  savingQuoteId: string | null;
  onCopy: (msgId: string, text: string) => void;
  onSaveAsQuote: (msgId: string, content: string) => void;
  onPlayTts: (msgId: string, text: string) => void;
  onPauseTts: (msgId: string) => void;
  onStopTts: () => void;
  onRetry: () => void;
}

export function ChatMessageList({
  messages,
  isLoading,
  isFromVoice,
  thinkingMessage,
  showScrollDown,
  sellerFirstName,
  clientId,
  clientName,
  conversationsCount,
  scrollRef,
  onScroll,
  onScrollToBottom,
  onAutoSend,
  onShowHistory,
  playingTtsId,
  pausedTtsId,
  loadingTtsId,
  ttsErrorId,
  copiedId,
  savingQuoteId,
  onCopy,
  onSaveAsQuote,
  onPlayTts,
  onPauseTts,
  onStopTts,
  onRetry,
}: ChatMessageListProps) {
  return (
    <ScrollArea className="relative flex-1 px-4 py-3" ref={scrollRef} onScrollCapture={onScroll}>
      <div className="space-y-3">
        {messages.length === 0 && !isFromVoice && (
          <ChatEmptyState
            sellerFirstName={sellerFirstName}
            clientId={clientId}
            clientName={clientName}
            conversationsCount={conversationsCount}
            onAutoSend={onAutoSend}
            onShowHistory={onShowHistory}
          />
        )}

        {/* Voice loading */}
        <AnimatePresence mode="wait">
          {messages.length === 0 && isFromVoice && (
            <motion.div
              key="voice-loading"
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: -16, filter: 'blur(4px)' }}
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
              className="flex flex-col items-center justify-center py-16"
            >
              <div className="relative mb-5 h-20 w-20">
                <div className="bg-primary/8 absolute inset-0 animate-ping rounded-full [animation-duration:2s]" />
                <div className="absolute inset-2 animate-ping rounded-full bg-primary/10 [animation-delay:0.3s] [animation-duration:1.5s]" />
                <div className="bg-primary/8 relative flex h-20 w-20 items-center justify-center rounded-full border border-primary/15">
                  <Mic className="h-8 w-8 animate-pulse text-primary/70" />
                </div>
              </div>
              <p className="mb-1 font-display text-sm font-medium text-foreground/80">
                Processando comando de voz
              </p>
              <p className="text-xs text-muted-foreground/50">Preparando sua consulta…</p>
              <div className="mt-3 flex items-center gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className={`h-1 w-1 rounded-full bg-primary/${50 - i * 10} animate-bounce [animation-duration:0.6s] [animation-delay:${i * 0.15}s]`}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        <AnimatePresence mode="popLayout">
          {messages.map((message, index) => {
            const msgId = message.id || `msg-${message.role}-${index}`;
            return (
              <motion.div
                key={msgId}
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.25, delay: index === 0 && isFromVoice ? 0.15 : 0 }}
                layout
                className={cn(
                  'flex gap-2',
                  message.role === 'user' ? 'justify-end' : 'justify-start',
                )}
              >
                {message.role === 'assistant' && (
                  <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <div className="group/msg flex max-w-[80%] flex-col">
                  <div
                    className={cn(
                      'rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed',
                      message.role === 'user'
                        ? 'rounded-br-lg bg-primary text-primary-foreground'
                        : message.isError
                          ? 'rounded-bl-lg border border-destructive/20 bg-destructive/10 text-destructive'
                          : 'rounded-bl-lg border border-border/20 bg-muted/50 text-foreground',
                    )}
                  >
                    {message.role === 'assistant' ? (
                      <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none [&>h1]:text-sm [&>h2]:text-sm [&>h3]:text-xs [&>ol]:my-1 [&>p]:my-1 [&>p]:text-[13px] [&>p]:leading-relaxed [&>pre]:rounded-lg [&>pre]:border [&>pre]:border-border/20 [&>pre]:bg-background/50 [&>pre]:text-xs [&>ul]:my-1 [&_a]:font-medium [&_a]:text-primary [&_a]:no-underline hover:[&_a]:underline [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-primary/30 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-background/50 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_li]:text-[13px] [&_li]:leading-relaxed [&_strong]:font-semibold [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs [&_td]:border [&_td]:border-border/20 [&_td]:px-2 [&_td]:py-1.5 [&_td]:text-[12px] [&_th]:border [&_th]:border-border/30 [&_th]:bg-muted/80 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:text-[11px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_tr:hover]:bg-muted/30">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{ a: ProductAwareLink }}
                          skipHtml
                        >
                          {preprocessProductLinks(message.content)}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    )}
                  </div>
                  {message.timestamp && (
                    <span className="ml-1 mt-0.5 select-none text-[10px] text-muted-foreground/30 opacity-0 transition-opacity group-hover/msg:opacity-100">
                      {new Date(message.timestamp).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                  {message.isError && !isLoading && (
                    <button
                      onClick={onRetry}
                      className="ml-0.5 mt-1.5 flex items-center gap-1.5 self-start rounded-lg px-2.5 py-1 text-[11px] font-medium text-destructive transition-colors hover:bg-destructive/10"
                    >
                      <RotateCcw className="h-3 w-3" /> Tentar novamente
                    </button>
                  )}
                  {message.role === 'assistant' &&
                    message.content &&
                    !message.isError &&
                    !isLoading &&
                    (() => {
                      const id = msgId;
                      const isPlaying = playingTtsId === id;
                      const isPaused = pausedTtsId === id;
                      const isLoadingTts = loadingTtsId === id;
                      const isTtsError = ttsErrorId === id;
                      const isActive = isPlaying || isPaused;
                      const isCopied = copiedId === id;
                      return (
                        <div
                          className={cn(
                            'ml-0.5 mt-1.5 flex items-center gap-1 self-start transition-opacity duration-150',
                            isActive ? 'opacity-100' : 'opacity-0 group-hover/msg:opacity-100',
                          )}
                        >
                          <button
                            onClick={() => onCopy(id, message.content)}
                            className={cn(
                              'rounded-lg p-1.5 transition-all duration-150',
                              isCopied
                                ? 'text-success'
                                : 'text-muted-foreground/50 hover:bg-muted/50 hover:text-foreground',
                            )}
                            title={isCopied ? 'Copiado!' : 'Copiar'}
                            aria-label="Copiar mensagem"
                          >
                            {isCopied ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => onSaveAsQuote(id, message.content)}
                            disabled={savingQuoteId === id}
                            className={cn(
                              'rounded-lg p-1.5 transition-all duration-150',
                              savingQuoteId === id
                                ? 'cursor-wait text-primary/50'
                                : 'text-muted-foreground/50 hover:bg-primary/5 hover:text-primary',
                            )}
                            title="Salvar como rascunho de orçamento"
                            aria-label="Salvar como rascunho de orçamento"
                          >
                            {savingQuoteId === id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <FileText className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() =>
                              isPlaying ? onPauseTts(id) : onPlayTts(id, message.content)
                            }
                            disabled={isLoadingTts}
                            className={cn(
                              'rounded-xl p-2 transition-all duration-150',
                              isTtsError
                                ? 'bg-destructive/10 text-destructive hover:bg-destructive/15'
                                : isActive
                                  ? 'bg-primary/15 text-primary shadow-sm'
                                  : isLoadingTts
                                    ? 'cursor-wait bg-primary/5 text-primary/50'
                                    : 'text-muted-foreground/60 hover:bg-primary/10 hover:text-primary',
                            )}
                            title={
                              isTtsError
                                ? 'Áudio bloqueado'
                                : isPlaying
                                  ? 'Pausar'
                                  : isPaused
                                    ? 'Retomar'
                                    : isLoadingTts
                                      ? 'Gerando áudio...'
                                      : 'Ouvir'
                            }
                            aria-label={isPlaying ? 'Pausar' : 'Ouvir'}
                          >
                            {isLoadingTts ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : isTtsError ? (
                              <RotateCcw className="h-4 w-4" />
                            ) : isPlaying ? (
                              <Pause className="h-4 w-4" />
                            ) : isPaused ? (
                              <Play className="h-4 w-4" />
                            ) : (
                              <Volume2 className="h-4 w-4" />
                            )}
                          </button>
                          {isTtsError && (
                            <span className="text-[10px] font-medium text-destructive">
                              Bloqueado
                            </span>
                          )}
                          {isActive && (
                            <button
                              onClick={onStopTts}
                              className="rounded-lg p-1.5 text-muted-foreground/50 transition-all duration-150 hover:bg-destructive/10 hover:text-destructive"
                              title="Parar"
                              aria-label="Parar áudio"
                            >
                              <VolumeX className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })()}
                </div>
                {message.role === 'user' && (
                  <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl bg-secondary/60">
                    <User className="h-3.5 w-3.5 text-secondary-foreground/60" />
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Follow-up actions */}
        {messages.length > 0 &&
          messages.at(-1)?.role === 'assistant' &&
          !messages.at(-1)?.isError &&
          !isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="ml-9 mt-1 flex flex-wrap gap-1.5"
            >
              {[
                {
                  emoji: '🔍',
                  label: 'Aprofundar',
                  prompt: 'Pode detalhar mais essa última resposta? Quero mais informações.',
                },
                ...(clientId
                  ? [
                      {
                        emoji: '📝',
                        label: 'Montar proposta',
                        prompt:
                          'Com base nessa análise, monte uma proposta comercial detalhada com produtos, quantidades e valores sugeridos.',
                      },
                      {
                        emoji: '💬',
                        label: 'Msg follow-up',
                        prompt:
                          'Crie uma mensagem de follow-up para enviar a este cliente por WhatsApp.',
                      },
                    ]
                  : []),
                {
                  emoji: '📊',
                  label: 'Comparar',
                  prompt: 'Compare as opções mencionadas em uma tabela com prós e contras.',
                },
              ].map((action) => (
                <button
                  key={action.label}
                  onClick={() => onAutoSend(action.prompt)}
                  className="flex items-center gap-1 rounded-lg border border-border/40 bg-background/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-all duration-150 hover:border-primary/30 hover:bg-primary/5 hover:text-foreground"
                >
                  <span className="text-[10px]">{action.emoji}</span>
                  {action.label}
                </button>
              ))}
            </motion.div>
          )}

        {/* Typing indicator */}
        {isLoading && messages.at(-1)?.role === 'user' && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start gap-2"
          >
            <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Bot className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="rounded-2xl rounded-bl-lg border border-border/20 bg-muted/50 px-4 py-3">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-primary/60"
                        animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          delay: i * 0.2,
                          ease: 'easeInOut',
                        }}
                      />
                    ))}
                  </div>
                  {isFromVoice && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground/40">
                      <Mic className="h-2.5 w-2.5" /> via voz
                    </span>
                  )}
                </div>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={thinkingMessage}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.3 }}
                    className="text-[10px] leading-none text-muted-foreground/50"
                  >
                    {thinkingMessage}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Scroll to bottom FAB */}
      <AnimatePresence>
        {showScrollDown && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={onScrollToBottom}
            className="absolute bottom-2 left-1/2 z-10 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-border/50 bg-background text-muted-foreground shadow-md transition-all hover:text-foreground hover:shadow-lg"
            aria-label="Rolar para baixo"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </motion.button>
        )}
      </AnimatePresence>
    </ScrollArea>
  );
}
