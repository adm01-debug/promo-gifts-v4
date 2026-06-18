/**
 * Exportação de Ficha Técnica do Produto em PDF
 * Usa jsPDF + jspdf-autotable para gerar um documento A4 profissional
 */

const getJsPDF = () => import('jspdf').then((m) => m.default);
const getAutoTable = () => import('jspdf-autotable').then((m) => m.default);
import type { ProductFormData } from '@/components/admin/products/ProductFormSchema';

interface ProductPdfOptions {
  formData: ProductFormData;
  productImages?: string[];
  categoryName?: string;
  supplierName?: string;
}

const formatCurrency = (value: number | null | undefined) =>
  typeof value === 'number' ? `R$ ${value.toFixed(2).replace('.', ',')}` : '—';

const formatDimension = (value: number | null | undefined, unit: string) =>
  typeof value === 'number' ? `${value} ${unit}` : '—';

const formatBool = (value: boolean | undefined) => (value ? 'Sim' : 'Não');

const nonEmpty = (value: string | null | undefined) => value?.trim() || '—';

export async function exportProductPdf({
  formData,
  productImages: _productImages,
  categoryName,
  supplierName,
}: ProductPdfOptions) {
  const [jsPDF, autoTable] = await Promise.all([getJsPDF(), getAutoTable()]);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Colors
  const primaryColor: [number, number, number] = [230, 126, 34]; // orange
  const darkColor: [number, number, number] = [30, 30, 30];
  const grayColor: [number, number, number] = [120, 120, 120];

  // ====== HEADER ======
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('FICHA TÉCNICA DO PRODUTO', margin, 12);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`SKU: ${formData.sku || 'N/A'}`, margin, 20);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - margin, 20, {
    align: 'right',
  });

  y = 36;

  // ====== PRODUCT NAME ======
  doc.setTextColor(...darkColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(formData.name || 'Produto sem nome', margin, y);
  y += 6;

  if (formData.short_description) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...grayColor);
    const lines = doc.splitTextToSize(formData.short_description, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 4 + 2;
  }

  y += 4;

  // Helper to add section title
  const addSectionTitle = (title: string) => {
    if (y > 270) {
      doc.addPage();
      y = margin;
    }
    doc.setFillColor(...primaryColor);
    doc.rect(margin, y - 4, 3, 7, 'F');
    doc.setTextColor(...darkColor);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin + 6, y);
    y += 6;
  };

  // Helper to add a table section
  const addTable = (rows: [string, string][]) => {
    const filteredRows = rows.filter(([, v]) => v !== '—');
    if (filteredRows.length === 0) return;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: 'plain',
      styles: {
        fontSize: 9,
        cellPadding: { top: 2, bottom: 2, left: 4, right: 4 },
        textColor: darkColor,
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 55, textColor: grayColor },
        1: { cellWidth: contentWidth - 55 },
      },
      body: filteredRows,
    });
    y = doc.lastAutoTable.finalY + 6;
  };

  // ====== INFORMAÇÕES BÁSICAS ======
  addSectionTitle('Informações Básicas');
  addTable([
    ['SKU Interno', nonEmpty(formData.sku)],
    ['SKU Fornecedor', nonEmpty(formData.supplier_reference)],
    ['Nome', nonEmpty(formData.name)],
    ['Marca', nonEmpty(formData.brand)],
    ['Categoria', nonEmpty(categoryName)],
    ['Fornecedor', nonEmpty(supplierName)],
  ]);

  // ====== PREÇO E ESTOQUE ======
  addSectionTitle('Preço e Estoque');
  addTable([
    ['Preço de Venda', formatCurrency(formData.sale_price)],
    ['Preço de Custo', formatCurrency(formData.cost_price)],
    ['Preço Sugerido', formatCurrency(formData.suggested_price)],
    ['Estoque', `${formData.stock_quantity} ${formData.stock_unit || 'un'}`],
    ['Qtd. Mínima', `${formData.min_quantity}`],
    [
      'Qtd. Mín. Pedido',
      formData.min_order_quantity !== null ? `${formData.min_order_quantity}` : '—',
    ],
  ]);

  // ====== COMERCIAL ======
  addSectionTitle('Comercial');
  addTable([
    ['Tipo de Produto', nonEmpty(formData.product_type)],
    ['Modo de Fornecimento', nonEmpty(formData.supply_mode)],
    [
      'Prazo de Entrega',
      formData.lead_time_days !== null ? `${formData.lead_time_days} dias` : '—',
    ],
    ['Garantia', formData.warranty_months !== null ? `${formData.warranty_months} meses` : '—'],
    ['Gênero', nonEmpty(formData.gender)],
  ]);

  // ====== STATUS / FLAGS ======
  addSectionTitle('Status');
  const flags = [
    ['Ativo', formatBool(formData.is_active)],
    ['Destaque', formatBool(formData.is_featured)],
    ['Mais Vendido', formatBool(formData.is_bestseller)],
    ['Novidade', formatBool(formData.is_new)],
    ['Em Promoção', formatBool(formData.is_on_sale)],
    ['Kit', formatBool(formData.is_kit)],
    ['Importado', formatBool(formData.is_imported)],
    ['Têxtil', formatBool(formData.is_textil)],
    ['Térmico', formatBool(formData.is_thermal)],
    ['Personalização', formatBool(formData.allows_personalization)],
  ] as [string, string][];
  addTable(flags);

  // ====== DIMENSÕES ======
  addSectionTitle('Dimensões');
  addTable([
    ['Altura', formatDimension(formData.height_cm, 'cm')],
    ['Largura', formatDimension(formData.width_cm, 'cm')],
    ['Profundidade', formatDimension(formData.length_cm, 'cm')],
    ['Diâmetro', formatDimension(formData.diameter_cm, 'cm')],
    ['Peso', formatDimension(formData.weight_g, 'g')],
    ['Capacidade', formatDimension(formData.capacity_ml, 'ml')],
  ]);

  // Dimensões internas (only if any are set)
  const hasInternal = [
    formData.internal_height_cm,
    formData.internal_width_cm,
    formData.internal_length_cm,
    formData.internal_diameter_cm,
  ].some((v) => v !== null);
  if (hasInternal) {
    addSectionTitle('Dimensões Internas');
    addTable([
      ['Altura Interna', formatDimension(formData.internal_height_cm, 'cm')],
      ['Largura Interna', formatDimension(formData.internal_width_cm, 'cm')],
      ['Profundidade Interna', formatDimension(formData.internal_length_cm, 'cm')],
      ['Diâmetro Interno', formatDimension(formData.internal_diameter_cm, 'cm')],
    ]);
  }

  // ====== EMBALAGEM ======
  addSectionTitle('Embalagem');
  addTable([
    ['Tipo de Embalagem', nonEmpty(formData.packing_type)],
    ['Material', nonEmpty(formData.packaging_material)],
    ['Cor', nonEmpty(formData.packaging_color)],
    ['Acabamento', nonEmpty(formData.packaging_finish)],
    ['Largura Caixa', formatDimension(formData.box_width_mm, 'mm')],
    ['Altura Caixa', formatDimension(formData.box_height_mm, 'mm')],
    ['Profundidade Caixa', formatDimension(formData.box_length_mm, 'mm')],
    ['Peso Caixa', formatDimension(formData.box_weight_kg, 'kg')],
    ['Qtd. por Caixa', formData.box_quantity !== null ? `${formData.box_quantity}` : '—'],
    ['Qtd. Inner', formData.box_inner_quantity !== null ? `${formData.box_inner_quantity}` : '—'],
    ['Volume Caixa', formatDimension(formData.box_volume_cm3, 'cm³')],
  ]);

  // ====== FISCAL ======
  addSectionTitle('Fiscal');
  addTable([
    ['NCM', nonEmpty(formData.ncm_code)],
    ['EAN', nonEmpty(formData.ean)],
    ['GTIN', nonEmpty(formData.gtin)],
    ['IPI', formData.ipi_rate !== null ? `${formData.ipi_rate}%` : '—'],
    ['País de Origem', nonEmpty(formData.country_of_origin)],
  ]);

  // ====== SEO ======
  if (formData.meta_title || formData.meta_keywords || formData.slug) {
    addSectionTitle('SEO');
    addTable([
      ['Meta Título', nonEmpty(formData.meta_title)],
      ['Meta Descrição', nonEmpty(formData.meta_description)],
      ['Palavras-chave', nonEmpty(formData.meta_keywords)],
      ['Slug', nonEmpty(formData.slug)],
    ]);
  }

  // ====== MARKETING ======
  if (formData.key_benefits || formData.use_cases) {
    addSectionTitle('Marketing');
    if (formData.key_benefits) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...darkColor);
      const benefitLines = doc.splitTextToSize(
        `Benefícios: ${formData.key_benefits}`,
        contentWidth,
      );
      if (y + benefitLines.length * 4 > 280) {
        doc.addPage();
        y = margin;
      }
      doc.text(benefitLines, margin, y);
      y += benefitLines.length * 4 + 3;
    }
    if (formData.use_cases) {
      const caseLines = doc.splitTextToSize(`Casos de Uso: ${formData.use_cases}`, contentWidth);
      if (y + caseLines.length * 4 > 280) {
        doc.addPage();
        y = margin;
      }
      doc.text(caseLines, margin, y);
      y += caseLines.length * 4 + 3;
    }
  }

  // ====== DESCRIÇÃO COMPLETA ======
  if (formData.description) {
    addSectionTitle('Descrição Completa');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...darkColor);
    const descLines = doc.splitTextToSize(formData.description, contentWidth);
    for (const line of descLines) {
      if (y > 280) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += 4;
    }
    y += 4;
  }

  // ====== FOOTER on each page ======
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...grayColor);
    doc.text(
      `Ficha Técnica — ${formData.sku || 'N/A'} — Página ${i}/${totalPages}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 6,
      { align: 'center' },
    );
  }

  // Save
  const fileName = `ficha-tecnica-${(formData.sku || 'produto').replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`;
  doc.save(fileName);
}
