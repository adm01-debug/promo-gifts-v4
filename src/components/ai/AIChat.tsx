/**
 * AIChat — Chat conversacional reutilizável que consome a edge function `expert-chat`.
 *
 * Features:
 * - Histórico de mensagens user/assistant com auto-scroll
 * - Envio com Enter (Shift+Enter quebra linha)
 * - Loading state, error state, cancelamento via AbortController
 * - Markdown leve + reconhecimento do padrão [[PRODUTO:id:nome:imageUrl]]
 *   (memory: features/ai/flow-product-integration-spec)
 * - Tokens de design semânticos (Outfit, var(--primary), border-[1.5px], rounded-xl)
 */
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Send, Loader2, Bot, User as UserIcon, AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ============================================
// TIPOS
// ============================================

export interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  createdAt: number;
}

export interface ProductMention {
  id: string;
  name: string;
  imageUrl?: string;
}

export interface AIChatProps {
  /** Prompt de sistema enviado a cada requisição. */
  systemPrompt?: string;
  /** Placeholder do input. */
  placeholder?: string;
  /** Mensagem inicial do assistente (opcional). */
  greeting?: string;
  /** Altura máxima da área de mensagens. */
  maxHeight?: string;
  /** Callback acionado quando o assistente menciona um produto via [[PRODUTO:...]] */
  onProductMention?: (product: ProductMention) => void;
  /** Classe extra para o container raiz. */
  className?: string;
  /** Identificador do contexto (ex: cliente, orçamento) — usado para metadata. */
  contextId?: string;
}

// ============================================
// HELPERS
// ============================================

const PRODUCT_PATTERN = /\[\[PRODUTO:([^:]+):([^:]+)(?::([^\]]+))?\]\]/g;

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function extractProductMentions(text: string): ProductMention[] {
  const mentions: ProductMention[] = [];
  let match: RegExpExecArray | null;
  PRODUCT_PATTERN.lastIndex = 0;
  while ((match = PRODUCT_PATTERN.exec(text)) !== null) {
    mentions.push({ id: match[1], name: match[2], imageUrl: match[3] });
  }
  return mentions;
}

// ============================================
// SUB-COMPONENTES
// ============================================

interface MessageBubbleProps {
  message: ChatMessage;
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const cleanContent = useMemo(
    () => message.content.replace(PRODUCT_PATTERN, (_, _id, name) => `**${name}**`),
    [message.content],
  );

  return (
    <div className={cn('flex animate-fade-in gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[1.5px]',
          isUser
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border bg-muted text-muted-foreground',
        )}
        aria-hidden="true"
      >
        {isUser ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          'max-w-[80%] rounded-xl border-[1.5px] px-4 py-2.5 font-display text-sm leading-relaxed',
          isUser
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border bg-card text-card-foreground',
        )}
      >
        <p className="whitespace-pre-wrap break-words">{cleanContent}</p>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div
      className="flex animate-fade-in gap-3"
      aria-live="polite"
      aria-label="Assistente digitando"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[1.5px] border-border bg-muted text-muted-foreground">
        <Bot className="h-4 w-4" />
      </div>
      <div className="rounded-xl border-[1.5px] border-border bg-card px-4 py-2.5">
        <div className="flex gap-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" />
        </div>
      </div>
    </div>
  );
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export function AIChat({
  systemPrompt,
  placeholder = 'Digite sua mensagem...',
  greeting,
  maxHeight = '500px',
  onProductMention,
  className,
  contextId,
}: AIChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    greeting ? [{ id: makeId(), role: 'assistant', content: greeting, createdAt: Date.now() }] : [],
  );
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll para a última mensagem
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = {
      id: makeId(),
      role: 'user',
      content: trimmed,
      createdAt: Date.now(),
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setError(null);
    setIsLoading(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Usuário não autenticado');

      const response = await fetch(`${SUPABASE_URL}/functions/v1/expert-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
          systemPrompt,
          contextId,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 429)
          throw new Error('Limite de requisições atingido. Aguarde alguns instantes.');
        if (response.status === 402)
          throw new Error('Créditos de IA esgotados. Contate o administrador.');
        const txt = await response.text().catch(() => '');
        throw new Error(`Erro ${response.status}: ${txt || 'falha ao consultar IA'}`);
      }

      const data = await response.json();
      const assistantContent: string = data?.message?.content ?? data?.content ?? data?.reply ?? '';

      if (!assistantContent) throw new Error('Resposta vazia do assistente');

      const assistantMsg: ChatMessage = {
        id: makeId(),
        role: 'assistant',
        content: assistantContent,
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Notifica menções de produtos
      if (onProductMention) {
        extractProductMentions(assistantContent).forEach(onProductMention);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(msg);
      toast.error(msg);
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, [input, isLoading, messages, systemPrompt, contextId, onProductMention]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage],
  );

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    setMessages(
      greeting
        ? [{ id: makeId(), role: 'assistant', content: greeting, createdAt: Date.now() }]
        : [],
    );
    setError(null);
    setIsLoading(false);
    textareaRef.current?.focus();
  }, [greeting]);

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-2xl border-[1.5px] border-border bg-background',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b-[1.5px] border-border bg-muted/30 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" aria-hidden="true" />
          <span className="font-display text-sm font-semibold text-foreground">Assistente IA</span>
        </div>
        {messages.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-7 gap-1.5 text-xs"
            aria-label="Reiniciar conversa"
          >
            <RotateCcw className="h-3 w-3" />
            Reiniciar
          </Button>
        )}
      </div>

      {/* Mensagens */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto px-4 py-4"
        style={{ maxHeight }}
        role="log"
        aria-live="polite"
        aria-atomic="false"
      >
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <Bot className="mb-3 h-10 w-10 opacity-40" aria-hidden="true" />
            <p className="font-display text-sm">Inicie uma conversa com o assistente</p>
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {isLoading && <TypingIndicator />}
      </div>

      {/* Erro */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 border-t-[1.5px] border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="font-display">{error}</span>
        </div>
      )}

      {/* Input */}
      <div className="border-t-[1.5px] border-border bg-muted/20 p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            disabled={isLoading}
            aria-label="Mensagem para o assistente"
            className={cn(
              'flex-1 resize-none rounded-xl border-[1.5px] border-input bg-background px-3 py-2 text-sm',
              'font-display ring-offset-background transition-all duration-200',
              'placeholder:text-muted-foreground',
              'focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20',
              'hover:border-primary/50',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'max-h-32 min-h-[40px]',
            )}
          />
          <Button
            type="button"
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            size="icon"
            aria-label="Enviar mensagem"
            className="h-10 w-10 shrink-0 rounded-xl"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="mt-1.5 font-display text-[11px] text-muted-foreground/70">
          Pressione <kbd className="rounded border border-border bg-background px-1">Enter</kbd>{' '}
          para enviar •{' '}
          <kbd className="rounded border border-border bg-background px-1">Shift+Enter</kbd> para
          quebrar linha
        </p>
      </div>
    </div>
  );
}
