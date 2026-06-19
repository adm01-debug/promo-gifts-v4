/**
 * Proposal PDF Generator v3 — HTML→PDF via html2canvas + jsPDF
 *
 * Renders pixel-perfect HTML template offscreen (multi-page),
 * captures each page with html2canvas, and outputs as PDF.
 *
 * FIXES (2026-05):
 *  - root.unmount() movido para finally externo → sem memory leak em erro (Bug #1)
 *  - img.complete check aprimorado: naturalWidth > 0 (Bug #3 support)
 */

const getJsPDF = () => import('jspdf').then((m) => m.jsPDF);
const getHtml2Canvas = () => import('html2canvas').then((m) => m.default);
import React from 'react';
import ReactDOM from 'react-dom/client';
import { type ProposalTemplateData } from '@/components/pdf/ProposalHtmlTemplate';
import { PropostaComercialTailwind } from '@/components/pdf/PropostaComercialTailwind';

export async function generateProposalPDFv2(
  data: ProposalTemplateData,
  options?: { isDraft?: boolean },
): Promise<Blob> {
  const [jsPDF, html2canvas] = await Promise.all([getJsPDF(), getHtml2Canvas()]);

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-10000px';
  container.style.left = '-10000px';
  container.style.zIndex = '-9999';
  container.style.pointerEvents = 'none';
  document.body.appendChild(container);

  // FIX #1: declarar root fora do try para garantir unmount no finally externo
  let root: ReturnType<typeof ReactDOM.createRoot> | null = null;

  try {
    root = ReactDOM.createRoot(container);
    const templateRef = React.createRef<HTMLDivElement>();

    root.render(
      React.createElement(PropostaComercialTailwind, {
        data,
        ref: templateRef,
        isDraft: options?.isDraft ?? false,
      }),
    );

    // Poll until React renders (max 2s) instead of fixed 3s wait
    const renderStart = Date.now();
    await new Promise<void>((resolve) => {
      const check = () => {
        if (templateRef.current || Date.now() - renderStart > 2000) {
          resolve();
        } else {
          requestAnimationFrame(check);
        }
      };
      requestAnimationFrame(check);
    });

    const wrapper = templateRef.current || (container.firstElementChild as HTMLElement);
    if (!wrapper) throw new Error('Failed to render proposal template');

    // Wait for all images + Google Fonts in parallel
    const images = wrapper.querySelectorAll('img');
    const imgPromises = [...images].map(
      (img) =>
        new Promise<void>((resolve) => {
          // FIX: naturalWidth > 0 evita tratar img com src vazio como "carregada"
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          if (img.complete && img.src === '') {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
          setTimeout(resolve, 5000);
        }),
    );
    const fontPromise = document.fonts?.ready
      ? Promise.race([
          document.fonts.ready,
          new Promise((r) => {
            setTimeout(r, 1000);
          }),
        ])
      : new Promise((r) => {
          setTimeout(r, 500);
        });

    await Promise.all([...imgPromises, fontPromise]);

    // Find all page elements
    const pageElements = wrapper.querySelectorAll('.proposal-page');
    const pages = pageElements.length > 0 ? [...pageElements] : [wrapper];

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    // ── BUG FIX (html2canvas issue #2775) ────────────────────────────────────
    // Tailwind CSS Preflight define globalmente `img { display: block }`.
    // Durante a captura, html2canvas interpreta esse estilo como uma quebra de
    // linha fantasma após cada imagem, deslocando todo o texto subsequente para
    // baixo e desfigurando o layout do PDF (mesmo que o preview no browser
    // apareça corretamente, pois o browser compensa o offset internamente).
    //
    // Solução: injetar temporariamente `img { display: inline-block !important }`
    // apenas durante a captura do canvas, removendo a regra no bloco `finally`
    // para não afetar o restante da UI. Confirmado funcionando em 2026-02.
    // ─────────────────────────────────────────────────────────────────────────
    const imgFixStyle = document.createElement('style');
    imgFixStyle.textContent = 'img { display: inline-block !important; }';
    document.head.appendChild(imgFixStyle);

    try {
      for (let i = 0; i < pages.length; i++) {
        if (i > 0) pdf.addPage();

        const canvas = await html2canvas(pages[i] as HTMLElement, {
          scale: 2, // 2x = ~190 DPI — qualidade profissional de impressão
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: 794,
          height: 1123,
          windowWidth: 794,
          imageTimeout: 5000,
        });

        // JPEG com qualidade 0.92 — visualmente idêntico ao PNG, ~5-8x menor
        const imgData = canvas.toDataURL('image/jpeg', 0.92);
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;

        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, Math.min(imgHeight, pdfHeight));
      }
    } finally {
      // Always remove the temporary style, even if html2canvas throws
      document.head.removeChild(imgFixStyle);
    }

    return pdf.output('blob');
  } finally {
    // FIX #1: root.unmount() SEMPRE chamado, mesmo em caso de erro no html2canvas
    root?.unmount();
    document.body.removeChild(container);
  }
}

export function downloadPDF(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
