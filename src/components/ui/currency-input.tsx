import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface CurrencyInputProps {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Mostra "0,00" mesmo quando o valor é 0 (default true). */
  showZero?: boolean;
}

const formatBR = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const parseBR = (raw: string): number => {
  const clean = raw.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const n = parseFloat(clean);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Input monetário com vírgula como separador decimal (pt-BR).
 * - Enquanto digita: mantém a string crua (permite ponto e vírgula).
 * - Ao sair (blur): formata como "1.234,56".
 */
export function CurrencyInput({
  value,
  onChange,
  placeholder = '0,00',
  className,
  disabled,
  showZero = false,
}: CurrencyInputProps) {
  const [text, setText] = useState<string>(value || showZero ? formatBR(value) : '');
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (focused) return;
    setText(value || showZero ? formatBR(value) : '');
  }, [value, focused, showZero]);

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={text}
      placeholder={placeholder}
      disabled={disabled}
      className={cn(className)}
      onFocus={() => setFocused(true)}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d,.-]/g, '');
        setText(raw);
        onChange(parseBR(raw));
      }}
      onBlur={() => {
        setFocused(false);
        const n = parseBR(text);
        onChange(n);
        setText(n || showZero ? formatBR(n) : '');
      }}
    />
  );
}
