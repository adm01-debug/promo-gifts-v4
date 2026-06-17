import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface DebouncedPriceInputProps {
  value: number | string;
  onChange: (value: number) => void;
  fallback?: number;
  placeholder?: string;
  min?: number;
  className?: string;
  debounceMs?: number;
}

export function DebouncedPriceInput({
  value,
  onChange,
  fallback = 0,
  placeholder,
  min,
  className = '',
  debounceMs = 600,
}: DebouncedPriceInputProps) {
  const [localValue, setLocalValue] = useState(String(value));
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Sync external value → local (only when not focused)
  useEffect(() => {
    setLocalValue(String(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalValue(raw);

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onChange(Number(raw) || fallback);
    }, debounceMs);
  };

  const handleBlur = () => {
    clearTimeout(timerRef.current);
    onChange(Number(localValue) || fallback);
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <Input
      type="number"
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      className={cn('h-8 text-sm transition-colors', className)}
      placeholder={placeholder}
      min={min}
    />
  );
}
