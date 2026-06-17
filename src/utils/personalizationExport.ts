const getXLSX = () => import('@e965/xlsx');
const getJsPDF = () => import('jspdf').then((m) => m.jsPDF);
const getAutoTable = () => import('jspdf-autotable').then((m) => m.default);

interface TechniqueInfo {
  id: string;
  name: string;
  code: string;
  description: string | null;
  estimatedDays: number | null;
  maxColors: number | null;
  isDefault: boolean;
}

interface LocationInfo {
  id: string;
  code: string;
  name: string;
  maxWidth: number | null;
  maxHeight: number | null;
  maxArea: number | null;
  techniques: TechniqueInfo[];
}

interface ComponentInfo {
  id: string;
  code: string;
  name: string;
  isPersonalizable: boolean;
  locations: LocationInfo[];
}

interface ExportData {
  productName: string;
  productSku: string;
  components: ComponentInfo[];
}

// Excel export
export async function exportToExcel(data: ExportData) {
  const XLSX = await getXLSX();
  const rows: Record<string, string>[] = [];

  data.components.forEach((component) => {
    if (!component.isPersonalizable) return;

    component.locations.forEach((location) => {
      location.techniques.forEach((technique) => {
        rows.push({
          Produto: data.productName,
          SKU: data.productSku,
          Componente: component.name,
          'Código Componente': component.code,
          Local: location.name,
          'Código Local': location.code,
          Dimensões:
            location.maxWidth && location.maxHeight
              ? `${location.maxWidth} × ${location.maxHeight} cm`
              : location.maxArea
                ? `${location.maxArea} cm²`
                : '-',
          Técnica: technique.name,
          'Código Técnica': technique.code,
          'Máx. Cores': technique.maxColors ? String(technique.maxColors) : '-',
          'Prazo (dias)': technique.estimatedDays ? String(technique.estimatedDays) : '-',
          Padrão: technique.isDefault ? 'Sim' : 'Não',
        });
      });

      // If no techniques, still add location row
      if (location.techniques.length === 0) {
        rows.push({
          Produto: data.productName,
          SKU: data.productSku,
          Componente: component.name,
          'Código Componente': component.code,
          Local: location.name,
          'Código Local': location.code,
          Dimensões:
            location.maxWidth && location.maxHeight
              ? `${location.maxWidth} × ${location.maxHeight} cm`
              : location.maxArea
                ? `${location.maxArea} cm²`
                : '-',
          Técnica: '-',
          'Código Técnica': '-',
          'Máx. Cores': '-',
          'Prazo (dias)': '-',
          Padrão: '-',
        });
      }
    });
  });

  if (rows.length === 0) {
    rows.push({
      Produto: data.productName,
      SKU: data.productSku,
      Componente: 'Sem regras configuradas',
      'Código Componente': '-',
      Local: '-',
      'Código Local': '-',
      Dimensões: '-',
      Técnica: '-',
      'Código Técnica': '-',
      'Máx. Cores': '-',
      'Prazo (dias)': '-',
      Padrão: '-',
    });
  }

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Personalização');

  // Auto-adjust column widths
  const colWidths = Object.keys(rows[0] ?? {}).map((key) => ({
    wch: Math.max(key.length, ...rows.map((row) => String(row[key] ?? '').length)) + 2,
  }));
  worksheet['!cols'] = colWidths;

  const fileName = `personalizacao_${data.productSku}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

// PDF export
export async function exportToPDF(data: ExportData) {
  const [jsPDF, autoTable] = await Promise.all([getJsPDF(), getAutoTable()]);
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Regras de Personalização', pageWidth / 2, 20, { align: 'center' });

  // Product info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Produto: ${data.productName}`, 14, 35);
  doc.text(`SKU: ${data.productSku}`, 14, 42);
  doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 49);

  let yPosition = 60;

  data.components.forEach((component) => {
    if (!component.isPersonalizable || component.locations.length === 0) return;

    // Component header
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`${component.name} (${component.code})`, 14, yPosition);
    yPosition += 8;

    // Table data for this component
    const tableData: string[][] = [];

    component.locations.forEach((location) => {
      const dimensions =
        location.maxWidth && location.maxHeight
          ? `${location.maxWidth} × ${location.maxHeight} cm`
          : location.maxArea
            ? `${location.maxArea} cm²`
            : '-';

      if (location.techniques.length === 0) {
        tableData.push([location.name, location.code, dimensions, '-', '-', '-']);
      } else {
        location.techniques.forEach((technique, idx) => {
          tableData.push([
            idx === 0 ? location.name : '',
            idx === 0 ? location.code : '',
            idx === 0 ? dimensions : '',
            technique.name,
            technique.maxColors ? String(technique.maxColors) : '-',
            technique.isDefault ? 'Sim' : 'Não',
          ]);
        });
      }
    });

    autoTable(doc, {
      startY: yPosition,
      head: [['Local', 'Código', 'Dimensões', 'Técnica', 'Máx. Cores', 'Padrão']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [88, 28, 135], // Primary purple color
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: {
        fontSize: 8,
      },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 20 },
        2: { cellWidth: 30 },
        3: { cellWidth: 40 },
        4: { cellWidth: 20 },
        5: { cellWidth: 18 },
      },
      margin: { left: 14, right: 14 },
    });

    yPosition = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;

    // Add new page if needed
    if (yPosition > doc.internal.pageSize.getHeight() - 30) {
      doc.addPage();
      yPosition = 20;
    }
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, {
      align: 'center',
    });
  }

  const fileName = `personalizacao_${data.productSku}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
