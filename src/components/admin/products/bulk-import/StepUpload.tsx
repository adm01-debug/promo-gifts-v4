import { useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Download, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { MAX_ROWS, TARGET_FIELDS, TEMPLATE_EXAMPLES, ALIAS_MAP, type ColumnMapping } from './types';

import { logger } from '@/lib/logger';
interface StepUploadProps {
  onFileProcessed: (
    headers: string[],
    rows: Record<string, unknown>[],
    fileName: string,
    mapping: ColumnMapping,
  ) => void;
}

const normalizeStr = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const firstLine = text.split('\n')[0];
  const delimiter = firstLine.includes(';') ? ';' : firstLine.includes('\t') ? '\t' : ',';
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = parseCSVLine(lines[0], delimiter);
  const rows = lines.slice(1).map((line) => {
    const values = parseCSVLine(line, delimiter);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? '';
    });
    return row;
  });
  return { headers, rows };
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function StepUpload({ onFileProcessed }: StepUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(
    async (file: File) => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      try {
        let parsedHeaders: string[] = [];
        let parsedRows: Record<string, unknown>[] = [];

        if (ext === 'csv') {
          const text = await file.text();
          const result = parseCSV(text);
          parsedHeaders = result.headers;
          parsedRows = result.rows;
        } else if (['xlsx', 'xls'].includes(ext ?? '')) {
          const XLSX = await import('@e965/xlsx');
          const buffer = await file.arrayBuffer();
          const wb = XLSX.read(buffer, { type: 'array' });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
          if (json.length === 0) {
            toast.error('Planilha vazia');
            return;
          }
          parsedHeaders = Object.keys(json[0]);
          parsedRows = json;
        } else {
          toast.error('Formato não suportado. Use CSV, XLSX ou XLS.');
          return;
        }

        if (parsedRows.length > MAX_ROWS) {
          toast.error(`Arquivo excede o limite de ${MAX_ROWS.toLocaleString()} linhas`);
          return;
        }
        if (parsedRows.length === 0) {
          toast.error('Nenhuma linha de dados encontrada');
          return;
        }

        const newMapping: ColumnMapping = {};
        for (const col of parsedHeaders) {
          const normalized = normalizeStr(col);
          if (ALIAS_MAP[normalized]) {
            const alreadyMapped = Object.values(newMapping).includes(ALIAS_MAP[normalized]);
            if (!alreadyMapped) newMapping[col] = ALIAS_MAP[normalized];
          }
        }

        onFileProcessed(parsedHeaders, parsedRows, file.name, newMapping);
        toast.success(`${file.name} carregado — ${parsedRows.length.toLocaleString()} linhas`);
      } catch (error) {
        logger.error('Parse error:', error);
        toast.error('Erro ao ler o arquivo. Verifique o formato.');
      }
    },
    [onFileProcessed],
  );

  const downloadTemplateCSV = useCallback(() => {
    const labels = TARGET_FIELDS.map((f) => `${f.label}${f.required ? ' *' : ''}`);
    const example = TARGET_FIELDS.map((f) => TEMPLATE_EXAMPLES[f.key] ?? '');
    const csv = `\uFEFF${[labels.join(';'), example.join(';')].join('\n')}`;
    downloadBlob(csv, 'template_importacao_produtos.csv', 'text/csv;charset=utf-8;');
    toast.success('Template CSV baixado!');
  }, []);

  const downloadTemplateXLSX = useCallback(async () => {
    try {
      const XLSX = await import('@e965/xlsx');
      const exampleValues = TARGET_FIELDS.map((f) => TEMPLATE_EXAMPLES[f.key] ?? '');
      const ws = XLSX.utils.aoa_to_sheet([
        TARGET_FIELDS.map((f) => `${f.label}${f.required ? ' *' : ''}`),
        exampleValues,
      ]);
      ws['!cols'] = TARGET_FIELDS.map((_, i) => ({ wch: i < 3 ? 20 : 15 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Produtos');
      XLSX.writeFile(wb, 'template_importacao_produtos.xlsx');
      toast.success('Template Excel baixado!');
    } catch {
      toast.error('Erro ao gerar template Excel');
    }
  }, []);

  return (
    <div className="space-y-4">
      <div
        className="cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors hover:border-primary/50 hover:bg-primary/5"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) handleFileUpload(file);
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
          }}
        />
        <Upload className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-sm font-medium">Arraste um arquivo aqui ou clique para selecionar</p>
        <p className="mt-1 text-xs text-muted-foreground">
          CSV, XLSX ou XLS • Máximo {MAX_ROWS.toLocaleString()} linhas
        </p>
      </div>
      <div className="flex justify-center gap-2">
        <Button variant="outline" size="sm" onClick={downloadTemplateCSV}>
          <Download className="mr-2 h-4 w-4" />
          Template CSV
        </Button>
        <Button variant="outline" size="sm" onClick={downloadTemplateXLSX}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Template Excel
        </Button>
      </div>
    </div>
  );
}
