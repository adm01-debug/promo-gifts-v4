/**
 * ExportButton — Onda 13 #8
 * Botão reusável para exportar dados em CSV ou JSON.
 * Usa `trends-export` para CSV (já existe no projeto, sem deps extras)
 * e Blob nativo para JSON pretty-printed.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { exportTrendsCsv } from '@/lib/trends-export';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Props {
  filename: string;
  rows: Array<Record<string, unknown>>;
  columns?: Array<{ key: string; header: string }>;
  formats?: Array<'csv' | 'json'>;
  size?: 'sm' | 'default';
  variant?: 'outline' | 'ghost' | 'secondary';
  disabled?: boolean;
  label?: string;
}

function downloadJson(filename: string, rows: unknown[]): void {
  const ts = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${ts}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ExportButton({
  filename,
  rows,
  columns,
  formats = ['csv', 'json'],
  size = 'sm',
  variant = 'outline',
  disabled,
  label = 'Exportar',
}: Props) {
  const [busy, setBusy] = useState(false);
  const isEmpty = !rows || rows.length === 0;

  const handle = async (fmt: 'csv' | 'json') => {
    if (isEmpty) {
      toast.info('Nada para exportar');
      return;
    }
    setBusy(true);
    try {
      if (fmt === 'csv') exportTrendsCsv(filename, rows, columns);
      else downloadJson(filename, rows);
      toast.success(`Exportado (${fmt.toUpperCase()})`, {
        description: `${rows.length} registro${rows.length === 1 ? '' : 's'}`,
      });
    } catch (err) {
      toast.error('Falha ao exportar', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  if (formats.length === 1) {
    const fmt = formats[0];
    return (
      <Button
        size={size}
        variant={variant}
        disabled={disabled || busy || isEmpty}
        onClick={() => handle(fmt)}
        className="h-8 text-xs"
      >
        {busy ? (
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        ) : (
          <Download className="mr-1 h-3 w-3" />
        )}
        {label} {fmt.toUpperCase()}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size={size}
          variant={variant}
          disabled={disabled || busy || isEmpty}
          className="h-8 text-xs"
        >
          {busy ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <Download className="mr-1 h-3 w-3" />
          )}
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="text-xs">
        {formats.includes('csv') && (
          <DropdownMenuItem onClick={() => handle('csv')}>Baixar CSV</DropdownMenuItem>
        )}
        {formats.includes('json') && (
          <DropdownMenuItem onClick={() => handle('json')}>Baixar JSON</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
