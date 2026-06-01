import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CheckSquare, Trash2, Loader2, Type } from 'lucide-react';
import { type VariantInfo, IMAGE_TYPES } from './types';

interface Props {
  bulkMode: boolean;
  setBulkMode: (v: boolean) => void;
  clearSelection: () => void;
  selectAll: () => void;
  filteredImagesCount: number;
  selectedUrls: Set<string>;
  setSelectedUrls: (v: Set<string>) => void;
  bulkUpdateType: (type: string) => void;
  bulkUpdateVariant: (code: string) => void;
  bulkUpdateAltText: (template: string) => void;
  requestBulkDelete: () => void;
  isBulkUpdating: boolean;
  variants: VariantInfo[];
}

export function ImageBulkToolbar({
  bulkMode,
  setBulkMode,
  clearSelection,
  selectAll,
  filteredImagesCount,
  selectedUrls,
  setSelectedUrls,
  bulkUpdateType,
  bulkUpdateVariant,
  bulkUpdateAltText,
  requestBulkDelete,
  isBulkUpdating,
  variants,
}: Props) {
  const [altTemplate, setAltTemplate] = useState('');

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant={bulkMode ? 'default' : 'outline'}
        size="sm"
        className="h-7 gap-1.5 text-[11px]"
        onClick={() => {
          setBulkMode(!bulkMode);
          if (bulkMode) clearSelection();
        }}
      >
        <CheckSquare className="h-3 w-3" />
        {bulkMode ? 'Sair da seleção' : 'Selecionar'}
      </Button>

      {bulkMode && (
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-[11px]"
            onClick={selectAll}
          >
            Selecionar tudo ({filteredImagesCount})
          </Button>
          {selectedUrls.size > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => setSelectedUrls(new Set())}
            >
              Limpar ({selectedUrls.size})
            </Button>
          )}
          {selectedUrls.size > 0 && (
            <>
              <div className="h-5 w-px bg-border/50" />
              <Select onValueChange={bulkUpdateType}>
                <SelectTrigger className="h-7 w-[130px] text-[11px]" disabled={isBulkUpdating}>
                  <SelectValue placeholder="Alterar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {IMAGE_TYPES.filter((t) => t.value !== 'video').map((t) => (
                    <SelectItem key={t.value} value={t.value} className="text-xs">
                      <span className="flex items-center gap-1.5">
                        <t.icon className={cn('h-3 w-3', t.color)} />
                        {t.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {variants.length > 0 && (
                <Select onValueChange={bulkUpdateVariant}>
                  <SelectTrigger className="h-7 w-[150px] text-[11px]" disabled={isBulkUpdating}>
                    <SelectValue placeholder="Alterar variação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">
                      Sem variação (geral)
                    </SelectItem>
                    {variants.map((v) => (
                      <SelectItem key={v.id} value={v.supplier_code || v.id} className="text-xs">
                        <span className="flex items-center gap-1.5">
                          <span
                            className="h-3 w-3 shrink-0 rounded-full border border-border/60"
                            style={{ backgroundColor: v.color_hex || '#999' }}
                          />
                          {v.color_name || v.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Bulk alt text */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-[11px]"
                    disabled={isBulkUpdating}
                  >
                    <Type className="h-3 w-3" /> Alt text
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 space-y-2 p-3" align="start">
                  <p className="text-[11px] text-muted-foreground">
                    Template para {selectedUrls.size} imagem(ns). Use:{' '}
                    <code className="rounded bg-muted px-1 text-[10px]">{'{tipo}'}</code>{' '}
                    <code className="rounded bg-muted px-1 text-[10px]">{'{cor}'}</code>{' '}
                    <code className="rounded bg-muted px-1 text-[10px]">{'{n}'}</code>
                  </p>
                  <Input
                    value={altTemplate}
                    onChange={(e) => setAltTemplate(e.target.value)}
                    placeholder="Ex: Produto X - {tipo} - {cor}"
                    className="h-7 text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 w-full text-[11px]"
                    disabled={!altTemplate.trim() || isBulkUpdating}
                    onClick={() => {
                      bulkUpdateAltText(altTemplate);
                      setAltTemplate('');
                    }}
                  >
                    Aplicar a {selectedUrls.size} imagem(ns)
                  </Button>
                </PopoverContent>
              </Popover>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-[11px] text-destructive hover:text-destructive"
                onClick={requestBulkDelete}
                disabled={isBulkUpdating}
              >
                <Trash2 className="h-3 w-3" /> Remover ({selectedUrls.size})
              </Button>
              {isBulkUpdating && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
            </>
          )}
        </>
      )}
    </div>
  );
}
