/**
 * whitelabel-comparison (C6 #3) — Gera PDF white-label com branding do cliente vinculado.
 * Busca companies.brand_logo_url / brand_color quando há clientId; cai para genérico se ausente.
 */
import { supabase } from '@/integrations/supabase/client';
import { type createClient } from '@supabase/supabase-js';
const db = supabase as unknown as ReturnType<typeof createClient>;

export interface ClientBranding {
  name: string | null;
  logoUrl: string | null;
  brandColor: string | null;
}

export async function fetchClientBranding(clientId: string | null): Promise<ClientBranding | null> {
  if (!clientId) return null;
  try {
    const { data, error } = await db
      .from('companies')
      .select('name, brand_logo_url, brand_color')
      .eq('id', clientId)
      .maybeSingle();
    if (error || !data) return null;
    const d = data as Record<string, unknown>;
    return {
      name: (d.name as string | null) ?? null,
      logoUrl: (d.brand_logo_url as string | null) ?? null,
      brandColor: (d.brand_color as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

export async function exportWhitelabelComparisonPDF(opts: {
  targetSelector: string;
  clientId: string | null;
  fileName?: string;
}): Promise<void> {
  const { targetSelector, clientId } = opts;
  const [{ default: jsPDF }, html2canvasMod] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);
  const html2canvas = html2canvasMod.default;
  const el = document.querySelector(targetSelector);
  if (!(el instanceof HTMLElement)) throw new Error('Área de exportação não encontrada');

  const branding = await fetchClientBranding(clientId);
  const canvas = await html2canvas(el, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
  const imgData = canvas.toDataURL('image/png');

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Header bar
  const accent = branding?.brandColor ?? '#0f172a';
  const [r, g, b] = hexToRgb(accent);
  pdf.setFillColor(r, g, b);
  pdf.rect(0, 0, pageWidth, 14, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(13);
  pdf.text(
    branding?.name
      ? `Comparação de Produtos — ${branding.name}`
      : 'Comparação de Produtos — Promo Gifts',
    10,
    9,
  );
  pdf.setFontSize(8);
  pdf.text(new Date().toLocaleDateString('pt-BR'), pageWidth - 30, 9);

  // Logo do cliente (se houver)
  if (branding?.logoUrl) {
    try {
      const logoData = await fetchImageAsDataUrl(branding.logoUrl);
      if (logoData) pdf.addImage(logoData, 'PNG', pageWidth - 50, 2, 18, 10);
    } catch {
      /* silencioso */
    }
  }

  pdf.setTextColor(0, 0, 0);
  const imgWidth = pageWidth - 20;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  if (imgHeight < pageHeight - 25) {
    pdf.addImage(imgData, 'PNG', 10, 20, imgWidth, imgHeight);
  } else {
    let position = 20;
    let remaining = imgHeight;
    const sliceHeight = pageHeight - 25;
    while (remaining > 0) {
      pdf.addImage(imgData, 'PNG', 10, position - (imgHeight - remaining), imgWidth, imgHeight);
      remaining -= sliceHeight;
      if (remaining > 0) {
        pdf.addPage();
        position = 10;
      }
    }
  }
  pdf.save(opts.fileName ?? `comparacao-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '').match(/.{1,2}/g);
  if (!m || m.length < 3) return [15, 23, 42];
  return [parseInt(m[0], 16), parseInt(m[1], 16), parseInt(m[2], 16)];
}

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
