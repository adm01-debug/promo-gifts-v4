import { useMemo } from 'react';
import { CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WhatsAppPreviewProps {
  message: string;
  images: string[];
  selectedImages: Set<number>;
  contactName?: string;
}

/**
 * Renders a message preview styled like a WhatsApp chat bubble.
 * Automatically uses WhatsApp dark mode colors to match the app's dark theme.
 */
export function WhatsAppPreview({
  message,
  images,
  selectedImages,
  contactName,
}: WhatsAppPreviewProps) {
  const selectedPhotos = useMemo(
    () => images.filter((_, i) => selectedImages.has(i)),
    [images, selectedImages],
  );

  // Parse WhatsApp-style bold (*text*) and line breaks
  const formattedMessage = useMemo(() => {
    return message.split('\n').map((line, li) => {
      const parts = line.split(/(\*[^*]+\*)/g).map((part, pi) => {
        if (part.startsWith('*') && part.endsWith('*')) {
          return (
            <strong key={pi} className="font-semibold">
              {part.slice(1, -1)}
            </strong>
          );
        }
        return <span key={pi}>{part}</span>;
      });
      return (
        <span key={li}>
          {li > 0 && <br />}
          {parts}
        </span>
      );
    });
  }, [message]);

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // WhatsApp dark mode palette
  const header = 'hsl(200, 12%, 13%)'; // #1F2C33
  const chatBg = 'hsl(200, 15%, 8%)'; // #0B141A
  const bubbleOut = 'hsl(153, 18%, 18%)'; // #005C4B → outgoing bubble
  const bubbleText = 'hsl(0, 0%, 91%)'; // #E9EDEF
  const metaText = 'hsla(0, 0%, 100%, 0.45)';
  const tickColor = 'hsl(199, 80%, 55%)';

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      {/* Chat header — dark */}
      <div className="flex items-center gap-3 px-4 py-2.5" style={{ backgroundColor: header }}>
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
          style={{ backgroundColor: 'hsl(153, 30%, 30%)', color: bubbleText }}
        >
          {(contactName || 'C')[0].toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" style={{ color: bubbleText }}>
            {contactName || 'Cliente'}
          </p>
          <p className="text-[10px]" style={{ color: metaText }}>
            online
          </p>
        </div>
      </div>

      {/* Chat body — dark wallpaper */}
      <div
        className="max-h-[150px] min-h-[80px] overflow-y-auto p-2"
        style={{
          backgroundColor: chatBg,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}
      >
        {/* Photo gallery bubble */}
        {selectedPhotos.length > 0 && (
          <div className="mb-1 flex justify-end">
            <div
              className="max-w-[65%] rounded-lg p-1 shadow-sm"
              style={{ backgroundColor: bubbleOut }}
            >
              <div
                className={cn(
                  'grid gap-0.5 overflow-hidden rounded-md',
                  selectedPhotos.length === 1 && 'grid-cols-1',
                  selectedPhotos.length === 2 && 'grid-cols-2',
                  selectedPhotos.length >= 3 && 'grid-cols-2',
                )}
              >
                {selectedPhotos.slice(0, 4).map((img, idx) => (
                  <div
                    key={`${img}-${idx}`}
                    className={cn(
                      'relative overflow-hidden bg-black/20',
                      selectedPhotos.length === 1 ? 'aspect-[4/3]' : 'aspect-square',
                      selectedPhotos.length === 3 && idx === 0 && 'col-span-2 aspect-[2/1]',
                    )}
                  >
                    <img
                      src={img}
                      alt={`Foto ${idx + 1}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    {selectedPhotos.length > 4 && idx === 3 && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <span className="text-lg font-bold text-primary-foreground">
                          +{selectedPhotos.length - 4}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-end gap-1 px-1 pt-0.5">
                <span className="text-[10px]" style={{ color: metaText }}>
                  {timeStr}
                </span>
                <CheckCheck className="h-3 w-3" style={{ color: tickColor }} />
              </div>
            </div>
          </div>
        )}

        {/* Text message bubble */}
        <div className="flex justify-end">
          <div
            className="relative max-w-[85%] rounded-lg px-3 py-2 shadow-sm"
            style={{ backgroundColor: bubbleOut }}
          >
            {/* Tail */}
            <div
              className="absolute -right-1.5 top-0 h-3 w-3"
              style={{
                backgroundColor: bubbleOut,
                clipPath: 'polygon(0 0, 100% 0, 0 100%)',
              }}
            />
            <p
              className="whitespace-pre-wrap break-words text-[13px] leading-relaxed"
              style={{ color: bubbleText }}
            >
              {formattedMessage}
            </p>
            <div className="mt-1 flex items-center justify-end gap-1">
              <span className="text-[10px]" style={{ color: metaText }}>
                {timeStr}
              </span>
              <CheckCheck className="h-3 w-3" style={{ color: tickColor }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
