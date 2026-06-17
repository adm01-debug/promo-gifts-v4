import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Upload, Loader2, Plus, FileVideo, Palette, Youtube } from 'lucide-react';
import { type VideoVariant, VIDEO_TYPES } from './types';

interface Props {
  productId?: string;
  variants: VideoVariant[];
  uploadVideoType: string;
  setUploadVideoType: (v: string) => void;
  uploadVariant: string;
  setUploadVariant: (v: string) => void;
  isUploading: boolean;
  uploadCount: number;
  uploadProgress: number;
  isDragOver: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDragOverZone: (e: React.DragEvent) => void;
  handleDragLeaveZone: (e: React.DragEvent) => void;
  handleDropZone: (e: React.DragEvent) => void;
  youtubeUrl: string;
  setYoutubeUrl: (v: string) => void;
  addYoutubeVideo: () => void;
  isAddingYoutube: boolean;
}

export function VideoUploadArea({
  productId,
  variants,
  uploadVideoType,
  setUploadVideoType,
  uploadVariant,
  setUploadVariant,
  isUploading,
  uploadCount,
  uploadProgress,
  isDragOver,
  fileInputRef,
  handleFileSelect,
  handleDragOverZone,
  handleDragLeaveZone,
  handleDropZone,
  youtubeUrl,
  setYoutubeUrl,
  addYoutubeVideo,
  isAddingYoutube,
}: Props) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-border/40 transition-all duration-200',
        isDragOver
          ? 'border-primary/60 shadow-lg shadow-primary/5 ring-2 ring-primary/20'
          : 'hover:border-border/60',
      )}
    >
      {/* Type & variant selector */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/30 bg-muted/30 px-3 py-2.5">
        <Select value={uploadVideoType} onValueChange={setUploadVideoType}>
          <SelectTrigger className="h-8 w-auto min-w-[140px] gap-1.5 rounded-md border border-primary/30 bg-gradient-to-r from-primary/15 via-primary/10 to-primary/5 text-xs text-foreground/90 shadow-[0_0_8px_hsl(var(--primary)/0.15)] transition-all duration-300 hover:border-primary/50 hover:from-primary/20 hover:via-primary/15 hover:to-primary/10 hover:shadow-[0_0_12px_hsl(var(--primary)/0.25)]">
            <span className="font-normal text-muted-foreground/70">Tipo:</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VIDEO_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value} className="text-xs">
                <span className="flex items-center gap-1.5">
                  <t.icon className={cn('h-3.5 w-3.5', t.color)} />
                  {t.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {variants.length > 0 && (
          <Select value={uploadVariant} onValueChange={setUploadVariant}>
            <SelectTrigger className="h-8 w-auto min-w-[160px] gap-1.5 rounded-md border-border/40 bg-background/60 text-xs transition-colors hover:bg-background/80">
              <Palette className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <SelectValue placeholder="Sem variação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-xs">
                Sem variação
              </SelectItem>
              {variants.map((v) => (
                <SelectItem key={v.id} value={v.id} className="text-xs">
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
      </div>

      {/* Drop zone */}
      <div
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-3 px-4 py-6 transition-all duration-200',
          isDragOver ? 'bg-primary/8' : 'bg-background/30 hover:bg-muted/20',
          isUploading && 'pointer-events-none opacity-60',
        )}
        onDragOver={handleDragOverZone}
        onDragLeave={handleDragLeaveZone}
        onDrop={handleDropZone}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,video/mpeg,video/ogg"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />

        {isUploading ? (
          <div className="flex flex-col items-center gap-2.5">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-sm font-medium text-foreground/70">
              Enviando {uploadProgress}/{uploadCount} vídeo(s)...
            </span>
            <div className="h-1 w-48 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${uploadCount > 0 ? (uploadProgress / uploadCount) * 100 : 0}%` }}
              />
            </div>
          </div>
        ) : (
          <>
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                isDragOver ? 'bg-primary/15' : 'bg-muted/30',
              )}
            >
              {isDragOver ? (
                <FileVideo className="h-5 w-5 text-primary" />
              ) : (
                <Upload className="h-5 w-5 text-muted-foreground/50" />
              )}
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                {isDragOver ? (
                  <span className="font-medium text-primary">Solte os vídeos aqui</span>
                ) : (
                  'Arraste vídeos ou clique para selecionar'
                )}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground/50">
                MP4, WebM, MOV • Máx. 100MB por arquivo
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 border-border/40 text-xs"
            >
              <Plus className="h-3.5 w-3.5" /> Selecionar vídeos
            </Button>
          </>
        )}
      </div>

      {/* YouTube URL input */}
      {productId && (
        <div
          className="flex items-center gap-2 border-t border-border/30 bg-muted/20 px-3 py-2.5"
          onClick={(e) => e.stopPropagation()}
        >
          <Youtube className="h-4 w-4 shrink-0 text-destructive" />
          <Input
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="Cole uma URL do YouTube..."
            className="h-7 flex-1 border-border/30 bg-background/50 text-xs"
            onKeyDown={(e) => e.key === 'Enter' && addYoutubeVideo()}
          />
          <Button
            type="button"
            size="sm"
            className="h-7 px-3 text-[11px]"
            disabled={!youtubeUrl.trim() || isAddingYoutube}
            onClick={addYoutubeVideo}
          >
            {isAddingYoutube ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Adicionar'}
          </Button>
        </div>
      )}
    </div>
  );
}
