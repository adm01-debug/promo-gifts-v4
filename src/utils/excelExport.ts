// src/utils/excelExport.ts

import { formatDateTime } from '@/lib/date-utils';

const getXLSX = () => import('@e965/xlsx');

/**
 * Configuração de exportação Excel
 */
export interface ExcelExportConfig {
  /** Nome do arquivo (sem extensão) */
  filename: string;
  /** Nome da planilha */
  sheetName?: string;
  /** Colunas a exportar */
  columns: ExcelColumn[];
  /** Dados a exportar */
  data: Record<string, unknown>[];
  /** Incluir timestamp no nome do arquivo */
  includeTimestamp?: boolean;
}

/**
 * Definição de coluna
 */
export interface ExcelColumn {
  /** Chave do campo no objeto de dados */
  key: string;
  /** Cabeçalho da coluna */
  header: string;
  /** Largura da coluna (em caracteres) */
  width?: number;
  /** Função de formatação customizada */
  format?: (value: unknown, row: Record<string, unknown>) => string | number;
}

/**
 * Exporta dados para arquivo Excel (.xlsx)
 */
export async function exportToExcel(config: ExcelExportConfig): Promise<void> {
  const { filename, sheetName = 'Dados', columns, data, includeTimestamp = true } = config;

  try {
    const XLSX = await getXLSX();
    // 1. Preparar dados formatados
    const formattedData = data.map((row) => {
      const formattedRow: Record<string, string | number> = {};

      columns.forEach((col) => {
        const value = getNestedValue(row, col.key);

        if (col.format) {
          formattedRow[col.header] = col.format(value, row);
        } else if (value instanceof Date) {
          formattedRow[col.header] = formatDateTime(value);
        } else if (typeof value === 'number') {
          formattedRow[col.header] = value;
        } else if (value === null || value === undefined) {
          formattedRow[col.header] = '';
        } else {
          formattedRow[col.header] = String(value);
        }
      });

      return formattedRow;
    });

    // 2. Criar workbook e worksheet
    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // 3. Configurar larguras das colunas
    const colWidths = columns.map((col) => ({
      wch: col.width || 20,
    }));
    worksheet['!cols'] = colWidths;

    // 4. Aplicar estilos no cabeçalho (se possível)
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = `${XLSX.utils.encode_col(C)}1`;
      if (!worksheet[address]) continue;
      if (worksheet[address].s) {
        worksheet[address].s.font = { bold: true };
      }
    }

    // 5. Gerar nome do arquivo
    const timestamp = includeTimestamp
      ? `_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`
      : '';
    const fullFilename = `${filename}${timestamp}.xlsx`;

    // 6. Fazer download
    XLSX.writeFile(workbook, fullFilename);
  } catch {
    throw new Error('Falha ao exportar arquivo Excel');
  }
}

/**
 * Exporta múltiplas planilhas em um único arquivo
 */
export async function exportMultipleSheets(
  filename: string,
  sheets: Array<{
    sheetName: string;
    columns: ExcelColumn[];
    data: Record<string, unknown>[];
  }>,
  includeTimestamp = true,
): Promise<void> {
  try {
    const XLSX = await getXLSX();
    const workbook = XLSX.utils.book_new();

    sheets.forEach(({ sheetName, columns, data }) => {
      const formattedData = data.map((row) => {
        const formattedRow: Record<string, string | number> = {};
        columns.forEach((col) => {
          const value = getNestedValue(row, col.key);
          formattedRow[col.header] = col.format ? col.format(value, row) : formatValue(value);
        });
        return formattedRow;
      });

      const worksheet = XLSX.utils.json_to_sheet(formattedData);
      const colWidths = columns.map((col) => ({ wch: col.width || 20 }));
      worksheet['!cols'] = colWidths;
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    });

    const timestamp = includeTimestamp
      ? `_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`
      : '';
    const fullFilename = `${filename}${timestamp}.xlsx`;

    XLSX.writeFile(workbook, fullFilename);
  } catch {
    throw new Error('Falha ao exportar arquivo Excel');
  }
}

// Pega valor aninhado de objeto (ex: 'client.name')
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((current: unknown, prop: string) => {
    if (current !== null && typeof current === 'object') {
      return (current as Record<string, unknown>)[prop];
    }
    return undefined;
  }, obj);
}

// Formata valor automaticamente
function formatValue(value: unknown): string | number {
  if (value instanceof Date) {
    return formatDateTime(value);
  }
  if (typeof value === 'number') {
    return value;
  }
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
}

/**
 * Formata moeda brasileira
 */

/**
 * Formata porcentagem
 */
export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Formata status com emoji
 */
const EXPORT_STATUS_MAP: Record<string, string> = {
  draft: '📝 Rascunho',
  sent: '📤 Enviado',
  approved: '✅ Aprovado',
  rejected: '❌ Rejeitado',
  expired: '⏰ Expirado',
  pending: '⏳ Pendente',
  processing: '🔄 Processando',
  completed: '✅ Concluído',
  cancelled: '🚫 Cancelado',
} as const;

export function formatStatus(status: string): string {
  return EXPORT_STATUS_MAP[status] || status;
}
