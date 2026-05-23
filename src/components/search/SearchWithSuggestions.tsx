import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, Mic, MicOff, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/common';

interface SearchWithSuggestionsProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  suggestions?: string[];
  recentSearches?: string[];
  isLoading?: boolean;
  className?: string;
  enableVoice?: boolean;
}

export function SearchWithSuggestions({
  placeholder = 'Buscar...',
  onSearch,
  suggestions = [],
  recentSearches = [],
  isLoading = false,
  className,
  enableVoice = false,
}: SearchWithSuggestionsProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const onSearchRef = useRef(onSearch);
  const lastSearchedRef = useRef('');
  const debouncedQuery = useDebounce(query, 300);

  // Keep onSearch ref updated to avoid stale closures
  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  // Combine suggestions and recent searches
  const allSuggestions = query.length > 0 ? suggestions : recentSearches.slice(0, 5);

  // Only call onSearch when debouncedQuery actually changes to a new value
  useEffect(() => {
    if (debouncedQuery !== lastSearchedRef.current) {
      lastSearchedRef.current = debouncedQuery;
      onSearchRef.current(debouncedQuery);
    }
  }, [debouncedQuery]); // Remove onSearch from dependencies - use ref instead

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < allSuggestions.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : allSuggestions.length - 1));
      } else if (e.key === 'Enter' && selectedIndex >= 0) {
        e.preventDefault();
        const selected = allSuggestions[selectedIndex];
        setQuery(selected);
        onSearch(selected);
        setIsFocused(false);
      } else if (e.key === 'Escape') {
        setIsFocused(false);
        inputRef.current?.blur();
      }
    },
    [allSuggestions, selectedIndex, onSearch],
  );

  const handleVoiceSearch = useCallback(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      return;
    }

    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setQuery(transcript);
      onSearch(transcript);
    };

    recognition.start();
  }, [onSearch]);

  const clearSearch = () => {
    setQuery('');
    onSearch('');
    inputRef.current?.focus();
  };

  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary"
          aria-hidden="true"
        />
        <Input
          ref={inputRef}
          type="search"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          onKeyDown={handleKeyDown}
          className="pl-10 pr-20"
          aria-label="Campo de busca"
          aria-expanded={isFocused && allSuggestions.length > 0}
          aria-autocomplete="list"
          aria-controls="search-suggestions"
          role="combobox"
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
          )}
          {query && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={clearSearch}
              aria-label="Limpar busca"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
          {enableVoice && 'webkitSpeechRecognition' in window && (
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-6 w-6', isListening && 'text-destructive')}
              onClick={handleVoiceSearch}
              aria-label={isListening ? 'Parar gravação' : 'Buscar por voz'}
            >
              {isListening ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
            </Button>
          )}
        </div>
      </div>

      {/* Suggestions dropdown */}
      {isFocused && allSuggestions.length > 0 && (
        <div
          id="search-suggestions"
          className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border bg-popover shadow-lg"
          role="listbox"
        >
          {query.length === 0 && recentSearches.length > 0 && (
            <div className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">
              Buscas recentes
            </div>
          )}
          {allSuggestions.map((suggestion, index) => (
            <button
              key={suggestion}
              className={cn(
                'w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted',
                selectedIndex === index && 'bg-muted',
              )}
              onClick={() => {
                setQuery(suggestion);
                onSearch(suggestion);
                setIsFocused(false);
              }}
              role="option"
              aria-selected={selectedIndex === index}
            >
              <Search
                className="mr-2 inline-block h-3 w-3 text-muted-foreground"
                aria-hidden="true"
              />
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
