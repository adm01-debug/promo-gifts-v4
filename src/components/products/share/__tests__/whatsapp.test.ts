import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { openWhatsAppShare } from '../whatsapp';

describe('whatsapp.ts - normalização e abertura', () => {
  let openSpy: ReturnType<typeof vi.fn>;
  let originalOpen: typeof window.open;

  beforeEach(() => {
    originalOpen = window.open;
    openSpy = vi.fn(() => ({ focus: vi.fn() }) as unknown as Window);
    window.open = openSpy as unknown as typeof window.open;
  });

  afterEach(() => {
    window.open = originalOpen;
  });

  it('abre WhatsApp sem telefone (modo broadcast)', () => {
    const { url, opened } = openWhatsAppShare({ message: 'Olá', phone: null });
    expect(opened).toBe(true);
    expect(url).toBe('https://wa.me/?text=Ol%C3%A1');
    expect(openSpy).toHaveBeenCalledOnce();
  });

  it('adiciona prefixo 55 para celular brasileiro de 11 dígitos', () => {
    const { url } = openWhatsAppShare({ message: 'Oi', phone: '11987654321' });
    expect(url).toBe('https://wa.me/5511987654321?text=Oi');
  });

  it('adiciona prefixo 55 para fixo brasileiro de 10 dígitos', () => {
    const { url } = openWhatsAppShare({ message: 'Oi', phone: '1133334444' });
    expect(url).toBe('https://wa.me/551133334444?text=Oi');
  });

  it('não duplica prefixo 55 quando já presente', () => {
    const { url } = openWhatsAppShare({ message: 'Oi', phone: '5511987654321' });
    expect(url).toBe('https://wa.me/5511987654321?text=Oi');
  });

  it('remove máscara antes de normalizar', () => {
    const { url } = openWhatsAppShare({ message: 'Oi', phone: '(11) 98765-4321' });
    expect(url).toBe('https://wa.me/5511987654321?text=Oi');
  });

  it('codifica mensagens com emojis e quebras de linha', () => {
    const { url } = openWhatsAppShare({
      message: '🎁 *KIT*\nValor: R$ 100,00',
      phone: '11987654321',
    });
    expect(url).toContain('%F0%9F%8E%81');
    expect(url).toContain('%0A');
  });

  it('faz fallback para location.href quando popup é bloqueado', () => {
    openSpy.mockReturnValueOnce(null);
    const hrefSetter = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        get href() {
          return '';
        },
        set href(v: string) {
          hrefSetter(v);
        },
      },
    });
    const { opened } = openWhatsAppShare({ message: 'Oi', phone: '11987654321' });
    expect(opened).toBe(true);
    expect(hrefSetter).toHaveBeenCalledWith('https://wa.me/5511987654321?text=Oi');
  });
});

describe('whatsapp.ts - validação de telefone (lógica replicada do UI)', () => {
  const validate = (phone: string | null | undefined): string | null => {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) return 'Telefone muito curto (mínimo 10 dígitos)';
    if (digits.length > 13) return 'Telefone muito longo';
    return null;
  };

  it.each([
    ['', null],
    [null, null],
    ['123', 'Telefone muito curto (mínimo 10 dígitos)'],
    ['(11) 9876', 'Telefone muito curto (mínimo 10 dígitos)'],
    ['1133334444', null],
    ['11987654321', null],
    ['5511987654321', null],
    ['12345678901234', 'Telefone muito longo'],
  ])('phone=%s → %s', (phone, expected) => {
    expect(validate(phone)).toBe(expected);
  });
});
