const BRAZIL_COUNTRY_CODE = '55';

function normalizePhoneForWhatsApp(phone?: string | null) {
  if (!phone) return '';

  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith(BRAZIL_COUNTRY_CODE) && digits.length >= 12) {
    return digits;
  }

  if (digits.length === 10 || digits.length === 11) {
    return `${BRAZIL_COUNTRY_CODE}${digits}`;
  }

  return digits;
}

export function openWhatsAppShare({ message, phone }: { message: string; phone?: string | null }): {
  url: string;
  opened: boolean;
} {
  const encodedMessage = encodeURIComponent(message);
  const normalizedPhone = normalizePhoneForWhatsApp(phone);
  const url = normalizedPhone
    ? `https://wa.me/${normalizedPhone}?text=${encodedMessage}`
    : `https://wa.me/?text=${encodedMessage}`;

  let opened = false;
  if (typeof window !== 'undefined') {
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    opened = win !== null;

    // Fallback: if popup was blocked, try location redirect
    if (!opened) {
      try {
        window.location.href = url;
        opened = true;
      } catch {
        // silently fail — caller should show toast
      }
    }
  }

  return { url, opened };
}
