/**
 * useExpertChat — Core logic extracted from ExpertChatDialog
 * Handles messages, conversations, TTS, streaming, filters.
 *
 * FIX 2026-06-01: Hoisted handleAutoSend to before all useEffect hooks
 * to eliminate TDZ (Temporal Dead Zone) ReferenceError.
 * Bug: Cannot access 'fe' before initialization (ExpertChatDialog-CkjS4q2J.js:1:27389)
 */
import { dbInvoke } from '@/lib/db/postgrest';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase, SUPABASE_URL } from '@/integrations/supabase/client';
import { useExpertChatTts } from './useExpertChatTts';
import { useExpertConversations, type ExpertConversation } from '@/hooks/intelligence';
import {
  type FlowFilterState,
  type FlowFilterOptions,
  defaultFlowFilters,
  countActiveFilters,
  getActiveFilterLabels,
} from '../FlowFilterPanel';

import { logger } from '@/lib/logger';
export interface Message {
  id?: string;
  role: 'assistant' | 'user';
  content: string;
  timestamp?: number;
  isError?: boolean;
}

const THINKING_MESSAGES = [
  'Analisando sua pergunta…',
  'Consultando catálogo…',
  'Buscando produtos relevantes…',
  'Preparando recomendações…',
];

const THINKING_MESSAGES_CRM = [
  'Consultando dados do cliente…',
  'Analisando histórico de compras…',
  'Verificando orçamentos pendentes…',
  'Gerando insights personalizados…',
];

interface UseExpertChatOptions {
  isOpen: boolean;
  onClose: () => void;
  clientId?: string;
  clientName?: string;
  initialMessage?: string | null;
}

