/**
 * ColorSwatch — quadradinho da cor real do produto na proposta (#9).
 *
 * Borda WCAG 1.4.11 (≥3:1): cores claras recebem contorno escuro para não
 * sumirem no fundo branco. Decorativo (aria-hidden) — o nome da cor ao lado dá a
 * informação textual acessível. Não renderiza nada se o hex for inválido
 * (fallback seguro: fica só o nome da cor).
 * @fix_version proposal-color-swatch-9-2026-06
 */
import { isHex6, swatchBorderColor } from '@/utils/colorContrast';

interface ColorSwatchProps {
  hex?: string | null;
  size?: number;
}

export function ColorSwatch({ hex, size = 10 }: ColorSwatchProps) {
  if (!isHex6(hex)) return null;
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: `${size}px`,
        height: `${size}px`,
        background: hex,
        border: `1px solid ${swatchBorderColor(hex)}`,
        borderRadius: '2px',
        marginRight: '5px',
        verticalAlign: 'middle',
      }}
    />
  );
}
