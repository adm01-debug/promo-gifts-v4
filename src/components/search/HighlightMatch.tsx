import { memo } from 'react';

interface HighlightMatchProps {
  text: string;
  query: string;
  className?: string;
  highlightClassName?: string;
}

/**
 * Highlights matching portions of text based on the search query.
 * Splits the query into words and highlights each match.
 * Includes diacritic-insensitive matching.
 */
export const HighlightMatch = memo(function HighlightMatch({
  text,
  query,
  className = '',
  highlightClassName = 'bg-primary/20 text-primary font-semibold rounded-sm px-0.5',
}: HighlightMatchProps) {
  if (!query || query.length < 2) {
    return <span className={className}>{text}</span>;
  }

  // Remove diacritics for comparison
  const normalize = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const words = query
    .trim()
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  if (words.length === 0) {
    return <span className={className}>{text}</span>;
  }

  // To highlight diacritic-insensitive, we need a smarter approach than simple split
  // We'll create a regex that matches the words even with accents
  const createDiacriticRegex = (word: string) => {
    return word
      .split('')
      .map((char) => {
        const normalized = normalize(char);
        if (normalized === 'a') return '[aàáâãäå]';
        if (normalized === 'e') return '[eèéêë]';
        if (normalized === 'i') return '[iìíîï]';
        if (normalized === 'o') return '[oòóôõö]';
        if (normalized === 'u') return '[uùúûü]';
        if (normalized === 'c') return '[cç]';
        if (normalized === 'n') return '[nñ]';
        return char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('');
  };

  const regexStr = words.map(createDiacriticRegex).join('|');
  const regex = new RegExp(`(${regexStr})`, 'gi');
  const parts = text.split(regex);

  return (
    <span className={className}>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className={highlightClassName}>
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
});