export function useExpertChat({
  isOpen,
  onClose,
  clientId,
  clientName,
  initialMessage,
}: UseExpertChatOptions) {
  const navigate = useNavigate();
  const [savingQuoteId, setSavingQuoteId] = useState<string | null>(null);
  const [sellerFirstName, setSellerFirstName] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const tts = useExpertChatTts();
  const [isFromVoice, setIsFromVoice] = useState(false);
  const isFromVoiceRef = useRef(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [lastUserInput, setLastUserInput] = useState('');
  const [thinkingMessage, setThinkingMessage] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [flowFilters, setFlowFilters] = useState<FlowFilterState>(defaultFlowFilters);
  const [filterOptions, setFilterOptions] = useState<FlowFilterOptions>({
    categories: [],
    materials: [],
    colors: [],
    suppliers: [],
    techniques: [],
    publicoAlvo: [],
    datasComemorativas: [],
    endomarketing: [],
    nichos: [],
    tags: [],
  });
  const [showFilters, setShowFilters] = useState(false);
  const [historyDateFilter, setHistoryDateFilter] = useState<'all' | 'month' | 'today' | 'week'>(
    'all',
  );
  const [autoPlayTts, setAutoPlayTts] = useState(() => {
    try {
      return localStorage.getItem('flow_autoplay_tts') !== 'false';
    } catch {
      return true;
    }
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
    conversations,
    isLoading: isLoadingConversations,
    createConversation,
    deleteConversation,
    fetchMessages,
    saveMessage,
  } = useExpertConversations(clientId);

  // ─────────────────────────────────────────────────────────────────────────
  // CALLBACKS THAT ARE REFERENCED BY useEffect hooks MUST BE DECLARED FIRST
  // to avoid Temporal Dead Zone (TDZ) ReferenceError.
  // Bug fix: Cannot access 'fe' before initialization
  // 'fe' = handleAutoSend in Vite/Rollup minified bundle.
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * handleAutoSend: programmatically fills the input and triggers send.
   * MUST be declared before all useEffect hooks that reference it.
   */
  const handleAutoSend = useCallback((text: string) => {
    setInput(text);
    setTimeout(() => {
      const sendBtn = document.querySelector<HTMLButtonElement>('[data-oracle-send]');
      sendBtn?.click();
    }, 50);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // EFFECTS — all can now safely reference handleAutoSend
  // ─────────────────────────────────────────────────────────────────────────

  // Rotate thinking messages
  useEffect(() => {
    if (!isLoading) {
      setThinkingMessage('');
      return;
    }
    const msgs = clientId ? THINKING_MESSAGES_CRM : THINKING_MESSAGES;
    let idx = 0;
    setThinkingMessage(msgs[0]);
    const interval = setInterval(() => {
      idx = (idx + 1) % msgs.length;
      setThinkingMessage(msgs[idx]);
    }, 2500);
    return () => clearInterval(interval);
  }, [isLoading, clientId]);

  // Fetch seller profile
  useEffect(() => {
    if (!isOpen) return;
    const fetchProfile = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, preferences')
          .eq('user_id', user.id)
          .maybeSingle();
        if (profile?.full_name) setSellerFirstName(profile.full_name.split(' ')[0]);
        const prefs = profile?.preferences as Record<string, unknown> | null;
        if (prefs && typeof prefs.flow_autoplay_tts === 'boolean') {
          setAutoPlayTts(prefs.flow_autoplay_tts);
          try {
            localStorage.setItem('flow_autoplay_tts', String(prefs.flow_autoplay_tts));
          } catch {
            /* empty */
          }
        }
      } catch {
        /* ignore */
      }
    };
    fetchProfile();
  }, [isOpen]);

  // Fetch filter options
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const uniq = (values: string[]) =>
      [...new Set(values.map((v) => v.trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }),
      );
    const fetchFilters = async () => {
      try {
        const [cat, sup, tec, tag, col, mat] = await Promise.all([
          dbInvoke<{ name: string }>({
            table: 'categories',
            operation: 'select',
            select: 'name',
            filters: { is_active: true },
            orderBy: { column: 'name', ascending: true },
            limit: 500,
          }),
          dbInvoke<{ name: string }>({
            table: 'suppliers',
            operation: 'select',
            select: 'name',
            orderBy: { column: 'name', ascending: true },
            limit: 200,
          }),
          dbInvoke<{ nome: string }>({
            table: 'tecnicas_gravacao',
            operation: 'select',
            select: 'nome',
            filters: { ativo: true },
            orderBy: { column: 'nome', ascending: true },
            limit: 100,
          }),
          dbInvoke<{ name: string }>({
            table: 'tags',
            operation: 'select',
            select: 'name',
            orderBy: { column: 'name', ascending: true },
            limit: 200,
          }),
          dbInvoke<{ name: string }>({
            table: 'color_groups',
            operation: 'select',
            select: 'name',
            orderBy: { column: 'name', ascending: true },
            limit: 200,
          }),
          dbInvoke<{ name: string }>({
            table: 'material_groups',
            operation: 'select',
            select: 'name',
            orderBy: { column: 'name', ascending: true },
            limit: 200,
          }),
        ]);
        if (cancelled) return;
        setFilterOptions({
          categories: uniq((cat.records ?? []).map((i) => i.name)),
          materials: uniq((mat.records ?? []).map((i) => i.name)),
          colors: uniq((col.records ?? []).map((i) => i.name)),
          suppliers: uniq((sup.records ?? []).map((i) => i.name)),
          techniques: uniq((tec.records ?? []).map((i: { nome: string }) => i.nome)),
          publicoAlvo: [],
          datasComemorativas: [],
          endomarketing: [],
          nichos: [],
          tags: uniq((tag.records ?? []).map((i) => i.name)),
        });
        try {
          const [ramos] = await Promise.all([
            dbInvoke<{ nome: string }>({
              table: 'ramo_atividade',
              operation: 'select',
              select: 'nome',
              orderBy: { column: 'nome', ascending: true },
              limit: 200,
            }),
          ]);
          if (!cancelled && ramos.records?.length) {
            setFilterOptions((prev) => ({
              ...prev,
              nichos: uniq((ramos.records ?? []).map((i) => i.nome)),
            }));
          }
        } catch {
          /* empty */
        }
      } catch (error) {
        logger.error('Error fetching Flow filters:', error);
      }
    };
    fetchFilters();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Proactive filter feedback — handleAutoSend is now safely initialized above
  const prevFilterKeyRef = useRef('');
  const filterDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const currentCount = countActiveFilters(flowFilters);
    if (currentCount === 0 || isLoading || !isOpen) return;
    const labels = getActiveFilterLabels(flowFilters);
    const filterKey = labels
      .map((l) => `${l.key}:${l.value || l.label}`)
      .sort()
      .join('|');
    if (filterKey === prevFilterKeyRef.current) return;
    prevFilterKeyRef.current = filterKey;
    if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    filterDebounceRef.current = setTimeout(() => {
      const summary = labels.map((l) => l.label).join(', ');
      handleAutoSend(
        `Filtros aplicados: ${summary}. Me mostre os melhores produtos para esses filtros, com recomendações e insights de vendas.`,
      );
    }, 1000);
    return () => {
      if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    };
  }, [flowFilters, isLoading, isOpen, handleAutoSend]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current && !showScrollDown) {
      if (scrollRef.current.scrollTo) {
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      } else {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
  }, [messages, showScrollDown]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setShowScrollDown(scrollHeight - scrollTop - clientHeight > 80);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      if (scrollRef.current.scrollTo) {
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      } else {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
      setShowScrollDown(false);
    }
  }, []);

  const handleCopy = useCallback(async (msgId: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleSaveAsQuote = useCallback(
    async (msgId: string, proposalContent: string) => {
      try {
        setSavingQuoteId(msgId);
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          toast.error('Faça login para salvar orçamentos');
          return;
        }
        const { data: quote, error } = await supabase
          // rls-allow: RLS aplica seller_id automaticamente
          .from('quotes')
          .insert({
            seller_id: user.id,
            status: 'draft',
            quote_number: '',
            client_id: clientId || null,
            client_name: clientName || 'Sem cliente',
            notes: proposalContent.slice(0, 2000),
            internal_notes: 'Gerado pelo Flow - Assistente Pessoal',
          })
          .select('id, quote_number')
          .single();
        if (error) throw error;
        toast.success(`Rascunho ${quote.quote_number} criado!`, {
          description: 'Redirecionando para o editor…',
          duration: 2000,
        });
        setTimeout(() => {
          onClose();
          navigate(`/orcamentos/novo?edit=${quote.id}`);
        }, 800);
      } catch (err) {
        logger.error('Error saving quote draft:', err);
        toast.error('Erro ao criar rascunho de orçamento');
      } finally {
        setSavingQuoteId(null);
      }
    },
    [clientId, clientName, navigate, onClose],
  );

  useEffect(() => {
    if (isOpen && inputRef.current && !showHistory)
      setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen, showHistory]);

  useEffect(() => {
    if (!isOpen) {
      setShowHistory(false);
      setHistorySearch('');
    }
  }, [isOpen]);

  useEffect(() => {
    setMessages([]);
    setCurrentConversationId(null);
    setShowHistory(false);
    setFlowFilters(defaultFlowFilters);
    prevFilterKeyRef.current = '';
  }, [clientId]);

  // Auto-send initial voice message — handleAutoSend is initialized above
  const initialMessageSentRef = useRef(false);
  useEffect(() => {
    if (isOpen && initialMessage && !initialMessageSentRef.current && !isLoading) {
      initialMessageSentRef.current = true;
      setIsFromVoice(true);
      isFromVoiceRef.current = true;
      handleAutoSend(initialMessage);
    }
    if (!isOpen) {
      initialMessageSentRef.current = false;
      setIsFromVoice(false);
      isFromVoiceRef.current = false;
    }
  }, [isOpen, initialMessage, isLoading, handleAutoSend]);

  // TTS — delegated to useExpertChatTts
  const { handlePlayTts, handlePauseTts, stopTts } = tts;

  const startNewConversation = useCallback(() => {
    setMessages([]);
    setCurrentConversationId(null);
    setShowHistory(false);
  }, []);

  const loadConversation = useCallback(
    async (conversation: ExpertConversation) => {
      const loaded = await fetchMessages(conversation.id);
      setMessages(loaded.map((m) => ({ id: m.id, role: m.role, content: m.content })));
      setCurrentConversationId(conversation.id);
      setShowHistory(false);
    },
    [fetchMessages],
  );

  const handleDeleteConversation = useCallback(
    async (e: React.MouseEvent, conversationId: string) => {
      e.stopPropagation();
      await deleteConversation(conversationId);
      if (currentConversationId === conversationId) startNewConversation();
    },
    [deleteConversation, currentConversationId, startNewConversation],
  );

  // handleRetry declared AFTER handleAutoSend to ensure stable reference in deps
  const handleRetry = useCallback(() => {
    if (!lastUserInput) return;
    setMessages((prev) => {
      const filtered = prev.filter((m) => !m.isError);
      if (filtered.length > 0 && filtered[filtered.length - 1]?.role === 'user')
        return filtered.slice(0, -1);
      return filtered;
    });
    handleAutoSend(lastUserInput);
  }, [lastUserInput, handleAutoSend]);

  const handleStopGenerating = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage = input.trim();
    setInput('');
    setLastUserInput(userMessage);
    if (inputRef.current) inputRef.current.style.height = 'auto';

    let convId = currentConversationId;
    if (!convId) {
      const title = userMessage.slice(0, 50) + (userMessage.length > 50 ? '...' : '');
      convId = await createConversation(title);
      if (convId) setCurrentConversationId(convId);
    }

    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'user', content: userMessage, timestamp: Date.now() },
    ]);
    setIsLoading(true);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    if (convId) await saveMessage(convId, 'user', userMessage);

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/expert-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: userMessage }]
            .map((m) => ({ role: m.role, content: m.content }))
            .filter((m) => m.content?.length > 0),
          clientId: clientId || undefined,
          categoryFilter:
            flowFilters.selectedCategories.length > 0 ? flowFilters.selectedCategories : undefined,
          priceMin: flowFilters.priceMin ? Number(flowFilters.priceMin) : undefined,
          priceMax: flowFilters.priceMax ? Number(flowFilters.priceMax) : undefined,
          materialFilter:
            flowFilters.selectedMaterials.length > 0 ? flowFilters.selectedMaterials : undefined,
          colorFilter:
            flowFilters.selectedColors.length > 0 ? flowFilters.selectedColors : undefined,
          genderFilter:
            flowFilters.selectedGenders.length > 0 ? flowFilters.selectedGenders : undefined,
          supplierFilter:
            flowFilters.selectedSuppliers.length > 0 ? flowFilters.selectedSuppliers : undefined,
          techniqueFilter:
            flowFilters.selectedTechniques.length > 0 ? flowFilters.selectedTechniques : undefined,
          publicoFilter:
            flowFilters.selectedPublicos.length > 0 ? flowFilters.selectedPublicos : undefined,
          dataComemorativaFilter:
            flowFilters.selectedDatasComemorativas.length > 0
              ? flowFilters.selectedDatasComemorativas
              : undefined,
          endomarketingFilter:
            flowFilters.selectedEndomarketing.length > 0
              ? flowFilters.selectedEndomarketing
              : undefined,
          nichoFilter:
            flowFilters.selectedNichos.length > 0 ? flowFilters.selectedNichos : undefined,
          tagFilter: flowFilters.selectedTags.length > 0 ? flowFilters.selectedTags : undefined,
          onlyInStock: flowFilters.onlyInStock || undefined,
          onlyNew: flowFilters.onlyNew || undefined,
          onlyKit: flowFilters.onlyKit || undefined,
          onlyBestseller: flowFilters.onlyBestseller || undefined,
          onlyFeatured: flowFilters.onlyFeatured || undefined,
          hasPersonalization: flowFilters.hasPersonalization || undefined,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao conectar com o Flow');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';
      const assistantMsgId = `assistant-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: assistantMsgId, role: 'assistant', content: '', timestamp: Date.now() },
      ]);

      if (reader) {
        let buffer = '';
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let newlineIndex: number;
            while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
              let line = buffer.slice(0, newlineIndex);
              buffer = buffer.slice(newlineIndex + 1);
              if (line.endsWith('\r')) line = line.slice(0, -1);
              if (line.startsWith(':') || line.trim() === '') continue;
              if (!line.startsWith('data: ')) continue;
              const jsonStr = line.slice(6).trim();
              if (jsonStr === '[DONE]') continue;
              try {
                const parsed = JSON.parse(jsonStr);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  assistantMessage += content;
                  const snapshot = assistantMessage;
                  setMessages((prev) => {
                    const n = [...prev];
                    if (n[n.length - 1]?.role === 'assistant') n[n.length - 1].content = snapshot;
                    return n;
                  });
                }
              } catch {
                buffer = `${line}\n${buffer}`;
                break;
              }
            }
          }
        } catch (err) {
          if ((err as Error).name !== 'AbortError') throw err;
        }
      }

      if (convId && assistantMessage) await saveMessage(convId, 'assistant', assistantMessage);
      if (isFromVoiceRef.current && autoPlayTts && assistantMessage) {
        setTimeout(() => handlePlayTts(assistantMsgId, assistantMessage), 300);
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      logger.error('Expert chat error:', error);
      const errorMessage =
        error instanceof Error
          ? `Desculpe, ocorreu um erro: ${error.message}`
          : 'Desculpe, ocorreu um erro ao processar sua mensagem.';
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: errorMessage,
          timestamp: Date.now(),
          isError: true,
        },
      ]);
      if (convId) await saveMessage(convId, 'assistant', errorMessage);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const activeFiltersCount = countActiveFilters(flowFilters);

  const handleToggleAutoPlayTts = useCallback(async (next: boolean) => {
    setAutoPlayTts(next);
    try {
      localStorage.setItem('flow_autoplay_tts', String(next));
    } catch {
      /* empty */
    }
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // BUG-EXPERTCHAT-TTS-PREF-SELECT-SILENT-FAIL FIX: if SELECT failed, profile was null
        // and currentPrefs became {}, causing the UPDATE to overwrite all other preferences.
        const { data: profile, error: profileFetchErr } = await supabase
          .from('profiles')
          .select('preferences')
          .eq('user_id', user.id)
          .maybeSingle();
        if (profileFetchErr) {
          logger.warn('[expert-chat] Could not fetch profile prefs — TTS pref not persisted:', profileFetchErr);
          return;
        }
        const currentPrefs = (profile?.preferences as Record<string, unknown>) || {};
        // BUG-EXPERTCHAT-TTS-PREF-UPDATE-SILENT-FAIL FIX: bare await swallowed RLS errors.
        const { error: prefErr } = await supabase
          .from('profiles')
          .update({ preferences: { ...currentPrefs, flow_autoplay_tts: next } })
          .eq('user_id', user.id);
        if (prefErr) logger.warn('[expert-chat] TTS preference update failed (non-fatal):', prefErr);
      }
    } catch {
      /* empty */
    }
  }, []);

  const resetFilters = useCallback(() => {
    setFlowFilters(defaultFlowFilters);
    prevFilterKeyRef.current = '';
  }, []);

  return {
    // State
    messages,
    input,
    setInput,
    isLoading,
    isFromVoice,
    showHistory,
    setShowHistory,
    historySearch,
    setHistorySearch,
    historyDateFilter,
    setHistoryDateFilter,
    showFilters,
    setShowFilters,
    flowFilters,
    setFlowFilters,
    filterOptions,
    autoPlayTts,
    activeFiltersCount,
    thinkingMessage,
    showScrollDown,
    sellerFirstName,
    conversations,
    isLoadingConversations,
    currentConversationId,
    clientId,
    clientName,
    savingQuoteId,
    copiedId,
    playingTtsId: tts.playingTtsId,
    pausedTtsId: tts.pausedTtsId,
    loadingTtsId: tts.loadingTtsId,
    ttsErrorId: tts.ttsErrorId,
    // Refs
    scrollRef,
    inputRef,
    // Actions
    sendMessage,
    handleKeyDown,
    handleAutoSend,
    handleCopy,
    handleSaveAsQuote,
    handlePlayTts,
    handlePauseTts,
    stopTts,
    handleScroll,
    scrollToBottom,
    startNewConversation,
    loadConversation,
    handleDeleteConversation,
    handleRetry,
    handleStopGenerating,
    handleToggleAutoPlayTts,
    resetFilters,
    isFromVoiceRef,
  };
}
