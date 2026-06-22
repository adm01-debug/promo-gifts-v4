/**
 * useGlobalSearch — Hook that encapsulates all search logic for GlobalSearchPalette.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchStore } from '@/stores/useSearchStore';
import { useOracleVoiceBridge } from '@/stores/oracleVoiceBridge';
import Fuse from 'fuse.js';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { untypedFrom } from '@/lib/supabase-untyped';
import { searchCache } from './searchCache';
import { pushRecentSearch } from './EmptySearchState';
import { useDebounce, useSearchHistory } from '@/hooks/common';
import {
  useContextualSuggestions,
  useVoiceCommandHistory,
  type VoiceCommandRecord,
} from '@/hooks/intelligence';
import { useSlashCommands } from '@/hooks/ui/useSlashCommands';
import type { VoiceAgentAction } from '@/hooks/voice/types';

import { createProductFuseOptions, rankProductSearchResults } from '@/utils/product-search';
import type { PromobrindProduct } from '@/lib/external-db';

export type SearchResultType =
  | 'art_file'
  | 'cart_template'
  | 'category'
  | 'client'
  | 'collection'
  | 'command'
  | 'component'
  | 'conversation'
  | 'kit'
  | 'magic_up'
  | 'media'
  | 'mockup'
  | 'product'
  | 'quote'
  | 'reminder';

export interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  type: SearchResultType;
  href: string;
  metadata?: Record<string, unknown>;
}

export interface SearchIntent {
  type: SearchResultType | 'mixed';
  entities?: SearchResultType[];
  filters: {
    category?: string;
    color?: string;
    material?: string;
    priceRange?: 'high' | 'low' | 'medium';
    status?: string;
    clientName?: string;
    dateRange?: 'month' | 'today' | 'week' | 'year';
  };
  keywords: string[];
  originalQuery: string;
}

export interface PopularProduct {
  id: string;
  name: string;
  sku: string;
  category_name: string | null;
  image_url: string | null;
  view_count: number;
}

export interface AppliedFilter {
  type: 'category' | 'color' | 'featured' | 'kit' | 'material' | 'price' | 'stock';
  label: string;
}

export interface QuickSuggestion {
  label: string;
  icon: string;
}

const RERANK_TYPES: SearchResultType[] = ['quote', 'conversation', 'reminder'];

/**
 * FIX BUG-GS-14: Redact potential PII from search queries before logging to analytics.
 * Patterns: CPF (###.###.###-##), CNPJ (##.###.###/####-##), e-mail addresses.
 * Any matched pattern is replaced with '[REDACTED]' so analytics remain useful
 * (query length, intent type, latency) without storing personal identifiers.
 */
function redactPii(query: string): string {
  return query
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[REDACTED]') // CPF
    .replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, '[REDACTED]') // CNPJ
    .replace(/\S+@\S+\.\S+/g, '[REDACTED]'); // e-mail
}

