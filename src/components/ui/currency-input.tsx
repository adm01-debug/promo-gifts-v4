import { useEffect, useId, useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface CurrencyInputProps {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Mostra "0,00" mesmo quando o valor é 0 (default false). */
  showZero?: boolean;
  /** Valor mínimo permitido (default 0). */
  min?: number;
  /** Valor máximo permitido. */
  max?: number;
  /** Notifica se há erro de validação (útil pra desabilitar submit). */
  onValidityChange?: (valid: boolean) => void;
  [key: string]: unknown;
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const formatBR = (n: number) =>
  round2(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Apenas dígitos e separadores; sinal `-` só quando explicitamente permitido.
const RE_NO_NEG = /^[\d.,]*$/;
const RE_WITH_NEG = /^-?[\d.,]*$/;

export const parseStrict = (raw: string, allowNegative: boolean): { n: number; ok: boolean } => {
  const trimmed = raw.trim();
  if (!trimmed) return { n: 0, ok: true }; // vazio = 0 (válido)
  const re = allowNegative ? RE_WITH_NEG : RE_NO_NEG;
  if (!re.test(trimmed)) return { n: NaN, ok: false };
  const clean = trimmed
    .replace(/\.(?=\d{3}(\D|$))/g, '') // remove pontos de milhar
    .replace(',', '.');
  const n = parseFloat(clean);
  if (!Number.isFinite(n)) return { n: NaN, ok: false };
  return { n: round2(n), ok: true };
};

/**
 * Input monetário com vírgula como separador decimal (pt-BR).
 * - Enquanto digita: mantém a string crua (permite ponto e vírgula).
 * - Ao sair (blur): formata como "1.234,56" e arredonda para 2 casas.
 * - Valida: bloqueia letras/símbolos, exige número finito, respeita min/max.
 */
export function CurrencyInput({
  value,
  onChange,
  placeholder = '0,00',
  className,
  disabled,
  showZero = false,
  min = 0,
  max,
  onValidityChange,
  ...props
}: CurrencyInputProps) {
  const allowNegative = min < 0;
  const [text, setText] = useState<string>(value || showZero ? formatBR(value) : '');
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();

  useEffect(() => {
    if (focused) return;
    setText(value || showZero ? formatBR(value) : '');
  }, [value, focused, showZero]);

  const setValidity = (msg: string | null) => {
    setError(msg);
    onValidityChange?.(msg === null);
  };

  const validateRange = (n: number): string | null => {
    if (!allowNegative && n < 0) return 'Valores negativos não são permitidos.';
    if (n < min) return `Valor mínimo é ${formatBR(min)}.`;
    if (typeof max === 'number' && n > max) return `Valor máximo é ${formatBR(max)}.`;
    return null;
  };

  return (
    <div className="w-full">
      <Input
        {...props}
        type="text"
        inputMode={allowNegative ? 'decimal' : 'decimal'}
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(error && 'border-destructive focus-visible:ring-destructive', className)}
        onFocus={() => setFocused(true)}
        onKeyDown={(e) => {
          // Bloqueia "-" e "+" quando negativos não são permitidos
          if (!allowNegative && (e.key === '-' || e.key === '+')) {
            e.preventDefault();
          }
        }}
        onChange={(e) => {
          // Strip "-" do paste/autofill quando proibido
          const raw = allowNegative ? e.target.value : e.target.value.replace(/-/g, '');
          setText(raw);
          const { n, ok } = parseStrict(raw, allowNegative);
          if (!ok) {
            setValidity('Digite um valor numérico válido.');
            return;
          }
          const rangeErr = validateRange(n);
          if (rangeErr) {
            setValidity(rangeErr);
            return;
          }
          setValidity(null);
          onChange(n);
        }}
        onBlur={() => {
          setFocused(false);
          const { n, ok } = parseStrict(text, allowNegative);
          if (!ok) {
            setValidity('Digite um valor numérico válido.');
            return;
          }
          const rangeErr = validateRange(n);
          if (rangeErr) {
            setValidity(rangeErr);
            return;
          }
          setValidity(null);
          onChange(n);
          setText(n || showZero ? formatBR(n) : '');
        }}
      />
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
