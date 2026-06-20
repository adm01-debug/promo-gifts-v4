/**
 * ExportFavoritesButton — Exporta favoritos em CSV, JSON ou PDF (catálogo 4 cols).
 */
import { useState } from 'react';
import { Download, FileSpreadsheet, FileJson, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import type { Product } from '@/types/product-catalog';
import type { FavoriteListItem } from '@/hooks/favorites';
import { formatCurrency } from '@/lib/format';
import { toErrorMessage } from '@/lib/to-error-message';

interface Props {
  products: Product[];
  rawItems?: FavoriteListItem[];
  listName: string;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function ExportFavoritesButton({ products, rawItems, listName }: Props) {
  const [busy, setBusy] = useState<'csv' | 'json' | 'pdf' | null>(null);
  const safeName =
    listName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'favoritos';
  const date = new Date().toISOString().slice(0, 10);

  const itemMap = new Map(rawItems?.map((i) => [i.product_id, i]) ?? []);

  const exportCsv = () => {
    setBusy('csv');
    try {
      const headers = [
        'SKU',
        'Nome',
        'Preço (R$)',
        'Categoria',
        'Variante',
        'Nota',
        'Salvo em (R$)',
        'Adicionado em',
      ];
      const rows = products.map((p) => {
        const item = itemMap.get(p.id);
        const variant = item?.variant_info;
        const cat = p.category_name ?? p.category?.name ?? '';
        // Use comma as decimal separator (pt-BR) because column sep is semicolon
        const ptBrPrice = (p.price ?? 0).toFixed(2).replace('.', ',');
        const ptBrSaved = item?.price_at_save?.toFixed(2).replace('.', ',') ?? '';
        return [
          p.sku ?? '',
          p.name,
          ptBrPrice,
          cat,
          variant?.color_name ?? '',
          item?.note ?? '',
          ptBrSaved,
          item?.added_at ?? '',
        ]
          .map(csvEscape)
          .join(';');
      });
      const csv = [headers.join(';'), ...rows].join('\n');
      const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
      downloadBlob(blob, `${safeName}-${date}.csv`);
      toast.success('CSV exportado');
    } catch (e) {
      toast.error(`Erro ao exportar CSV: ${toErrorMessage(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const exportJson = () => {
    setBusy('json');
    try {
      const payload = {
        list: listName,
        exported_at: new Date().toISOString(),
        total: products.length,
        items: products.map((p) => {
          const item = itemMap.get(p.id);
          return {
            product_id: p.id,
            sku: p.sku,
            name: p.name,
            price: p.price,
            category: p.category_name ?? p.category?.name,
            image: p.images?.[0],
            variant: item?.variant_info ?? null,
            note: item?.note ?? null,
            price_at_save: item?.price_at_save ?? null,
            added_at: item?.added_at ?? null,
          };
        }),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `${safeName}-${date}.json`);
      toast.success('JSON exportado');
    } catch (e) {
      toast.error(`Erro ao exportar JSON: ${toErrorMessage(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const exportPdf = async () => {
    setBusy('pdf');
    try {
      const [{ jsPDF }] = await Promise.all([import('jspdf')]);
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 12;
      const cols = 2;
      const rowsPerPage = 3;
      const cellW = (pageW - margin * 2) / cols;
      const cellH = (pageH - margin * 2 - 20) / rowsPerPage;

      // Strip non-Latin-1 chars for jsPDF Helvetica (Latin-1 only)
      const sanitize = (s: string) => s.replace(/[Ā-\u{10FFFF}]/gu, '?');
      // Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(sanitize(listName), margin, margin + 6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(
        `${products.length} produtos • Exportado em ${new Date().toLocaleDateString('pt-BR')}`,
        margin,
        margin + 12,
      );
      doc.setTextColor(0);

      let i = 0;
      const perPage = cols * rowsPerPage;
      while (i < products.length) {
        if (i > 0 && i % perPage === 0) doc.addPage();
        const inPage = i % perPage;
        const col = inPage % cols;
        const row = Math.floor(inPage / cols);
        const x = margin + col * cellW;
        const y = margin + 20 + row * cellH;

        const p = products[i];
        const item = itemMap.get(p.id);
        // borda card
        doc.setDrawColor(200);
        doc.roundedRect(x + 1, y + 1, cellW - 2, cellH - 2, 2, 2);

        // imagem (se possível)
        const img = p.images?.[0];
        if (img) {
          try {
            const imgH = cellH * 0.55;
            doc.addImage(img, 'JPEG', x + 4, y + 4, cellW - 8, imgH, undefined, 'FAST');
          } catch {
            // ignora falha de CORS/format
          }
        }

        // nome
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        const name = doc.splitTextToSize(sanitize(p.name), cellW - 8).slice(0, 2);
        doc.text(name, x + 4, y + cellH * 0.6 + 4);

        // sku + preço
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(p.sku ?? '—', x + 4, y + cellH * 0.6 + 14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(20);
        doc.setFontSize(11);
        doc.text(formatCurrency(p.price ?? 0), x + 4, y + cellH * 0.6 + 22);

        // variante + nota
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(120);
        const variant = item?.variant_info?.color_name;
        const note = item?.note;
        if (variant) doc.text(`Cor: ${variant}`, x + 4, y + cellH * 0.6 + 28);
        if (note) {
          // Strip non-Latin-1 chars (jsPDF built-in Helvetica is Latin-1 only)
          const safeNote = note.replace(/[Ā-\u{10FFFF}]/gu, '?');
          const noteLines = doc.splitTextToSize(`Nota: ${safeNote}`, cellW - 8).slice(0, 2);
          doc.text(noteLines, x + 4, y + cellH * 0.6 + 33);
        }

        i++;
      }

      doc.save(`${safeName}-${date}.pdf`);
      toast.success('PDF exportado');
    } catch (e) {
      toast.error(`Erro ao exportar PDF: ${toErrorMessage(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const isBusy = busy !== null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isBusy || products.length === 0}>
          {isBusy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          <span className="ml-1.5 hidden text-xs sm:inline">Exportar</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs">Formato</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={exportPdf} disabled={isBusy}>
          <FileText className="mr-2 h-4 w-4 text-destructive" />
          <div className="flex-1">
            <p className="text-sm font-medium">PDF Catálogo</p>
            <p className="text-[10px] text-muted-foreground">Apresentação 2×3 cards/página</p>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportCsv} disabled={isBusy}>
          <FileSpreadsheet className="mr-2 h-4 w-4 text-success" />
          <div className="flex-1">
            <p className="text-sm font-medium">CSV (Excel)</p>
            <p className="text-[10px] text-muted-foreground">Planilha pronta para abrir</p>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportJson} disabled={isBusy}>
          <FileJson className="mr-2 h-4 w-4 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium">JSON</p>
            <p className="text-[10px] text-muted-foreground">Para integrações</p>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
