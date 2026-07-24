import React, { useState, useCallback } from 'react';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

const SAMPLE_IMAGE = 'https://picsum.photos/seed/picsum/800/1000';
const ERROR_IMAGE = 'https://invalid-url.com/non-existent.jpg';

interface TestCase {
  name: string;
  url: string;
  expected: string;
}

function ValidationRow({ test }: { test: TestCase }) {
  const [detectedRule, setDetectedRule] = useState<string>('detecting...');

  return (
    <tr className="hover:bg-muted/30" data-testid={`row-${test.expected}`}>
      <td className="border p-2 font-medium">{test.name}</td>
      <td className="max-w-[200px] truncate border p-2" title={test.url}>
        {test.url}
      </td>
      <td className="border p-2">
        <div className="flex items-center gap-2">
          <OptimizedImage
            src={test.url}
            alt="test"
            containerClassName="hidden"
            onDetection={(rule) => setDetectedRule(rule)}
          />
          <code
            className={cn(
              'rounded px-2 py-0.5 text-xs',
              detectedRule === test.expected
                ? 'bg-green-100 text-green-700'
                : 'bg-yellow-100 text-yellow-700',
            )}
            data-testid="rule-badge"
          >
            {detectedRule}
          </code>
        </div>
      </td>
      <td className="border p-2">
        {detectedRule === test.expected ? (
          <span className="flex items-center gap-1 text-xs font-bold text-green-600">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />✓ Validado
          </span>
        ) : (
          <span className="text-xs italic text-muted-foreground">Aguardando...</span>
        )}
      </td>
    </tr>
  );
}

export default function OptimizedImageDemo() {
  const [blur, setBlur] = useState(20);
  const [zoom, setZoom] = useState(1.1);
  const [duration, setDuration] = useState(700);
  const [key, setKey] = useState(0);
  const [showError, setShowError] = useState(false);
  const [delay, setDelay] = useState(1000);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSrc, setCurrentSrc] = useState('');

  const reload = useCallback(() => {
    setIsLoading(true);
    setCurrentSrc('');
    setKey((prev) => prev + 1);

    setTimeout(() => {
      setCurrentSrc(showError ? ERROR_IMAGE : `${SAMPLE_IMAGE}?t=${Date.now()}`);
      setIsLoading(false);
    }, delay);
  }, [showError, delay]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="container mx-auto space-y-8 p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">OptimizedImage Demo</h1>
        <p className="text-muted-foreground">
          Ajuste os parâmetros para visualizar o efeito de transição blur-up e fade-in.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Configurações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex justify-between">
                <Label>Blur Amount ({blur}px)</Label>
              </div>
              <Slider
                value={[blur]}
                onValueChange={([v]) => setBlur(v)}
                min={0}
                max={100}
                step={1}
              />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between">
                <Label>Zoom Amount ({zoom.toFixed(2)}x)</Label>
              </div>
              <Slider
                value={[zoom]}
                onValueChange={([v]) => setZoom(v)}
                min={1}
                max={2}
                step={0.05}
              />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between">
                <Label>Duration ({duration}ms)</Label>
              </div>
              <Slider
                value={[duration]}
                onValueChange={([v]) => setDuration(v)}
                min={0}
                max={3000}
                step={100}
              />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between">
                <Label>Atraso de Rede ({delay}ms)</Label>
              </div>
              <Slider
                value={[delay]}
                onValueChange={([v]) => setDelay(v)}
                min={0}
                max={5000}
                step={500}
              />
            </div>

            <div className="space-y-2 pt-4">
              <Button onClick={reload} className="w-full gap-2" disabled={isLoading}>
                <RefreshCcw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
                {isLoading ? 'Simulando Rede...' : 'Reiniciar Carregamento'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowError(!showError)}
                className="w-full gap-2"
                disabled={isLoading}
              >
                {showError ? 'Simular URL válida' : 'Simular URL inválida'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-[400px] items-center justify-center rounded-lg bg-muted/20">
            <div className="aspect-[4/5] w-full max-w-sm overflow-hidden rounded-xl border bg-white shadow-2xl">
              <OptimizedImage
                key={key}
                src={currentSrc}
                alt="Demo"
                blurAmount={blur}
                zoomAmount={zoom}
                duration={duration}
                debug
                containerClassName="h-full w-full"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Com LQIP (Base64/Thumb)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Simulando uma versão de baixa qualidade (LQIP) que aparece instantaneamente.
            </p>
            <div className="relative aspect-video overflow-hidden rounded-md border">
              <OptimizedImage
                key={`lqip-${key}`}
                src={`${SAMPLE_IMAGE}&t=${key}`}
                lqip="https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=1&w=50"
                alt="LQIP Demo"
                blurAmount={blur}
                zoomAmount={zoom}
                duration={duration}
                containerClassName="h-full w-full"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cloudflare CDN</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Valida a detecção de <strong>imagedelivery.net</strong> e geração do path{' '}
              <strong>/thumbnail</strong>. Confira o Console!
            </p>
            <div className="relative aspect-video overflow-hidden rounded-md border">
              <OptimizedImage
                key={`cf-${key}`}
                src={`https://imagedelivery.net/demo-id/product-${key}/public`}
                alt="Cloudflare CDN Demo"
                blurAmount={blur}
                zoomAmount={zoom}
                duration={duration}
                debug
                containerClassName="h-full w-full"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sem LQIP (Shimmer)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sem LQIP, o componente usa um shimmer e aplica o efeito na imagem conforme ela
              carrega.
            </p>
            <div className="relative aspect-video overflow-hidden rounded-md border">
              <OptimizedImage
                key={`fallback-${key}`}
                src={`${SAMPLE_IMAGE}&fb=${key}`}
                alt="Fallback Demo"
                blurAmount={blur}
                zoomAmount={zoom}
                duration={duration}
                containerClassName="h-full w-full"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Validação de Detecção de CDN</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="border p-2">Cenário</th>
                  <th className="border p-2">URL de Origem</th>
                  <th className="border p-2">Regra Detectada</th>
                  <th className="border p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    name: 'Cloudflare Padrão',
                    url: 'https://imagedelivery.net/demo/123/public',
                    expected: 'cloudflare',
                  },
                  {
                    name: 'Cloudflare c/ Query',
                    url: 'https://imagedelivery.net/demo/123/public?v=1',
                    expected: 'cloudflare',
                  },
                  {
                    name: 'Cloudflare c/ Barra',
                    url: 'https://imagedelivery.net/demo/123/public/',
                    expected: 'cloudflare',
                  },
                  {
                    name: 'Unsplash',
                    url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30',
                    expected: 'unsplash',
                  },
                  {
                    name: 'Supabase Storage',
                    url: 'https://xyz.supabase.co/storage/v1/object/public/bucket/img.jpg',
                    expected: 'supabase',
                  },
                  {
                    name: 'Genérico',
                    url: 'https://example.com/image.jpg',
                    expected: 'generic',
                  },
                ].map((test, i) => (
                  <ValidationRow key={i} test={test} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 rounded-md border border-blue-100 bg-blue-50 p-4">
            <p className="text-xs text-blue-700">
              <strong>Dica:</strong> Esta tabela valida em tempo real a detecção automática do
              componente baseada na URL.
            </p>
          </div>
          <div className="mt-4 rounded-md border border-blue-100 bg-blue-50 p-4">
            <p className="text-xs text-blue-700">
              <strong>Dica:</strong> Abra o console do navegador para ver os logs detalhados de cada
              detecção marcados com <code>[OptimizedImage]</code>.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
