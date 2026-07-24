import React, { useEffect, useState } from 'react';

// ── Module-level cache so the image is processed once and reused instantly ──
const logoCache = new Map<string, string>();
const logoPromises = new Map<string, Promise<string>>();

/**
 * Fetches the image (same-origin, no CORS taint), removes white/near-white
 * pixels via Canvas API and returns a transparent PNG data URL.
 * Result is cached for the lifetime of the page.
 */
export function processLogoTransparent(src: string): Promise<string> {
  const cached = logoCache.get(src);
  if (cached) return Promise.resolve(cached);
  const inflight = logoPromises.get(src);
  if (inflight) return inflight;

  const promise = fetch(src)
    .then((res) => res.blob())
    .then(
      (blob) =>
        new Promise<string>((resolve, _reject) => {
          const objectUrl = URL.createObjectURL(blob);
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve(src);
              return;
            }
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const d = imageData.data;
            for (let i = 0; i < d.length; i += 4) {
              const r = d[i],
                g = d[i + 1],
                b = d[i + 2];
              // Threshold 235 catches off-white anti-alias edges
              if (r > 235 && g > 235 && b > 235) d[i + 3] = 0;
            }
            ctx.putImageData(imageData, 0, 0);
            URL.revokeObjectURL(objectUrl);
            const dataUrl = canvas.toDataURL('image/png');
            logoCache.set(src, dataUrl);
            resolve(dataUrl);
          };
          img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(src);
          };
          img.src = objectUrl;
        }),
    )
    .catch(() => src);

  logoPromises.set(src, promise);
  return promise;
}

interface Props {
  src: string;
  style?: React.CSSProperties;
  alt?: string;
}

export function LogoWithTransparentBg({ src, style, alt }: Props) {
  // Immediately use cached result if available (no flash)
  const [dataUrl, setDataUrl] = useState<string>(() => logoCache.get(src) ?? '');

  useEffect(() => {
    const cached = logoCache.get(src);
    if (cached) {
      setDataUrl(cached);
      return;
    }
    processLogoTransparent(src).then(setDataUrl);
  }, [src]);

  if (!dataUrl) return <div style={{ ...style, opacity: 0 }} />;

  return <img src={dataUrl} alt={alt ?? 'Logo'} style={style} />;
}
