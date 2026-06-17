/**
 * ComponentMediaManager — Mini gallery per kit component
 * Uses external-db-bridge (kit_component_media table) — no local storage
 */
import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image, Video, Trash2, Loader2, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

import {
  fetchComponentMedia,
  updateComponentMedia,
  deleteComponentMedia,
  type ComponentMedia,
} from './api';

interface Props {
  componentId: string;
  productId: string;
  componentName: string;
}

export function ComponentMediaManager({
  componentId,
  productId: _productId,
  componentName: _componentName,
}: Props) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  const { data: media = [], isLoading } = useQuery({
    queryKey: ['component-media', componentId],
    queryFn: () => fetchComponentMedia(componentId),
    enabled: isOpen && !!componentId,
    staleTime: 5 * 60 * 1000,
  });

  const imageCount = media.filter((m) => m.media_type === 'image').length;
  const videoCount = media.filter((m) => m.media_type === 'video').length;

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['component-media', componentId] });
  }, [queryClient, componentId]);

  const handleDelete = async (item: ComponentMedia) => {
    try {
      await deleteComponentMedia(item.id);
      toast.success('Mídia removida');
      invalidate();
    } catch {
      toast.error('Erro ao remover');
    }
  };

  const handleSetCover = async (item: ComponentMedia) => {
    try {
      // Unset all covers first
      const currentCovers = media.filter((m) => m.is_cover);
      for (const c of currentCovers) {
        await updateComponentMedia(c.id, { is_cover: false });
      }
      // Set new cover
      await updateComponentMedia(item.id, { is_cover: true });
      toast.success('Capa definida');
      invalidate();
    } catch {
      toast.error('Erro ao definir capa');
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex w-full items-center gap-2 rounded-b-lg border border-t-0 px-3 py-1.5 text-[10px] transition-colors',
            'text-muted-foreground hover:bg-accent/30 hover:text-foreground',
            isOpen && 'bg-accent/20 text-foreground',
          )}
        >
          <Image className="h-3 w-3" />
          <span>Mídia</span>
          {(imageCount > 0 || videoCount > 0) && (
            <div className="ml-1 flex items-center gap-1">
              {imageCount > 0 && (
                <Badge variant="secondary" className="h-3.5 px-1 py-0 text-[9px]">
                  {imageCount} <Image className="ml-0.5 h-2 w-2" />
                </Badge>
              )}
              {videoCount > 0 && (
                <Badge
                  variant="secondary"
                  className="h-3.5 border-warning/30 bg-warning/15 px-1 py-0 text-[9px] text-warning"
                >
                  {videoCount} <Video className="ml-0.5 h-2 w-2" />
                </Badge>
              )}
            </div>
          )}
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="space-y-3 rounded-b-lg border border-t-0 p-3">
          {/* Media grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando mídia...
            </div>
          ) : media.length === 0 ? (
            <div className="py-4 text-center text-[11px] text-muted-foreground">
              Nenhuma mídia adicionada a este componente
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
              {media.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'group relative aspect-square overflow-hidden rounded-lg border bg-muted/30',
                    item.is_cover && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
                  )}
                >
                  {item.media_type === 'image' ? (
                    <img
                      src={item.url}
                      alt={item.title ?? ''}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted">
                      <Video className="h-5 w-5 text-warning" />
                    </div>
                  )}

                  {/* Badge type */}
                  <div className="absolute left-1 top-1">
                    {item.media_type === 'video' && (
                      <Badge className="h-3.5 border-0 bg-warning/80 px-1 py-0 text-[8px] text-primary-foreground">
                        Vídeo
                      </Badge>
                    )}
                    {item.is_cover && (
                      <Badge className="h-3.5 border-0 bg-primary/80 px-1 py-0 text-[8px] text-primary-foreground">
                        Capa
                      </Badge>
                    )}
                  </div>

                  {/* Hover actions */}
                  <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    {item.media_type === 'image' && !item.is_cover && (
                      <button
                        type="button"
                        onClick={() => handleSetCover(item)}
                        className="rounded-md bg-white/20 p-1.5 text-primary-foreground transition-colors hover:bg-white/30"
                        title="Definir como capa"
                      >
                        <Star className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      className="rounded-md bg-destructive/60 p-1.5 text-primary-foreground transition-colors hover:bg-destructive/80"
                      title="Excluir"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
