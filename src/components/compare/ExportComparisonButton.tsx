/**
 * ExportComparisonButton — Exporta comparação em PDF (A4 paisagem) / PNG / CSV.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileText, Image as ImageIcon, FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Product } from '@/types/product-catalog';

import { logger } from '@/lib/logger';
interface Props {
  products: Product[];
  targetSelector?: string; // CSS selector for PNG capture
  formatCurrency: (v: number) => string;
}

export function ExportComparisonButton({
  products,
  targetSelector = '#compare-export-area',
  formatCurrency: _formatCurrency,
}: Props) {
  const [busy, setBusy] = useState(false);

  const exportCSV = () => {
    const headers = ['SKU', 'Nome', 'Preço', 'Qtd. mín.', 'Estoque', 'Cores', 'Categoria'];
    const rows = products.map((p) => [
      p.sku ?? '',
      p.name,
      p.price,
      p.minQuantity,
      p.stock,
      p.colors?.length ?? 0,
      p.category?.name ?? '',
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comparacao-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado');
  };

  const exportPNG = async () => {
    setBusy(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const el = document.querySelector(targetSelector);
      if (!(el instanceof HTMLElement)) {
        toast.error('Área não encontrada');
        return;
      }
      const canvas = await html2canvas(el, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `comparacao-${new Date().toISOString().slice(0, 10)}.png`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('PNG exportado');
      });
    } catch (e) {
      logger.error('Comparison PNG export failed', e);
      toast.error('Falha ao exportar PNG');
    } finally {
      setBusy(false);
    }
  };

  const exportPDF = async () => {
    setBusy(true);
    try {
      const [{ default: jsPDF }, html2canvasMod] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ]);
      const html2canvas = html2canvasMod.default;
      const el = document.querySelector(targetSelector);
      if (!(el instanceof HTMLElement)) {
        toast.error('Área não encontrada');
        return;
      }
      const canvas = await html2canvas(el, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.setFontSize(16);
      pdf.text('Comparação de Produtos — Promo Gifts', 10, 12);
      pdf.setFontSize(9);
      pdf.text(new Date().toLocaleDateString('pt-BR'), pageWidth - 30, 12);

      if (imgHeight < pageHeight - 25) {
        pdf.addImage(imgData, 'PNG', 10, 18, imgWidth, imgHeight);
      } else {
        // multiple pages
        let position = 18;
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
      pdf.save(`comparacao-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('PDF exportado');
    } catch (e) {
      logger.error('Comparison PDF export failed', e);
      toast.error('Falha ao exportar PDF');
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={busy}>
          {busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportPDF}>
          <FileText className="mr-2 h-4 w-4" /> PDF (paisagem)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportPNG}>
          <ImageIcon className="mr-2 h-4 w-4" /> PNG (imagem)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportCSV}>
          <FileSpreadsheet className="mr-2 h-4 w-4" /> CSV (planilha)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
