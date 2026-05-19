import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Upload, Loader2, ImageIcon, Palette, FileImage, Plus } from 'lucide-react';
import { type VariantInfo, IMAGE_TYPES } from "./types";

interface Props {
  productId?: string;
  variants: VariantInfo[];
  variantMap: Map<string, VariantInfo>;
  variantImageCounts: Map<string, number>;
  uploadVariant: string;
  setUploadVariant: (v: string) => void;
  uploadImageType: string;
  setUploadImageType: (v: string) => void;
  isUploading: boolean;
  uploadCount: number;
  uploadProgress: number;
  isDragOverZone: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFilesChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDropZone: (e: React.DragEvent) => void;
  handleDropZoneDragOver: (e: React.DragEvent) => void;
  handleDropZoneDragLeave: (e: React.DragEvent) => void;
}

export function ImageUploadArea({
  productId, variants, variantMap, variantImageCounts, uploadVariant, setUploadVariant,
  uploadImageType, setUploadImageType, isUploading, uploadCount, uploadProgress,
  isDragOverZone, fileInputRef, handleFilesChange, handleDropZone, handleDropZoneDragOver, handleDropZoneDragLeave,
}: Props) {
  const activeType = IMAGE_TYPES.find(t => t.value === uploadImageType);
  const activeVariant = uploadVariant !== 'none' ? variantMap.get(uploadVariant) : null;

  return (
    <div className={cn(
      "rounded-xl border border-border/40 overflow-hidden transition-all duration-200",
      isDragOverZone ? "border-primary/60 ring-2 ring-primary/20 shadow-lg shadow-primary/5" : "hover:border-border/60"
    )}>
      {/* Upload context selectors */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 bg-muted/30 border-b border-border/30">
        {productId && variants.length > 0 && (
          <Select value={uploadVariant} onValueChange={setUploadVariant}>
            <SelectTrigger className="h-8 w-auto min-w-[180px] gap-1.5 text-xs rounded-md bg-background/60 border-border/40 hover:bg-background/80 transition-colors">
              <Palette className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <SelectValue placeholder="Sem variação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-xs">
                <span className="flex items-center gap-1.5"><ImageIcon className="h-3 w-3 text-muted-foreground" />Imagem geral (sem cor)</span>
              </SelectItem>
              {variants.map(v => {
                const count = variantImageCounts.get(v.supplier_code || v.id) || 0;
                return (
                  <SelectItem key={v.id} value={v.supplier_code || v.id} className="text-xs">
                    <span className="flex items-center gap-1.5">
                      {v.color_hex ? <div className="w-3 h-3 rounded-full border border-border/60 shrink-0" style={{ backgroundColor: v.color_hex }} /> : <Palette className="h-3 w-3 text-muted-foreground" />}
                      {v.color_name || v.name}
                      {count > 0 && <span className="text-[9px] text-muted-foreground/70">({count})</span>}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        )}

        <Select value={uploadImageType} onValueChange={setUploadImageType}>
          <SelectTrigger className="h-8 w-auto min-w-[140px] gap-1.5 text-xs rounded-md bg-gradient-to-r from-primary/15 via-primary/10 to-primary/5 border border-primary/30 hover:border-primary/50 hover:from-primary/20 hover:via-primary/15 hover:to-primary/10 shadow-[0_0_8px_hsl(var(--primary)/0.15)] hover:shadow-[0_0_12px_hsl(var(--primary)/0.25)] transition-all duration-300 text-foreground/90">
            
            <span className="text-muted-foreground/70 font-normal">Tipo:</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {IMAGE_TYPES.filter(t => t.value !== 'video').map(t => (
              <SelectItem key={t.value} value={t.value} className="text-xs">
                <span className="flex items-center gap-1.5"><t.icon className={cn("h-3.5 w-3.5", t.color)} />{t.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(activeVariant || uploadImageType !== 'gallery') && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 text-[10px] text-primary/80 font-medium">
            {activeVariant && (
              <span className="flex items-center gap-1">
                {activeVariant.color_hex && <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: activeVariant.color_hex }} />}
                {activeVariant.color_name || activeVariant.name}
              </span>
            )}
            {activeVariant && uploadImageType !== 'gallery' && <span className="opacity-50">·</span>}
            {uploadImageType !== 'gallery' && activeType?.label}
          </div>
        )}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={handleDropZoneDragOver}
        onDragLeave={handleDropZoneDragLeave}
        onDrop={handleDropZone}
        className={cn(
          'py-6 px-4 flex flex-col items-center justify-center gap-3 transition-all duration-200 cursor-pointer',
          isDragOverZone ? 'bg-primary/8' : 'bg-background/30 hover:bg-muted/20',
          isUploading && 'bg-muted/20 pointer-events-none'
        )}
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFilesChange} className="hidden" />
        {isUploading ? (
          <div className="flex flex-col items-center gap-2.5">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-sm font-medium text-foreground/70">
              Enviando {uploadProgress}/{uploadCount} imagem(ns)...
            </span>
            <div className="w-48 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${uploadCount > 0 ? (uploadProgress / uploadCount) * 100 : 0}%` }}
              />
            </div>
          </div>
        ) : (
          <>
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
              isDragOverZone ? "bg-primary/15" : "bg-muted/30"
            )}>
              {isDragOverZone ? <FileImage className="h-5 w-5 text-primary" /> : <Upload className="h-5 w-5 text-muted-foreground/50" />}
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                {isDragOverZone ? <span className="text-primary font-medium">Solte as imagens aqui</span> : 'Arraste imagens aqui ou clique para enviar'}
              </p>
              <p className="text-[11px] text-muted-foreground/50 mt-0.5">PNG, JPG até 5MB • Mín. 200×200px • Múltiplas imagens</p>
            </div>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-border/40">
              <Plus className="h-3.5 w-3.5" /> Selecionar imagens
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
