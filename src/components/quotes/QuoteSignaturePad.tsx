/**
 * QuoteSignaturePad — pad de assinatura eletrônica em canvas para aprovação de orçamentos.
 * Conforme MP 2.200-2/2001 — captura traço, nome, documento.
 */
import { useRef, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eraser, PenLine } from 'lucide-react';

interface QuoteSignaturePadProps {
  onSign: (data: { name: string; document: string; signatureDataUrl: string }) => void;
  isSubmitting?: boolean;
}

export function QuoteSignaturePad({ onSign, isSubmitting }: QuoteSignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [name, setName] = useState('');
  const [document, setDocument] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = 'hsl(var(--foreground))';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const point = 'touches' in e ? e.touches[0] : e;
    // Scale CSS pixel coords → canvas internal pixel coords (canvas may be CSS-scaled)
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (point.clientX - rect.left) * scaleX,
      y: (point.clientY - rect.top) * scaleY,
    };
  };

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    if (!pos) return;
    const { x, y } = pos;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    if (!pos) return;
    const { x, y } = pos;
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stop = () => setIsDrawing(false);

  const clear = () => {
    const canvas = canvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const submit = () => {
    if (!hasSignature || !name.trim() || !document.trim()) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSign({ name: name.trim(), document: document.trim(), signatureDataUrl: dataUrl });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <PenLine className="h-4 w-4 text-primary" /> Assinatura Eletrônica
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="sig-name">Nome completo</Label>
            <Input id="sig-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sig-doc">CPF/CNPJ</Label>
            <Input
              id="sig-doc"
              value={document}
              onChange={(e) => setDocument(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Assine no quadro abaixo</Label>
          <div className="rounded-lg border bg-muted/20">
            <canvas
              ref={canvasRef}
              width={500}
              height={180}
              className="w-full cursor-crosshair touch-none"
              onMouseDown={start}
              onMouseMove={draw}
              onMouseUp={stop}
              onMouseLeave={stop}
              onTouchStart={start}
              onTouchMove={draw}
              onTouchEnd={stop}
            />
          </div>
        </div>
        <div className="flex justify-between gap-2">
          <Button variant="outline" size="sm" onClick={clear}>
            <Eraser className="mr-1 h-4 w-4" /> Limpar
          </Button>
          <Button
            onClick={submit}
            disabled={!hasSignature || !name.trim() || !document.trim() || isSubmitting}
          >
            {isSubmitting ? 'Enviando...' : 'Confirmar assinatura'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Esta assinatura tem validade jurídica conforme MP 2.200-2/2001.
        </p>
      </CardContent>
    </Card>
  );
}
