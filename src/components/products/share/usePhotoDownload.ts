import { useCallback, useState } from 'react';
import { useToast } from '@/hooks/ui';

/**
 * Hook to download product photos.
 * Downloads individual images or multiple as separate files
 * (real ZIP requires a library; this provides a pragmatic per-file download).
 */
export function usePhotoDownload() {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);

  const downloadPhotos = useCallback(
    async (images: string[], productName: string) => {
      if (images.length === 0) return;

      setDownloading(true);
      toast({
        title: 'Download',
        description: `Preparando ${images.length} foto(s)...`,
      });

      try {
        for (let i = 0; i < images.length; i++) {
          const url = images[i];
          try {
            const response = await fetch(url, { mode: 'cors' });
            const blob = await response.blob();
            const ext = url.split('.').pop()?.split('?')[0] || 'jpg';
            const safeName = productName
              .replace(/[^a-zA-Z0-9-_ ]/g, '')
              .replace(/\s+/g, '_')
              .slice(0, 30);

            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${safeName}_${i + 1}.${ext}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);

            // Small delay between downloads to avoid browser blocking
            if (i < images.length - 1) {
              await new Promise((r) => {
                setTimeout(r, 300);
              });
            }
          } catch {
            // Fallback: open in new tab
            window.open(url, '_blank');
          }
        }

        toast({
          title: 'Download concluído',
          description: `${images.length} foto(s) baixada(s)`,
        });
      } catch {
        toast({
          title: 'Erro no download',
          description: 'Não foi possível baixar as fotos',
          variant: 'destructive',
        });
      } finally {
        setDownloading(false);
      }
    },
    [toast],
  );

  return { downloadPhotos, downloading };
}
