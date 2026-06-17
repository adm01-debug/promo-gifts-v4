/**
 * ImageZoomCell (C6 #6) — Hover ativa lupa flutuante 2× sobre a imagem.
 */
import { useRef, useState } from 'react';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { cn } from '@/lib/utils';

interface Props {
  src: string;
  alt: string;
  className?: string;
  zoomLevel?: number;
}

export function ImageZoomCell({ src, alt, className = '', zoomLevel = 2 }: Props) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPos({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
  };

  return (
    <div
      ref={ref}
      className={cn('relative overflow-hidden', className)}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onMouseMove={onMove}
    >
      <OptimizedImage
        src={src}
        alt={alt}
        className="object-contain"
        containerClassName="h-full w-full"
      />
      {show && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 transition-opacity"
          style={{
            backgroundImage: `url(${src})`,
            backgroundRepeat: 'no-repeat',
            backgroundSize: `${zoomLevel * 100}%`,
            backgroundPosition: `${pos.x}% ${pos.y}%`,
          }}
        />
      )}
    </div>
  );
}
