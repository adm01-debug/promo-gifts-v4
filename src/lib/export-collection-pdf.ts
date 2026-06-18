/**
 * Exporta a lista de produtos de uma coleção como PDF.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Product } from '@/hooks/products';

interface ExportOptions {
  collectionName: string;
  collectionDescription?: string;
  products: Product[];
  variantMap?: Map<string, { color_name?: string | null; color_hex?: string | null }>;
}

export async function exportCollectionPDF({
  collectionName,
  collectionDescription,
  products,
  variantMap,
}: ExportOptions) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(collectionName, 14, 18);

  if (collectionDescription) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(collectionDescription, 14, 26);
    doc.setTextColor(0, 0, 0);
  }

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150, 150, 150);
  doc.text(
    `${products.length} produtos • Gerado em ${new Date().toLocaleDateString('pt-BR')}`,
    14,
    collectionDescription ? 32 : 26,
  );
  doc.setTextColor(0, 0, 0);

  const startY = collectionDescription ? 38 : 32;

  // Table data
  const tableRows = products.map((p, idx) => {
    const variant = variantMap?.get(p.id);
    return [
      String(idx + 1),
      p.sku || '-',
      p.name,
      p.brand || '-',
      p.category_name || '-',
      variant?.color_name || '-',
      p.price != null ? `R$ ${p.price.toFixed(2)}` : '-',
    ];
  });

  autoTable(doc, {
    startY,
    head: [['#', 'SKU', 'Produto', 'Marca', 'Categoria', 'Cor', 'Preço']],
    body: tableRows,
    theme: 'striped',
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 28 },
      2: { cellWidth: 80 },
      3: { cellWidth: 35 },
      4: { cellWidth: 35 },
      5: { cellWidth: 30 },
      6: { cellWidth: 25, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Página ${i} de ${pageCount}`,
      doc.internal.pageSize.getWidth() - 14,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'right' },
    );
    doc.text('Promo Gifts', 14, doc.internal.pageSize.getHeight() - 8);
  }

  const fileName = `colecao-${collectionName.toLowerCase().replace(/\s+/g, '-')}.pdf`;
  doc.save(fileName);
}