export function useGlobalSearch() {
  const { open, setOpen, voiceOverlayOpen, setVoiceOverlayOpen } = useSearchStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [searchIntent, setSearchIntent] = useState<SearchIntent | null>(null);
  // Move popularProducts state to useQuery for better caching and performance
  const [typingSuggestions, setTypingSuggestions] = useState<string[]>([]);
  // FIX BUG-GS-07: expose search error state so UI can show a feedback banner
  const [searchError, setSearchError] = useState(false);
  const navigate = useNavigate();
  const debouncedQuery = useDebounce(query, 500);

  const {
    history: globalHistory,
    addToHistory: addGlobalHistoryItem,
    removeFromHistory,
    clearHistory,
  } = useSearchHistory('general');

  const history = globalHistory.map((h) => h.label);

  const { addCommand: addVoiceCommand } = useVoiceCommandHistory();

  const { suggestions: contextualSuggestions, routeContext } = useContextualSuggestions({
    searchQuery: query,
  });
  // FIX (invocation storm): stabilize the onClose callback so useSlashCommands
  // does not produce a new `commands` array identity on every render.
  const closeSearch = useCallback(() => setOpen(false), [setOpen]);
  const { commands } = useSlashCommands(closeSearch);

  // Keep latest commands in a ref so the semantic-search trigger effect reads
  // them WITHOUT depending on `commands` identity (root cause of the request
  // storm: the effect re-fired on every render and started a new, uncancellable
  // semantic-search invoke before the previous one resolved).
  const commandsRef = useRef(commands);
  useEffect(() => {
    commandsRef.current = commands;
  }, [commands]);

  // ── Voice Agent (ElevenLabs + AI) ──
  const handleVoiceAction = useCallback(
    (action: VoiceAgentAction) => {
      addVoiceCommand(
        action.data?.query || action.response,
        action.action as VoiceCommandRecord['type'],
        true,
      );

      switch (action.action) {
        case 'navigate':
          if (action.data?.route) {
            const route = action.data.route;
            setTimeout(() => {
              setVoiceOverlayOpen(false);
              navigate(route);
            }, 500);
          }
          break;
        case 'search':
        case 'filter':
          if (action.data?.query || action.data?.filters) {
            const searchTerm = action.data?.query ?? '';
            const filterParts: string[] = [];
            if (action.data?.filters?.category) filterParts.push(action.data.filters.category);
            if (action.data?.filters?.color) filterParts.push(action.data.filters.color);
            if (action.data?.filters?.material) filterParts.push(action.data.filters.material);

            const finalQuery = searchTerm || filterParts.join(' ');
            if (finalQuery) {
              setTimeout(() => {
                setVoiceOverlayOpen(false);
                setQuery(finalQuery);
                setOpen(true);
              }, 500);
            }
          }
          break;
        case 'clear':
          setTimeout(() => {
            setVoiceOverlayOpen(false);
            setQuery('');
            setResults([]);
          }, 500);
          break;
        case 'sort':
          setTimeout(() => {
            setVoiceOverlayOpen(false);
            if (action.data?.sortBy) {
              navigate(`/?sort=${action.data.sortBy}`);
            }
          }, 500);
          break;
        case 'answer':
          break;
        case 'open_oracle':
          setTimeout(() => {
            setVoiceOverlayOpen(false);
            useOracleVoiceBridge.getState().openOracle(action.data?.oracleMessage || undefined);
          }, 500);
          break;
        case 'open_cart':
          setTimeout(() => {
            setVoiceOverlayOpen(false);
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'o', altKey: true }));
          }, 500);
          break;
      }
    },
    // FIX BUG-GS-03 / BUG-GS-18 / BUG-GS-19: added setQuery and setResults.
    // Both are used inside the callback (cases: search, filter, clear) but were
    // missing from the dependency array, creating stale closures.
    // useState setters are stable references so this rarely causes runtime issues,
    // but it violates the rules-of-hooks and can cause subtle bugs in Strict Mode.
    [addVoiceCommand, navigate, setOpen, setVoiceOverlayOpen, setQuery, setResults],
  );

  const handleOpenVoiceOverlay = useCallback(() => {
    setOpen(false);
    setVoiceOverlayOpen(true);
  }, [setOpen, setVoiceOverlayOpen]);

  const handleCloseVoiceOverlay = useCallback(() => {
    setVoiceOverlayOpen(false);
  }, [setVoiceOverlayOpen]);

  // ── FIX BUG-GS-06: Clear search cache on user logout ──
  // The LRU cache is a module-level singleton. Without clearing on sign-out,
  // a user logging in on the same browser tab would see cached results from
  // the previous user's session.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        searchCache.clear();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // ── Popular products ──
  // product_popularity_30d view was removed; return empty until a replacement is created.
  const popularProducts: PopularProduct[] = [];

  // ── Typing suggestions ──
  useEffect(() => {
    if (query.length >= 2 && query.length < 5) {
      const lowerQuery = query.toLowerCase();
      const suggestions: string[] = [];
      history.forEach((h) => {
        if (h.toLowerCase().startsWith(lowerQuery) && !suggestions.includes(h)) suggestions.push(h);
      });
      setTypingSuggestions(suggestions.slice(0, 5));
    } else {
      setTypingSuggestions([]);
    }
  }, [query, history]);

  // Keyboard shortcut moved to useGlobalShortcuts.ts for better centralization
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'V' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        setVoiceOverlayOpen(true);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [setVoiceOverlayOpen]);

  // ── Semantic search ──
  const abortRef = useRef<AbortController | null>(null);
  // De-dupe guard: tracks the query currently in-flight so re-renders cannot
  // start a second identical semantic-search request before the first resolves.
  const inFlightQueryRef = useRef<string | null>(null);
  const performSemanticSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 3) {
      setResults([]);
      setSearchIntent(null);
      setSearchError(false);
      return;
    }
    // Reset error on every new search attempt
    setSearchError(false);

    const cached = searchCache.get(searchQuery);
    if (cached) {
      setResults(cached);
      setIsSearching(false);
      setIsAIProcessing(false);
      return;
    }

    // De-dupe identical in-flight query: prevents the semantic-search storm.
    if (inFlightQueryRef.current === searchQuery) return;
    inFlightQueryRef.current = searchQuery;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const startedAt = performance.now();
    setIsSearching(true);
    setIsAIProcessing(true);
    try {
      const { data: aiResponse } = await supabase.functions.invoke('semantic-search', {
        body: { query: searchQuery },
      });
      if (controller.signal.aborted) return;
      setIsAIProcessing(false);

      let intent: SearchIntent = {
        type: 'mixed',
        filters: {},
        keywords: searchQuery.split(' ').filter((w) => w.length > 2),
        originalQuery: searchQuery,
      };
      if (aiResponse?.success && aiResponse?.intent) {
        intent = aiResponse.intent;
        setSearchIntent(intent);
      }

      const allResults: SearchResult[] = [];

      if (intent.type === 'product' || intent.type === 'mixed') {
        try {
          const { fetchPromobrindProducts } = await import('@/lib/external-db');
          const { dedupeById: dedupeByIdUtil } = await import('@/utils/product-search');
          const productQuery = intent.keywords.join(' ') || searchQuery;
          const [prefixData, broadData] = await Promise.all([
            fetchPromobrindProducts({ filters: { _name_prefix: productQuery }, limit: 200 }),
            fetchPromobrindProducts({ search: productQuery, limit: 500 }),
          ]);
          let filteredProducts = dedupeByIdUtil([...prefixData, ...broadData]);

          if (intent.filters.category) {
            const catFilter = intent.filters.category.toLowerCase();
            filteredProducts = filteredProducts.filter((p) =>
              p.category_name?.toLowerCase().includes(catFilter),
            );
          }
          if (intent.filters.priceRange) {
            if (intent.filters.priceRange === 'low')
              filteredProducts = filteredProducts.filter(
                (p) => (p.sale_price || p.base_price || 0) < 50,
              );
            else if (intent.filters.priceRange === 'high')
              filteredProducts = filteredProducts.filter(
                (p) => (p.sale_price || p.base_price || 0) > 200,
              );
          }
          if (intent.filters.color) {
            const colorLower = intent.filters.color.toLowerCase();
            const colorFiltered = filteredProducts.filter((p) => {
              if (!p.colors) return false;
              const colors = Array.isArray(p.colors) ? p.colors : [];
              return colors.some((c) => {
                const rec = (typeof c === 'string' ? { name: c } : c) as {
                  name?: string;
                  label?: string;
                };
                return (
                  rec.name?.toLowerCase().includes(colorLower) ||
                  rec.label?.toLowerCase().includes(colorLower)
                );
              });
            });
            if (colorFiltered.length > 0) filteredProducts = colorFiltered;
          }

          const fuse = new Fuse(filteredProducts, createProductFuseOptions<PromobrindProduct>());
          rankProductSearchResults(filteredProducts, productQuery, fuse).forEach((p) => {
            allResults.push({
              id: p.id,
              title: p.name,
              subtitle: `SKU: ${p.sku} • ${p.category_name || 'Sem categoria'} • ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.sale_price || p.base_price || 0)}`,
              type: 'product',
              href: `/produto/${p.id}`,
            });
          });
        } catch {
          /* silent */
        }
      }

      if (intent.type === 'client' || intent.type === 'mixed') {
        try {
          const { searchCrm } = await import('@/lib/crm-db');
          const searchTerm = intent.filters.clientName || intent.keywords.join(' ');
          if (searchTerm) {
            const companies = await searchCrm<Record<string, string>>(
              'companies',
              'razao_social',
              searchTerm,
              { select: 'id, razao_social, nome_fantasia, ramo', limit: 5 },
            );
            companies.forEach((c) => {
              allResults.push({
                id: c.id,
                title: c.nome_fantasia || c.razao_social,
                subtitle: c.ramo || 'Empresa',
                type: 'client',
                href: `/cliente/${c.id}`,
              });
            });
          }
        } catch {
          /* silent */
        }
      }

      if (intent.type === 'quote' || intent.type === 'mixed') {
        try {
          const { selectCrm } = await import('@/lib/crm-db');
          const filters: Record<string, unknown> = {};
          if (intent.filters.status) filters.status = intent.filters.status;
          const quotes = await selectCrm<Record<string, unknown>>('quotes', {
            filters,
            orderBy: { column: 'created_at', ascending: false },
            limit: 5,
          });
          let filteredQuotes = quotes || [];
          if (intent.filters.clientName) {
            const cLower = intent.filters.clientName.toLowerCase();
            filteredQuotes = filteredQuotes.filter((q) =>
              (q.client_name as string)?.toLowerCase().includes(cLower),
            );
          }
          filteredQuotes.forEach((q) => {
            allResults.push({
              id: q.id as string,
              title: q.quote_number as string,
              subtitle: `${q.client_name || 'Sem cliente'} • ${q.status} • ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((q.total as number) || 0)}`,
              type: 'quote',
              href: `/orcamentos/${q.id}`,
            });
          });
        } catch {
          /* silent */
        }
      }

      const rawTerm = (intent.keywords.join(' ') || searchQuery).toLowerCase();
      const term = rawTerm.replace(/[%_\\(),.*]/g, '').trim();
      if (!term) {
        setResults([]);
        setSearchIntent(intent);
        return;
      }
      const wants = (t: SearchResultType) =>
        intent.type === t || intent.type === 'mixed' || intent.entities?.includes(t);

      const simpleQueries: Array<{
        type: SearchResultType;
        table: string;
        select: string;
        filter?: string;
        titleField: string;
        subtitleField?: string;
        hrefPrefix: string;
      }> = [
        {
          type: 'collection',
          table: 'collections',
          select: 'id, name, description, icon',
          titleField: 'name',
          subtitleField: 'description',
          hrefPrefix: '/colecoes/',
        },
        {
          type: 'conversation',
          table: 'expert_conversations',
          select: 'id, title, updated_at',
          titleField: 'title',
          hrefPrefix: '/expert?conversation=',
        },
        {
          type: 'category',
          table: 'category_icons',
          select: 'id, category_name, description, icon',
          titleField: 'category_name',
          subtitleField: 'description',
          hrefPrefix: '/?category=',
        },
      ];

      for (const q of simpleQueries) {
        if (wants(q.type)) {
          try {
            let builder = untypedFrom(q.table).select(q.select);

            if (q.type === 'category')
              builder = builder
                .eq('is_active', true)
                .or(`category_name.ilike.%${term}%,description.ilike.%${term}%`);
            else if (q.type === 'collection') builder = builder.ilike('name', `%${term}%`);
            else if (q.type === 'conversation')
              builder = builder
                .ilike('title', `%${term}%`)
                .order('updated_at', { ascending: false });
            const { data } = await builder.limit(5);
            ((data ?? []) as unknown as Record<string, unknown>[]).forEach((row) => {
              const id = row.id as string;
              allResults.push({
                id,
                type: q.type,
                title:
                  ((q.type === 'category' ? row.category_name : row[q.titleField]) as string) || '',
                subtitle: q.subtitleField ? (row[q.subtitleField] as string) || '' : undefined,
                href:
                  q.type === 'category'
                    ? `${q.hrefPrefix}${encodeURIComponent(row.category_name as string)}`
                    : `${q.hrefPrefix}${id}`,
                metadata:
                  q.type === 'collection' || q.type === 'category' ? { icon: row.icon } : undefined,
              });
            });
          } catch {
            /* silent */
          }
        }
      }

      if (wants('kit')) {
        try {
          const { data } = await supabase
            .from('custom_kits')
            .select('id, name, status, total_price, kit_quantity')
            .ilike('name', `%${term}%`)
            .limit(5);
          (data || []).forEach((k) =>
            allResults.push({
              id: k.id,
              title: k.name ?? '',
              subtitle: `${k.status} • ${k.kit_quantity}x • ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(k.total_price || 0)}`,
              type: 'kit',
              href: `/kits/${k.id}`,
            }),
          );
        } catch {
          /* silent */
        }
      }
      if (wants('mockup')) {
        try {
          const { data } = await supabase
            .from('generated_mockups')
            .select('id, product_name, technique_name, created_at')
            .or(`product_name.ilike.%${term}%,technique_name.ilike.%${term}%`)
            .order('created_at', { ascending: false })
            .limit(5);
          (data || []).forEach((m) =>
            allResults.push({
              id: m.id,
              title: m.product_name || 'Mockup',
              subtitle: m.technique_name || '—',
              type: 'mockup',
              href: `/mockups/${m.id}`,
            }),
          );
        } catch {
          /* silent */
        }
      }
      if (wants('art_file')) {
        try {
          const { data } = await supabase
            .from('art_file_attachments')
            .select('id, original_name, notes, file_url, quote_id')
            .or(`original_name.ilike.%${term}%,notes.ilike.%${term}%`)
            .order('created_at', { ascending: false })
            .limit(5);
          (data || []).forEach((a) =>
            allResults.push({
              id: a.id,
              title: a.original_name,
              subtitle: a.notes || 'Arquivo de arte',
              type: 'art_file',
              href: a.quote_id ? `/orcamentos/${a.quote_id}` : a.file_url,
              metadata: { file_url: a.file_url },
            }),
          );
        } catch {
          /* silent */
        }
      }
      if (wants('cart_template')) {
        try {
          const { data } = await supabase
            .from('cart_templates')
            .select('id, name, description, items')
            .or(`name.ilike.%${term}%,description.ilike.%${term}%`)
            .limit(5);
          (data || []).forEach((t) => {
            const itemCount = Array.isArray(t.items) ? t.items.length : 0;
            allResults.push({
              id: t.id,
              title: t.name,
              subtitle: `${itemCount} ${itemCount === 1 ? 'item' : 'itens'} • ${t.description || 'Template de carrinho'}`,
              type: 'cart_template',
              href: `/carrinho?template=${t.id}`,
            });
          });
        } catch {
          /* silent */
        }
      }
      if (wants('magic_up')) {
        try {
          const { data } = await supabase
            .from('magic_up_generations')
            .select(
              'id, client_name, product_name, scene_title, scene_category, generated_image_url, created_at',
            )
            .or(
              `client_name.ilike.%${term}%,product_name.ilike.%${term}%,scene_title.ilike.%${term}%,scene_category.ilike.%${term}%`,
            )
            .order('created_at', { ascending: false })
            .limit(5);
          (data || []).forEach((m) =>
            allResults.push({
              id: m.id,
              title: m.scene_title || m.product_name || 'Magic Up',
              subtitle: `${m.client_name || 'Sem cliente'} • ${m.product_name || ''}${m.scene_category ? ` • ${m.scene_category}` : ''}`,
              type: 'magic_up',
              href: '/magic-up',
              metadata: { image_url: m.generated_image_url },
            }),
          );
        } catch {
          /* silent */
        }
      }
      if (wants('component')) {
        try {
          const { data } = await supabase
            .from('product_components')
            .select('id, component_code, component_name, product_id, is_personalizable')
            .eq('is_active', true)
            .or(`component_name.ilike.%${term}%,component_code.ilike.%${term}%`)
            .limit(5);
          (data || []).forEach((c) =>
            allResults.push({
              id: c.id,
              title: c.component_name,
              subtitle: `Código: ${c.component_code}${c.is_personalizable ? ' • Personalizável' : ''}`,
              type: 'component',
              href: `/produto/${c.product_id}`,
            }),
          );
        } catch {
          /* silent */
        }
      }
      if (wants('media')) {
        try {
          const { data } = await supabase
            .from('component_media')
            .select('id, title, media_type, url, product_id')
            .ilike('title', `%${term}%`)
            .order('created_at', { ascending: false })
            .limit(5);
          (data || []).forEach((m) =>
            allResults.push({
              id: m.id,
              title: m.title || 'Mídia sem título',
              subtitle: `${m.media_type === 'video' ? '🎬 Vídeo' : '🖼️ Imagem'} • Componente`,
              type: 'media',
              href: m.product_id ? `/produto/${m.product_id}` : m.url,
              metadata: { url: m.url },
            }),
          );
        } catch {
          /* silent */
        }
      }

      if (controller.signal.aborted) return;

      // Include matching slash commands in general results if they match keywords
      if (searchQuery.length >= 3) {
        const lowerQuery = searchQuery.toLowerCase();
        const matchedCmds = commandsRef.current
          .filter(
            (c) =>
              c.command.toLowerCase().includes(lowerQuery) ||
              c.label.toLowerCase().includes(lowerQuery) ||
              c.keywords?.some((k) => k.toLowerCase().includes(lowerQuery)),
          )
          .slice(0, 3)
          .map((c) => ({
            id: `cmd-${c.id}`,
            title: c.label,
            subtitle: c.description,
            type: 'command' as const,
            href: `command:${c.id}`,
            metadata: { iconName: c.icon },
          }));
        allResults.push(...matchedCmds);
      }

      const candidates = allResults
        .filter((r) => RERANK_TYPES.includes(r.type))
        .map((r) => ({ id: r.id, label: r.title, sublabel: r.subtitle ?? '' }));

      let finalResults = allResults;
      if (candidates.length > 1) {
        try {
          const { data: ranked } = await supabase.rpc('search_records_rerank', {
            _query: searchQuery,
            _candidates: candidates,
          });
          if (ranked && Array.isArray(ranked) && ranked.length > 0) {
            const scoreMap = new Map<string, number>();
            (ranked as Array<{ id: string; score: number }>).forEach((r) =>
              scoreMap.set(r.id, r.score),
            );
            const others = allResults.filter((r) => !RERANK_TYPES.includes(r.type));
            const reranked = allResults
              .filter((r) => RERANK_TYPES.includes(r.type))
              .sort((a, b) => (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0));
            finalResults = [...others, ...reranked];
          }
        } catch {
          /* silent rerank failure */
        }
      }

      setResults(finalResults);
      searchCache.set(searchQuery, finalResults);

      const latencyMs = Math.round(performance.now() - startedAt);
      void supabase.auth.getUser().then(
        ({ data }) => {
          const userId = data.user?.id;
          if (!userId) return;
          return supabase
            .from('search_analytics')
            .insert({
              user_id: userId,
              search_term: redactPii(searchQuery.toLowerCase().trim()).slice(0, 200),
              results_count: finalResults.length,
              search_context: JSON.stringify({ latency_ms: latencyMs, intent_type: intent.type }),
            })
            .then(
              () => undefined,
              () => undefined,
            );
        },
        () => undefined,
      );
    } catch {
      // FIX BUG-GS-07: propagate error state so UI can show feedback instead of
      // silently showing empty results when a network/auth/timeout error occurs.
      setIsAIProcessing(false);
      if (!abortRef.current?.signal.aborted) setSearchError(true);
    } finally {
      // Release the in-flight lock only if this call still owns it (a newer
      // query may have replaced it).
      if (inFlightQueryRef.current === searchQuery) inFlightQueryRef.current = null;
      if (!controller.signal.aborted) setIsSearching(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (debouncedQuery.startsWith('/')) {
      const lowerQuery = debouncedQuery.toLowerCase();
      const matchedCommands = commandsRef.current
        .filter(
          (c) =>
            c.command.toLowerCase().includes(lowerQuery) ||
            c.keywords?.some((k) => k.toLowerCase().includes(lowerQuery.slice(1))),
        )
        .map((c) => ({
          id: c.id,
          title: c.label,
          subtitle: c.description,
          type: 'command' as const,
          href: `command:${c.id}`,
          metadata: { iconName: c.icon },
        }));
      setResults(matchedCommands);
      setSearchIntent(null);
      setIsSearching(false);
      setIsAIProcessing(false);
      return;
    }
    performSemanticSearch(debouncedQuery);
    // NOTE: commands intentionally NOT a dependency here. It changed identity
    // every render and re-fired this effect, causing the semantic-search request
    // storm. Slash-command matches read the latest commands via commandsRef.
  }, [debouncedQuery, performSemanticSearch]);

  const handleSelect = useCallback(
    (href: string, saveToHistory = true) => {
      if (href.startsWith('command:')) {
        const cmdId = href.split(':')[1];
        const cmd = commands.find((c) => c.id === cmdId);
        if (cmd) {
          cmd.action();
          setOpen(false);
          setQuery('');
          setResults([]);
          setSearchIntent(null);
          setTypingSuggestions([]);
          return;
        }
      }
      if (saveToHistory && query.trim()) {
        addGlobalHistoryItem({
          id: `history-${query.trim()}`,
          label: query.trim(),
          type: 'general',
        });
        pushRecentSearch(query.trim());
      }
      setOpen(false);
      setQuery('');
      setResults([]);
      setSearchIntent(null);
      setTypingSuggestions([]);
      if (/^https?:\/\//.test(href)) window.open(href, '_blank', 'noopener,noreferrer');
      else navigate(href);
    },
    [commands, query, addGlobalHistoryItem, navigate, setOpen],
  );

  const handleSuggestionClick = useCallback((suggestion: string) => {
    setQuery(suggestion);
  }, []);

  const handleRemoveFromHistory = useCallback(
    (e: React.MouseEvent, term: string) => {
      e.stopPropagation();
      removeFromHistory(`history-${term}`);
    },
    [removeFromHistory],
  );

  const groupedResults = results.reduce<Record<string, SearchResult[]>>((acc, result) => {
    if (!acc[result.type]) acc[result.type] = [];
    acc[result.type].push(result);
    return acc;
  }, {});

  return {
    open,
    setOpen,
    query,
    setQuery,
    results,
    isSearching,
    isAIProcessing,
    searchIntent,
    searchError,
    popularProducts,
    typingSuggestions,
    // quickSuggestions: campo obrigatorio em GlobalSearchIdleState.
    // Retorna [] por ora — o componente nao renderiza a secao quando vazio.
    // Futuramente pode ser populado com sugestoes dinamicas.
    quickSuggestions: [] as QuickSuggestion[],
    voiceOverlayOpen,
    setVoiceOverlayOpen,
    handleOpenVoiceOverlay,
    handleCloseVoiceOverlay,
    handleVoiceAction,
    performSemanticSearch,
    handleSelect,
    groupedResults,
    contextualSuggestions,
    routeContext,
    history,
    addToHistory: (term: string) =>
      addGlobalHistoryItem({ id: `history-${term}`, label: term, type: 'general' }),
    removeFromHistory: (term: string) => removeFromHistory(`history-${term}`),
    clearHistory,
    handleSuggestionClick,
    handleRemoveFromHistory,
  };
}
